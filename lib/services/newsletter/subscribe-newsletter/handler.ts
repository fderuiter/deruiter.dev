import { prisma } from "@/lib/db";
import { SendRawEmailHandler } from "@/lib/services/email/send-raw-email/handler";
import type { SendRawEmailSpec } from "@/lib/services/email/send-raw-email/spec";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  CONFIRMATION_RESEND_INTERVAL_MS,
  confirmUrl,
  newNewsletterToken,
  normalizeNewsletterEmail,
} from "../shared";
import {
  SubscribeNewsletterInputSchema,
  type SubscribeNewsletterInput,
  type SubscribeNewsletterResult,
  type SubscribeNewsletterSpec,
} from "./spec";

export interface SubscribeNewsletterDeps {
  db?: {
    newsletterSubscriber: {
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
    };
  };
  sendRawEmailHandler?: SendRawEmailSpec;
  tokenGenerator?: () => string;
}

/**
 * Handler for double opt-in newsletter signup (#841).
 * Leaves confirmed addresses untouched, throttles repeat confirmation emails, and returns `STORAGE_UNAVAILABLE` on storage failures.
 */
export class SubscribeNewsletterHandler implements SubscribeNewsletterSpec {
  private readonly db: NonNullable<SubscribeNewsletterDeps["db"]>;
  private readonly sendRawEmailHandler: SendRawEmailSpec;
  private readonly tokenGenerator: () => string;

  constructor(deps: SubscribeNewsletterDeps = {}) {
    this.db = deps.db ?? prisma;
    this.sendRawEmailHandler =
      deps.sendRawEmailHandler ?? new SendRawEmailHandler();
    this.tokenGenerator = deps.tokenGenerator ?? newNewsletterToken;
  }

  async execute(
    input: SubscribeNewsletterInput
  ): Promise<SubscribeNewsletterResult> {
    const parsed = SubscribeNewsletterInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid email address",
        { recoverable: false, details: parsed.error }
      );
    }

    const email = normalizeNewsletterEmail(parsed.data.email);
    const now = parsed.data.now ?? new Date();

    try {
      const existing = await this.db.newsletterSubscriber.findUnique({
        where: { email },
      });

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
      if (existing) {
        await this.db.newsletterSubscriber.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            confirmationToken,
            confirmationSentAt: now,
            unsubscribedAt: null,
          },
        });
      } else {
        await this.db.newsletterSubscriber.create({
          data: {
            email,
            status: "PENDING",
            confirmationToken,
            confirmationSentAt: now,
            unsubscribeToken: this.tokenGenerator(),
          },
        });
      }

      const { renderNewsletterConfirmationEmail } =
        await import("@/lib/email-templates");
      const template = renderNewsletterConfirmationEmail({
        email,
        confirmUrl: confirmUrl(confirmationToken),
      });

      const sent = await this.sendRawEmailHandler.execute({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        tags: [{ name: "category", value: "newsletter-confirmation" }],
      });

      if (!sent.success) {
        const isTransient =
          sent.error.code === "STORAGE_UNAVAILABLE" ||
          sent.error.code === "RECIPIENT_ELIGIBILITY_UNKNOWN" ||
          sent.error.code === "TRANSPORT_UNCONFIGURED";
        return createFailure(
          isTransient ? "STORAGE_UNAVAILABLE" : "DELIVERY_FAILED",
          sent.error.message ||
            "Unable to register subscription at this time. Please try again later.",
          { recoverable: isTransient, details: sent.error }
        );
      }

      return createSuccess({
        confirmationSent: true,
        simulated: sent.data.simulated,
      });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Unable to register subscription at this time. Please try again later.",
        { recoverable: true, details: error }
      );
    }
  }
}
