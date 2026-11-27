import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { generateId } from "@/lib/utils";
import { createFailure, createSuccess } from "../../service-result";
import {
  CheckRecipientEligibilityHandler,
  type CheckRecipientEligibilityPrismaPort,
} from "../check-recipient-eligibility/handler";
import type { CheckRecipientEligibilitySpec } from "../check-recipient-eligibility/spec";
import {
  EnqueueEmailHandler,
  type EnqueueEmailPrismaPort,
} from "../enqueue-email/handler";
import type { EnqueueEmailSpec } from "../enqueue-email/spec";
import {
  DEFAULT_FROM_EMAIL,
  ELIGIBILITY_DEFERRED_REASON,
  getEffectiveResendApiKey,
  getResendClient,
  isRetryableEmailError,
  shouldSimulateEmailDelivery,
  type ResendTransportPort,
} from "../shared";
import {
  SendRawEmailInputSchema,
  type SendRawEmailInput,
  type SendRawEmailResult,
  type SendRawEmailSpec,
} from "./spec";

export interface SendRawEmailDeps {
  eligibilityHandler?: CheckRecipientEligibilitySpec;
  enqueueHandler?: EnqueueEmailSpec;
  prisma?: CheckRecipientEligibilityPrismaPort & EnqueueEmailPrismaPort;
  getClient?: () => ResendTransportPort | null;
  getApiKey?: () => string | undefined;
}

export class SendRawEmailHandler implements SendRawEmailSpec {
  private readonly eligibilityHandler: CheckRecipientEligibilitySpec;
  private readonly enqueueHandler: EnqueueEmailSpec;
  private readonly resolveClient: () => ResendTransportPort | null;
  private readonly resolveApiKey: () => string | undefined;

  constructor(deps?: SendRawEmailDeps) {
    this.eligibilityHandler =
      deps?.eligibilityHandler ??
      new CheckRecipientEligibilityHandler({ prisma: deps?.prisma });
    this.enqueueHandler =
      deps?.enqueueHandler ?? new EnqueueEmailHandler({ prisma: deps?.prisma });
    this.resolveClient = deps?.getClient ?? getResendClient;
    this.resolveApiKey = deps?.getApiKey ?? getEffectiveResendApiKey;
  }

  async execute(input: SendRawEmailInput): Promise<SendRawEmailResult> {
    const parsed = SendRawEmailInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid outbound email payload", {
        recoverable: false,
        details: parsed.error,
      });
    }

    const options = parsed.data;
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const fromAddress =
      options.from || env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;

    try {
      const eligibilityResult = await this.eligibilityHandler.execute({
        recipients,
      });
      if (!eligibilityResult.success) {
        return createFailure("INVALID_INPUT", eligibilityResult.error.message, {
          recoverable: false,
        });
      }

      const eligibility = eligibilityResult.data;
      if (eligibility.status === "suppressed") {
        return createFailure(
          "RECIPIENT_SUPPRESSED",
          `A recipient is suppressed due to previous ${eligibility.reason || "rejection"}.`,
          { recoverable: false }
        );
      }

      if (eligibility.status === "unknown") {
        if (!options.skipQueue) {
          const queued = await this.enqueueHandler.execute({
            options,
            mode: "retry",
            fromAddress,
            errorReason: ELIGIBILITY_DEFERRED_REASON,
          });
          if (queued.success) {
            return createSuccess({
              id: queued.data.queueId,
              queued: true,
              deferred: true,
              queueId: queued.data.queueId,
            });
          }
        }
        return createFailure(
          "RECIPIENT_ELIGIBILITY_UNKNOWN",
          "Recipient eligibility is unknown (suppression lookup failed); message not sent or queued.",
          { recoverable: true }
        );
      }

      const apiKey = this.resolveApiKey();
      if (shouldSimulateEmailDelivery(apiKey)) {
        const simulatedId = generateId("sim_msg_");
        if (env.NODE_ENV === "development") {
          logger.info(
            `\x1b[36m[EmailService // Simulated Delivery]\x1b[0m\n  To: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}\n  Subject: ${options.subject}\n  Simulated ID: ${simulatedId}`
          );
        }
        return createSuccess({ id: simulatedId, simulated: true });
      }

      const client = this.resolveClient();
      if (!client) {
        const errorMsg =
          "Production email transport is unconfigured (missing or blank RESEND_API_KEY)";
        logger.error(errorMsg);

        if (!options.skipQueue) {
          const queued = await this.enqueueHandler.execute({
            options,
            mode: "retry",
            fromAddress,
            errorReason: errorMsg,
          });
          return createFailure("TRANSPORT_UNCONFIGURED", errorMsg, {
            recoverable: true,
            details: {
              queued: queued.success,
              queueId: queued.success ? queued.data.queueId : undefined,
            },
          });
        }

        return createFailure("TRANSPORT_UNCONFIGURED", errorMsg, {
          recoverable: true,
        });
      }

      try {
        const { data, error } = await client.emails.send({
          from: fromAddress,
          to: options.to,
          replyTo: options.replyTo,
          subject: options.subject,
          html: options.html,
          text: options.text,
          tags: options.tags,
          headers: options.headers,
        });

        if (error) {
          logger.error(
            "Resend API error:",
            new Error(`Resend dispatch error: ${error.message}`)
          );

          if (isRetryableEmailError(error.message) && !options.skipQueue) {
            const queued = await this.enqueueHandler.execute({
              options,
              mode: "retry",
              fromAddress,
              errorReason: error.message,
            });
            if (queued.success) {
              return createSuccess({
                id: queued.data.queueId,
                queued: true,
                queueId: queued.data.queueId,
              });
            }
            return createFailure(
              "STORAGE_UNAVAILABLE",
              `${error.message} (retry could not be queued; message not delivered)`,
              { recoverable: true }
            );
          }

          return createFailure("PROVIDER_REJECTED", error.message, {
            recoverable: false,
          });
        }

        return createSuccess({
          id: data?.id || generateId("msg_"),
        });
      } catch (err) {
        logger.error("EmailService unhandled exception:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error sending email";

        if (isRetryableEmailError(errorMessage) && !options.skipQueue) {
          const queued = await this.enqueueHandler.execute({
            options,
            mode: "retry",
            fromAddress,
            errorReason: errorMessage,
          });
          if (queued.success) {
            return createSuccess({
              id: queued.data.queueId,
              queued: true,
              queueId: queued.data.queueId,
            });
          }
          return createFailure(
            "STORAGE_UNAVAILABLE",
            `${errorMessage} (retry could not be queued; message not delivered)`,
            { recoverable: true, details: err }
          );
        }

        return createFailure("PROVIDER_REJECTED", errorMessage, {
          recoverable: false,
          details: err,
        });
      }
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Unexpected outbound email dispatch failure",
        { recoverable: true, details: error }
      );
    }
  }
}
