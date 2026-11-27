import { prisma } from "@/lib/db";

import { createFailure, createSuccess } from "@/lib/services/service-result";
import { SendRawEmailHandler } from "../../email/send-raw-email/handler";
import type {
  SendRawEmailInput,
  SendRawEmailResult,
} from "../../email/send-raw-email/spec";
import {
  CONFIRMATION_RESEND_INTERVAL_MS,
  confirmNewsletterUrl,
  generateNewsletterToken,
  normalizeNewsletterEmail,
} from "../shared";
import {
  SubscribeNewsletterInputSchema,
  type SubscribeNewsletterInput,
  type SubscribeNewsletterResult,
  type SubscribeNewsletterSpec,
} from "./spec";

export interface SubscribeNewsletterSubscriberPort {
  findUnique(args: { where: { email: string } }): Promise<{
    id: string;
    status: string;
    confirmationSentAt: Date | null;
  } | null>;
  update(args: {
    where: { id: string };
    data: {
      status: "PENDING";
      confirmationToken: string;
      confirmationSentAt: Date;
      unsubscribedAt: null;
    };
  }): Promise<unknown>;
  create(args: {
    data: {
      email: string;
      status: "PENDING";
      confirmationToken: string;
      confirmationSentAt: Date;
      unsubscribeToken: string;
    };
  }): Promise<unknown>;
}

export interface SubscribeNewsletterDeps {
  subscribers?: SubscribeNewsletterSubscriberPort;
  sendRawEmail?: (input: SendRawEmailInput) => Promise<SendRawEmailResult>;
  tokenGenerator?: () => string;
}

export class SubscribeNewsletterHandler implements SubscribeNewsletterSpec {
  private readonly subscribers: SubscribeNewsletterSubscriberPort;
  private readonly sendRawEmail: (
    input: SendRawEmailInput
  ) => Promise<SendRawEmailResult>;
  private readonly tokenGenerator: () => string;

  constructor(deps: SubscribeNewsletterDeps = {}) {
    this.subscribers = deps.subscribers ?? prisma.newsletterSubscriber;
    const defaultSender = new SendRawEmailHandler();
    this.sendRawEmail =
      deps.sendRawEmail ?? ((payload) => defaultSender.execute(payload));
    this.tokenGenerator = deps.tokenGenerator ?? generateNewsletterToken;
  }

  async execute(
    input: SubscribeNewsletterInput
  ): Promise<SubscribeNewsletterResult> {
    const parsed = SubscribeNewsletterInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_NEWSLETTER_INPUT",
        parsed.error.issues[0]?.message ?? "Invalid newsletter signup payload",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const now = parsed.data.now ?? new Date();
    const email = normalizeNewsletterEmail(parsed.data.email);

    let existing: Awaited<
      ReturnType<SubscribeNewsletterSubscriberPort["findUnique"]>
    >;
    try {
      existing = await this.subscribers.findUnique({ where: { email } });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Newsletter subscription storage is temporarily unavailable",
        { recoverable: true, details: error }
      );
    }

    if (existing?.status === "CONFIRMED") {
      return createSuccess({ confirmationSent: false });
    }

    if (
      existing?.status === "PENDING" &&
      existing.confirmationSentAt &&
      now.getTime() - existing.confirmationSentAt.getTime() <
        CONFIRMATION_RESEND_INTERVAL_MS
    ) {
      return createSuccess({ confirmationSent: false });
    }

    const confirmationToken = this.tokenGenerator();
    try {
      if (existing) {
        await this.subscribers.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            confirmationToken,
            confirmationSentAt: now,
            unsubscribedAt: null,
          },
        });
      } else {
        await this.subscribers.create({
          data: {
            email,
            status: "PENDING",
            confirmationToken,
            confirmationSentAt: now,
            unsubscribeToken: this.tokenGenerator(),
          },
        });
      }
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Newsletter subscription storage is temporarily unavailable",
        { recoverable: true, details: error }
      );
    }

    try {
      const { renderNewsletterConfirmationEmail } =
        await import("@/lib/email-templates");
      const template = renderNewsletterConfirmationEmail({
        email,
        confirmUrl: confirmNewsletterUrl(confirmationToken),
      });

      const sent = await this.sendRawEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        tags: [{ name: "category", value: "newsletter-confirmation" }],
      });

      if (!sent.success) {
        return createFailure("EMAIL_DELIVERY_FAILED", sent.error.message, {
          recoverable: true,
          details: sent.error,
        });
      }

      return createSuccess({
        confirmationSent: true,
        ...(sent.data.simulated !== undefined
          ? { simulated: sent.data.simulated }
          : {}),
      });
    } catch (error) {
      return createFailure(
        "EMAIL_DELIVERY_FAILED",
        error instanceof Error
          ? error.message
          : "Could not send newsletter confirmation email",
        { recoverable: true, details: error }
      );
    }
  }
}
