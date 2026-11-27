import { env, getEnv } from "@/lib/env";
import { createFailure, createSuccess } from "../../service-result";
import {
  SendRawEmailHandler,
  type SendRawEmailDeps,
} from "../send-raw-email/handler";
import type { SendRawEmailSpec } from "../send-raw-email/spec";
import {
  SendContactInquiryInputSchema,
  type SendContactInquiryInput,
  type SendContactInquiryResult,
  type SendContactInquirySpec,
} from "./spec";

export interface SendContactInquiryDeps extends SendRawEmailDeps {
  sendRawEmailHandler?: SendRawEmailSpec;
}

export class SendContactInquiryHandler implements SendContactInquirySpec {
  private readonly sendRawHandler: SendRawEmailSpec;

  constructor(deps?: SendContactInquiryDeps) {
    this.sendRawHandler =
      deps?.sendRawEmailHandler ?? new SendRawEmailHandler(deps);
  }

  async execute(
    input: SendContactInquiryInput
  ): Promise<SendContactInquiryResult> {
    const parsed = SendContactInquiryInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        "Invalid contact inquiry submission",
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

      const adminResult = await this.sendRawHandler.execute({
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

      const confirmationResult = await this.sendRawHandler.execute({
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
            details: {
              adminError: adminResult.error,
              confirmationResult,
            },
          }
        );
      }

      return createSuccess({
        adminDelivery: adminResult.data,
        confirmationResult,
      });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to dispatch contact inquiry emails",
        { recoverable: true, details: error }
      );
    }
  }
}
