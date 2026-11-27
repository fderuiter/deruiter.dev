import { env, getEnv } from "@/lib/env";
import { createFailure } from "../../service-result";
import {
  SendRawEmailHandler,
  type SendRawEmailDeps,
} from "../send-raw-email/handler";
import type { SendRawEmailSpec } from "../send-raw-email/spec";
import {
  SendFeedbackNotificationInputSchema,
  type SendFeedbackNotificationInput,
  type SendFeedbackNotificationResult,
  type SendFeedbackNotificationSpec,
} from "./spec";

export interface SendFeedbackNotificationDeps extends SendRawEmailDeps {
  sendRawEmailHandler?: SendRawEmailSpec;
}

export class SendFeedbackNotificationHandler implements SendFeedbackNotificationSpec {
  private readonly sendRawHandler: SendRawEmailSpec;

  constructor(deps?: SendFeedbackNotificationDeps) {
    this.sendRawHandler =
      deps?.sendRawEmailHandler ?? new SendRawEmailHandler(deps);
  }

  async execute(
    input: SendFeedbackNotificationInput
  ): Promise<SendFeedbackNotificationResult> {
    const parsed = SendFeedbackNotificationInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        "Invalid feedback notification payload",
        { recoverable: false, details: parsed.error }
      );
    }

    try {
      const { renderFeedbackNotificationEmail } =
        await import("@/lib/email-templates");
      const template = renderFeedbackNotificationEmail(parsed.data);
      const adminEmail =
        getEnv().CONTACT_NOTIFICATION_EMAIL ||
        env.CONTACT_NOTIFICATION_EMAIL ||
        "fpderuiter@gmail.com";

      return await this.sendRawHandler.execute({
        to: adminEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
        tags: [
          { name: "category", value: "case-study-feedback" },
          { name: "case-study", value: parsed.data.caseStudySlug },
        ],
      });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to send feedback notification email",
        { recoverable: true, details: error }
      );
    }
  }
}
