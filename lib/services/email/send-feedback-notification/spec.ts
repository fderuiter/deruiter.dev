import { z } from "zod";
import type { FeedbackNotificationPayload } from "@/lib/email-templates";
import type { ServiceResult } from "../../service-result";
import {
  SendRawEmailErrorCode,
  type SendRawEmailOutput,
} from "../send-raw-email/spec";

export const SendFeedbackNotificationInputSchema = z.object({
  caseStudySlug: z.string().trim().min(1),
  takeaways: z.array(z.string()),
  comments: z.string(),
  submittedAt: z.date().optional(),
  connectionHash: z.string().optional(),
});

export type SendFeedbackNotificationInput = FeedbackNotificationPayload;

export const SendFeedbackNotificationErrorCode = SendRawEmailErrorCode;
export type SendFeedbackNotificationErrorCode = z.infer<
  typeof SendFeedbackNotificationErrorCode
>;

export type SendFeedbackNotificationResult = ServiceResult<
  SendRawEmailOutput,
  SendFeedbackNotificationErrorCode
>;

export interface SendFeedbackNotificationSpec {
  execute(
    input: SendFeedbackNotificationInput
  ): Promise<SendFeedbackNotificationResult>;
}
