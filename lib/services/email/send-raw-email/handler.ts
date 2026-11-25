import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { generateId } from "@/lib/utils";
import { CheckRecipientEligibilityHandler } from "../check-recipient-eligibility/handler";
import type { CheckRecipientEligibilitySpec } from "../check-recipient-eligibility/spec";
import { QueueOutboundEmailHandler } from "../queue-outbound-email/handler";
import type { QueueOutboundEmailSpec } from "../queue-outbound-email/spec";
import {
  DEFAULT_FROM_EMAIL,
  ELIGIBILITY_DEFERRED_REASON,
  getEffectiveResendApiKey,
  getResendClient,
  isRetryableEmailError,
  shouldSimulateEmailDelivery,
  type RecipientEligibility,
  type ResendClientLike,
} from "../shared";
import {
  SendRawEmailInputSchema,
  type SendRawEmailInput,
  type SendRawEmailResult,
  type SendRawEmailSpec,
} from "./spec";

export interface SendRawEmailDeps {
  checkEligibilityHandler?: CheckRecipientEligibilitySpec;
  queueOutboundEmailHandler?: QueueOutboundEmailSpec;
  getClient?: () => ResendClientLike | null;
  getApiKey?: () => string | undefined;
  shouldSimulate?: (apiKey: string | undefined) => boolean;
  idGenerator?: (prefix: string) => string;
}

/**
 * Handler for dispatching outbound email via Resend SDK, simulated local/preview transport,
 * or persistent `OutboundEmailQueue` fallback on retryable errors and unknown recipient eligibility (#3806).
 */
export class SendRawEmailHandler implements SendRawEmailSpec {
  private readonly checkEligibilityHandler: CheckRecipientEligibilitySpec;
  private readonly queueOutboundEmailHandler: QueueOutboundEmailSpec;
  private readonly getClient: () => ResendClientLike | null;
  private readonly getApiKey: () => string | undefined;
  private readonly shouldSimulate: (apiKey: string | undefined) => boolean;
  private readonly idGenerator: (prefix: string) => string;

  constructor(deps: SendRawEmailDeps = {}) {
    this.checkEligibilityHandler =
      deps.checkEligibilityHandler ?? new CheckRecipientEligibilityHandler();
    this.queueOutboundEmailHandler =
      deps.queueOutboundEmailHandler ?? new QueueOutboundEmailHandler();
    this.getClient = deps.getClient ?? getResendClient;
    this.getApiKey = deps.getApiKey ?? getEffectiveResendApiKey;
    this.shouldSimulate = deps.shouldSimulate ?? shouldSimulateEmailDelivery;
    this.idGenerator = deps.idGenerator ?? generateId;
  }

  private async checkMessageEligibility(
    recipients: string[]
  ): Promise<RecipientEligibility> {
    let unknown: RecipientEligibility | null = null;
    for (const recipient of recipients) {
      const checkRes = await this.checkEligibilityHandler.execute({
        email: recipient,
      });
      if (!checkRes.success) {
        unknown = { status: "unknown", code: "SUPPRESSION_LOOKUP_FAILED" };
        continue;
      }
      if (checkRes.data.status === "suppressed") {
        return checkRes.data;
      }
      if (checkRes.data.status === "unknown") {
        unknown = checkRes.data;
      }
    }
    return unknown ?? { status: "eligible" };
  }

  async execute(input: SendRawEmailInput): Promise<SendRawEmailResult> {
    const parsed = SendRawEmailInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid raw email options",
        { recoverable: false, details: parsed.error }
      );
    }

    const options = parsed.data;
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const client = this.getClient();
    const fromAddress =
      options.from || env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;

    const eligibility = await this.checkMessageEligibility(recipients);
    if (eligibility.status === "suppressed") {
      return createFailure(
        "RECIPIENT_SUPPRESSED",
        `A recipient is suppressed due to previous ${eligibility.reason || "rejection"}.`,
        { recoverable: false, details: { reason: eligibility.reason } }
      );
    }

    if (eligibility.status === "unknown") {
      if (!options.skipQueue) {
        const queuedRes = await this.queueOutboundEmailHandler.execute({
          options,
          fromAddress,
          errorReason: ELIGIBILITY_DEFERRED_REASON,
        });
        if (queuedRes.success) {
          return createSuccess({
            id: queuedRes.data.queueId,
            queued: true,
            deferred: true,
            queueId: queuedRes.data.queueId,
          });
        }
      }
      return createFailure(
        "RECIPIENT_ELIGIBILITY_UNKNOWN",
        "Recipient eligibility is unknown (suppression lookup failed); message not sent or queued.",
        { recoverable: true }
      );
    }

    const apiKey = this.getApiKey();
    if (this.shouldSimulate(apiKey)) {
      const simulatedId = this.idGenerator("sim_msg_");

      if (env.NODE_ENV === "development") {
        logger.info(
          `\x1b[36m[EmailService // Simulated Delivery]\x1b[0m\n  To: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}\n  Subject: ${options.subject}\n  Simulated ID: ${simulatedId}`
        );
      }

      return createSuccess({
        id: simulatedId,
        simulated: true,
      });
    }

    if (!client) {
      const errorMsg =
        "Production email transport is unconfigured (missing or blank RESEND_API_KEY)";
      logger.error(errorMsg);

      if (!options.skipQueue) {
        const queuedRes = await this.queueOutboundEmailHandler.execute({
          options,
          fromAddress,
          errorReason: errorMsg,
        });
        return createFailure("TRANSPORT_UNCONFIGURED", errorMsg, {
          recoverable: true,
          details: {
            queued: queuedRes.success,
            queueId: queuedRes.success ? queuedRes.data.queueId : undefined,
          },
        });
      }

      return createFailure("TRANSPORT_UNCONFIGURED", errorMsg, {
        recoverable: true,
        details: { queued: false },
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
          const queuedRes = await this.queueOutboundEmailHandler.execute({
            options,
            fromAddress,
            errorReason: error.message,
          });
          if (queuedRes.success) {
            return createSuccess({
              id: queuedRes.data.queueId,
              queued: true,
              queueId: queuedRes.data.queueId,
            });
          }
          return createFailure(
            "STORAGE_UNAVAILABLE",
            `${error.message} (retry could not be queued; message not delivered)`,
            { recoverable: true, details: error }
          );
        }

        return createFailure("DELIVERY_FAILED", error.message, {
          recoverable: false,
          details: error,
        });
      }

      return createSuccess({
        id: data?.id || this.idGenerator("msg_"),
      });
    } catch (err) {
      logger.error("EmailService unhandled exception:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error sending email";

      if (isRetryableEmailError(errorMessage) && !options.skipQueue) {
        const queuedRes = await this.queueOutboundEmailHandler.execute({
          options,
          fromAddress,
          errorReason: errorMessage,
        });
        if (queuedRes.success) {
          return createSuccess({
            id: queuedRes.data.queueId,
            queued: true,
            queueId: queuedRes.data.queueId,
          });
        }
        return createFailure(
          "STORAGE_UNAVAILABLE",
          `${errorMessage} (retry could not be queued; message not delivered)`,
          { recoverable: true, details: err }
        );
      }

      return createFailure("DELIVERY_FAILED", errorMessage, {
        recoverable: false,
        details: err,
      });
    }
  }
}
