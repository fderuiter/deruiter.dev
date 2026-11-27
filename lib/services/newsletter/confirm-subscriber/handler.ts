import { prisma } from "@/lib/db";
import { env, getEnv } from "@/lib/env";

import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { SendRawEmailHandler } from "../../email/send-raw-email/handler";
import type {
  SendRawEmailInput,
  SendRawEmailResult,
} from "../../email/send-raw-email/spec";
import { listUnsubscribeHeaders, unsubscribeUrl } from "../shared";
import {
  ConfirmSubscriberInputSchema,
  type ConfirmSubscriberInput,
  type ConfirmSubscriberResult,
  type ConfirmSubscriberSpec,
} from "./spec";

export interface ConfirmSubscriberPort {
  findUnique(args: { where: { confirmationToken: string } }): Promise<{
    id: string;
    email: string;
    status: string;
    unsubscribeToken: string;
  } | null>;
  updateMany(args: {
    where: { id: string; confirmationToken: string };
    data: {
      status: "CONFIRMED";
      confirmedAt: Date;
      confirmationToken: null;
      unsubscribedAt: null;
    };
  }): Promise<{ count: number }>;
}

export interface ConfirmSubscriberDeps {
  subscribers?: ConfirmSubscriberPort;
  sendRawEmail?: (input: SendRawEmailInput) => Promise<SendRawEmailResult>;
  resolveAdminEmail?: () => string | undefined;
}

export class ConfirmSubscriberHandler implements ConfirmSubscriberSpec {
  private readonly subscribers: ConfirmSubscriberPort;
  private readonly sendRawEmail: (
    input: SendRawEmailInput
  ) => Promise<SendRawEmailResult>;
  private readonly resolveAdminEmail: () => string | undefined;

  constructor(deps: ConfirmSubscriberDeps = {}) {
    this.subscribers = deps.subscribers ?? prisma.newsletterSubscriber;
    const defaultSender = new SendRawEmailHandler();
    this.sendRawEmail =
      deps.sendRawEmail ?? ((payload) => defaultSender.execute(payload));
    this.resolveAdminEmail =
      deps.resolveAdminEmail ??
      (() =>
        getEnv().CONTACT_NOTIFICATION_EMAIL || env.CONTACT_NOTIFICATION_EMAIL);
  }

  async execute(
    input: ConfirmSubscriberInput
  ): Promise<ConfirmSubscriberResult> {
    const parsed = ConfirmSubscriberInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_TOKEN",
        "Confirmation link is invalid or has already been used.",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const token = parsed.data.token;
    const now = parsed.data.now ?? new Date();

    let subscriber: Awaited<ReturnType<ConfirmSubscriberPort["findUnique"]>>;
    try {
      subscriber = await this.subscribers.findUnique({
        where: { confirmationToken: token },
      });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Newsletter confirmation is temporarily unavailable.",
        { recoverable: true, details: error }
      );
    }

    if (!subscriber) {
      return createFailure(
        "INVALID_TOKEN",
        "Confirmation link is invalid or has already been used.",
        { recoverable: false }
      );
    }

    if (subscriber.status === "CONFIRMED") {
      return createSuccess({ outcome: "already_confirmed" });
    }

    let updated: { count: number };
    try {
      updated = await this.subscribers.updateMany({
        where: { id: subscriber.id, confirmationToken: token },
        data: {
          status: "CONFIRMED",
          confirmedAt: now,
          confirmationToken: null,
          unsubscribedAt: null,
        },
      });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Newsletter confirmation is temporarily unavailable.",
        { recoverable: true, details: error }
      );
    }

    if (updated.count !== 1) {
      return createFailure(
        "INVALID_TOKEN",
        "Confirmation link is invalid or has already been used.",
        { recoverable: false }
      );
    }

    try {
      const { renderNewsletterWelcomeEmail } =
        await import("@/lib/email-templates");
      const welcome = renderNewsletterWelcomeEmail({
        email: subscriber.email,
        unsubscribeUrl: unsubscribeUrl(subscriber.unsubscribeToken),
      });
      await this.sendRawEmail({
        to: subscriber.email,
        subject: welcome.subject,
        html: welcome.html,
        text: welcome.text,
        headers: listUnsubscribeHeaders(subscriber.unsubscribeToken),
        tags: [{ name: "category", value: "newsletter-welcome" }],
      });

      const adminEmail = this.resolveAdminEmail();
      if (adminEmail) {
        await this.sendRawEmail({
          to: adminEmail,
          subject: "[Newsletter] Subscriber confirmed",
          html: "<p>A Systems Dispatch subscriber confirmed their address.</p>",
          text: "A Systems Dispatch subscriber confirmed their address.",
          tags: [{ name: "category", value: "newsletter-admin-alert" }],
        });
      }
    } catch (error) {
      logger.warn(
        "Newsletter subscriber confirmed, but post-confirmation email failed:",
        error
      );
    }

    return createSuccess({ outcome: "confirmed" });
  }
}
