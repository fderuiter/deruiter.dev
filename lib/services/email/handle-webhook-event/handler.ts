import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { RecordEmailSuppressionHandler } from "../record-suppression/handler";
import type { RecordEmailSuppressionSpec } from "../record-suppression/spec";
import type { SuppressionReason } from "../shared";
import {
  HandleEmailWebhookEventInputSchema,
  type HandleEmailWebhookEventInput,
  type HandleEmailWebhookEventResult,
  type HandleEmailWebhookEventSpec,
} from "./spec";

export interface HandleEmailWebhookEventDeps {
  recordSuppressionHandler?: RecordEmailSuppressionSpec;
}

/**
 * Handler for processing inbound Resend deliverability webhook events (`email.bounced`, `email.complained`).
 * Propagates `STORAGE_UNAVAILABLE` if suppression writes fail so the webhook endpoint returns a retryable status.
 */
export class HandleEmailWebhookEventHandler implements HandleEmailWebhookEventSpec {
  private readonly recordSuppressionHandler: RecordEmailSuppressionSpec;

  constructor(deps: HandleEmailWebhookEventDeps = {}) {
    this.recordSuppressionHandler =
      deps.recordSuppressionHandler ?? new RecordEmailSuppressionHandler();
  }

  async execute(
    input: HandleEmailWebhookEventInput
  ): Promise<HandleEmailWebhookEventResult> {
    const parsed = HandleEmailWebhookEventInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid Resend webhook event",
        { recoverable: false, details: parsed.error }
      );
    }

    const { event } = parsed.data;

    try {
      if (event.type === "email.bounced" || event.type === "email.complained") {
        const reason: SuppressionReason =
          event.type === "email.bounced" ? "BOUNCE" : "COMPLAINT";
        const recipients = event.data.to || [];

        for (const recipient of recipients) {
          if (recipient && typeof recipient === "string") {
            const res = await this.recordSuppressionHandler.execute({
              email: recipient,
              reason,
            });
            if (!res.success) {
              logger.error(
                "Error processing Resend webhook event:",
                res.error.details ?? res.error.message
              );
              return createFailure(
                "STORAGE_UNAVAILABLE",
                "Failed to durably process webhook event",
                { recoverable: true, details: res.error.details }
              );
            }
          }
        }

        return createSuccess({ suppressed: true, reason });
      }

      return createSuccess({ suppressed: false });
    } catch (err) {
      logger.error("Error processing Resend webhook event:", err);
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to durably process webhook event",
        { recoverable: true, details: err }
      );
    }
  }
}
