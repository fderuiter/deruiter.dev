import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const SubmitCaseStudyFeedbackInputSchema = z.object({
  caseStudySlug: z.string().trim().min(1, "Case study slug is required"),
  takeaways: z.array(z.string()),
  comments: z.string(),
  connectionHash: z.string().min(1, "Connection hash is required"),
  operationKey: z.string().min(1).optional(),
});

export type SubmitCaseStudyFeedbackInput = z.infer<
  typeof SubmitCaseStudyFeedbackInputSchema
>;

export interface SubmittedCaseStudyFeedbackRecord {
  id: string;
  caseStudySlug: string;
  takeaways: string[];
  comments: string;
  createdAt: Date | string;
}

export interface SubmitCaseStudyFeedbackData {
  replayed: boolean;
  message: string;
  feedback: SubmittedCaseStudyFeedbackRecord;
}

export const SubmitCaseStudyFeedbackErrorCode = z.enum([
  "INVALID_FEEDBACK_INPUT",
  "RATE_LIMITED",
  "STORAGE_UNAVAILABLE",
]);

export type SubmitCaseStudyFeedbackErrorCode = z.infer<
  typeof SubmitCaseStudyFeedbackErrorCode
>;

export type SubmitCaseStudyFeedbackResult = ServiceResult<
  SubmitCaseStudyFeedbackData,
  SubmitCaseStudyFeedbackErrorCode
>;

export interface SubmitCaseStudyFeedbackSpec {
  execute(
    input: SubmitCaseStudyFeedbackInput
  ): Promise<SubmitCaseStudyFeedbackResult>;
}
