import { env, getEnv } from "@/lib/env";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { SendRawEmailHandler } from "../send-raw-email/handler";
import type { SendRawEmailSpec } from "../send-raw-email/spec";
import {
  SendContactInquiryInputSchema,
  type SendContactInquiryInput,
  type SendContactInquiryResult,
  type SendContactInquirySpec,
} from "./spec";

export interface SendContactInquiryDeps {
  sendRawEmailHandler?: SendRawEmailSpec;
}

/**
 * Handler for dispatching an inbound visitor inquiry to the administrator and sending an automated confirmation receipt.
 * Lazily imports HTML email templates so `lib/services/index.ts` avoids loading DOMPurify at cold start.
 */
export class SendContactInquiryHandler implements SendContactInquirySpec {
  private readonly sendRawEmailHandler: SendRawEmailSpec;

  constructor(deps: SendContactInquiryDeps = {}) {
    this.sendRawEmailHandler =
      deps.sendRawEmailHandler ?? new SendRawEmailHandler();
  }

  async execute(
    input: SendContactInquiryInput
  ): Promise<SendContactInquiryResult> {
    const parsed = SendContactInquiryInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid contact inquiry payload",
        { recoverable: false, details: parsed.error }
      );
    }

    const { submission, connectionHash } = parsed.data;

    try {
      const { renderContactAdminEmail, renderContactConfirmationEmail } =
        await import("@/lib/email-templates");

      const adminTemplate = renderContactAdminEmail({
        name: submission.name,
        email: submission.email,
        intent: submission.intent,
        subject: submission.subject,
        message: submission.message,
        connectionHash,
        submittedAt: new Date(),
      });

      const adminEmail =
        getEnv().CONTACT_NOTIFICATION_EMAIL ||
        env.CONTACT_NOTIFICATION_EMAIL ||
        "fpderuiter@gmail.com";

      const adminResult = await this.sendRawEmailHandler.execute({
        to: adminEmail,
        replyTo: `${submission.name} <${submission.email}>`,
        subject: adminTemplate.subject,
        html: adminTemplate.html,
        text: adminTemplate.text,
        tags: [
          { name: "category", value: "contact-inquiry" },
          { name: "intent", value: submission.intent },
        ],
      });

      const confirmationTemplate = renderContactConfirmationEmail({
        name: submission.name,
        intent: submission.intent,
        subject: submission.subject,
        message: submission.message,
      });

      const confirmationResult = await this.sendRawEmailHandler.execute({
        to: submission.email,
        replyTo: adminEmail,
        subject: confirmationTemplate.subject,
        html: confirmationTemplate.html,
        text: confirmationTemplate.text,
        tags: [{ name: "category", value: "contact-confirmation" }],
      });

      if (!adminResult.success) {
        return createFailure(
          adminResult.error.code,
          adminResult.error.message,
          {
            recoverable: adminResult.error.recoverable,
            details: { adminResult, confirmationResult },
          }
        );
      }

      return createSuccess({
        messageId: adminResult.data.id,
        simulated: adminResult.data.simulated,
        adminResult,
        confirmationResult,
      });
    } catch (error) {
      return createFailure(
        "DELIVERY_FAILED",
        error instanceof Error
          ? error.message
          : "Failed to dispatch contact inquiry",
        { recoverable: true, details: error }
      );
    }
  }
}
