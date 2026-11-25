import { prisma } from "@/lib/db";
import { env, getEnv } from "@/lib/env";
import { SendRawEmailHandler } from "@/lib/services/email/send-raw-email/handler";
import type { SendRawEmailSpec } from "@/lib/services/email/send-raw-email/spec";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { listUnsubscribeHeaders, unsubscribeUrl } from "../shared";
import {
  ConfirmSubscriberInputSchema,
  type ConfirmSubscriberInput,
  type ConfirmSubscriberResult,
  type ConfirmSubscriberSpec,
} from "./spec";

export interface ConfirmSubscriberDeps {
  db?: {
    newsletterSubscriber: {
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
    };
  };
  sendRawEmailHandler?: SendRawEmailSpec;
}

/**
 * Handler for confirming a `PENDING` newsletter subscriber via single-use token (#841).
 * Returns `NOT_FOUND` on invalid/replaced tokens and `STORAGE_UNAVAILABLE` on database outages.
 */
export class ConfirmSubscriberHandler implements ConfirmSubscriberSpec {
  private readonly db: NonNullable<ConfirmSubscriberDeps["db"]>;
  private readonly sendRawEmailHandler: SendRawEmailSpec;

  constructor(deps: ConfirmSubscriberDeps = {}) {
    this.db = deps.db ?? prisma;
    this.sendRawEmailHandler =
      deps.sendRawEmailHandler ?? new SendRawEmailHandler();
  }

  async execute(
    input: ConfirmSubscriberInput
  ): Promise<ConfirmSubscriberResult> {
    const parsed = ConfirmSubscriberInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid confirmation token",
        { recoverable: false, details: parsed.error }
      );
    }

    const { token } = parsed.data;
    const now = parsed.data.now ?? new Date();

    let subscriber: {
      id: string;
      email: string;
      status: string;
      unsubscribeToken: string;
    } | null;

    try {
      subscriber = await this.db.newsletterSubscriber.findUnique({
        where: { confirmationToken: token },
      });
      if (!subscriber) {
        return createFailure("NOT_FOUND", "Confirmation link not recognised", {
          recoverable: false,
        });
      }
      if (subscriber.status === "CONFIRMED") {
        return createSuccess({ outcome: "already_confirmed" });
      }

      const updated = await this.db.newsletterSubscriber.updateMany({
        where: { id: subscriber.id, confirmationToken: token },
        data: {
          status: "CONFIRMED",
          confirmedAt: now,
          confirmationToken: null,
          unsubscribedAt: null,
        },
      });
      if (updated.count !== 1) {
        return createFailure("NOT_FOUND", "Confirmation link not recognised", {
          recoverable: false,
        });
      }
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Unable to confirm subscription right now. Please try your link again shortly.",
        { recoverable: true, details: error }
      );
    }

    try {
      const { renderNewsletterWelcomeEmail } =
        await import("@/lib/email-templates");
      const welcome = renderNewsletterWelcomeEmail({
        email: subscriber.email,
        unsubscribeUrl: unsubscribeUrl(subscriber.unsubscribeToken),
      });
      await this.sendRawEmailHandler.execute({
        to: subscriber.email,
        subject: welcome.subject,
        html: welcome.html,
        text: welcome.text,
        headers: listUnsubscribeHeaders(subscriber.unsubscribeToken),
        tags: [{ name: "category", value: "newsletter-welcome" }],
      });

      const adminEmail =
        getEnv().CONTACT_NOTIFICATION_EMAIL || env.CONTACT_NOTIFICATION_EMAIL;
      if (adminEmail) {
        await this.sendRawEmailHandler.execute({
          to: adminEmail,
          subject: "[Newsletter] Subscriber confirmed",
          html: "<p>A Systems Dispatch subscriber confirmed their address.</p>",
          text: "A Systems Dispatch subscriber confirmed their address.",
          tags: [{ name: "category", value: "newsletter-admin-alert" }],
        });
      }
    } catch {
      // Welcome/admin notification failures do not roll back a confirmed subscription
    }

    return createSuccess({ outcome: "confirmed" });
  }
}
