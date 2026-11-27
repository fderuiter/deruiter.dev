import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "../../service-result";
import {
  RecordSuppressionHandler,
  type RecordSuppressionPrismaPort,
} from "../record-suppression/handler";
import type { RecordSuppressionSpec } from "../record-suppression/spec";
import type { SuppressionReason } from "../shared";
import {
  HandleResendWebhookInputSchema,
  type HandleResendWebhookInput,
  type HandleResendWebhookResult,
  type HandleResendWebhookSpec,
} from "./spec";

export interface HandleResendWebhookDeps {
  recordSuppressionHandler?: RecordSuppressionSpec;
  prisma?: RecordSuppressionPrismaPort;
}

export class HandleResendWebhookHandler implements HandleResendWebhookSpec {
  private readonly suppressionHandler: RecordSuppressionSpec;

  constructor(deps?: HandleResendWebhookDeps) {
    this.suppressionHandler =
      deps?.recordSuppressionHandler ??
      new RecordSuppressionHandler({ prisma: deps?.prisma });
  }

  async execute(
    input: HandleResendWebhookInput
  ): Promise<HandleResendWebhookResult> {
    const parsed = HandleResendWebhookInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid Resend webhook payload", {
        recoverable: false,
        details: parsed.error,
      });
    }

    const { event } = parsed.data;

    try {
      if (event.type === "email.bounced" || event.type === "email.complained") {
        const reason: SuppressionReason =
          event.type === "email.bounced" ? "BOUNCE" : "COMPLAINT";
        const recipients = event.data.to || [];

        for (const recipient of recipients) {
          if (recipient && typeof recipient === "string") {
            const recorded = await this.suppressionHandler.execute({
              email: recipient,
              reason,
            });
            if (!recorded.success) {
              logger.error(
                "Error processing Resend webhook event:",
                recorded.error.details ?? new Error(recorded.error.message)
              );
              return createFailure(
                "STORAGE_UNAVAILABLE",
                "Failed to record bounce or complaint suppression",
                { recoverable: true, details: recorded.error.details }
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
        "Error processing Resend webhook event",
        { recoverable: true, details: err }
      );
    }
  }
}
