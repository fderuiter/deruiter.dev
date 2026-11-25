import { z } from "zod";
import type { FeedbackNotificationPayload } from "@/lib/email-templates";
import type { ServiceResult } from "@/lib/services/service-result";
import type {
  SendRawEmailData,
  SendRawEmailErrorCode,
} from "../send-raw-email/spec";

export const SendFeedbackNotificationInputSchema = z.object({
  caseStudySlug: z.string().min(1, "Case study slug is required"),
  caseStudyTitle: z.string().optional(),
  takeaways: z.array(z.string()),
  comments: z.string(),
  connectionHash: z.string().optional(),
  submittedAt: z.date().optional(),
});

export type SendFeedbackNotificationInput = FeedbackNotificationPayload;
export type SendFeedbackNotificationErrorCode = SendRawEmailErrorCode;
export type SendFeedbackNotificationResult = ServiceResult<
  SendRawEmailData,
  SendFeedbackNotificationErrorCode
>;

export interface SendFeedbackNotificationSpec {
  execute(
    input: SendFeedbackNotificationInput
  ): Promise<SendFeedbackNotificationResult>;
}
