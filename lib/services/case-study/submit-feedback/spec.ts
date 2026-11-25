import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const SubmitCaseStudyFeedbackInputSchema = z.object({
  caseStudySlug: z.string().min(1, "caseStudySlug is required"),
  takeaways: z.array(z.string()),
  comments: z.string(),
  connectionHash: z.string().min(1, "connectionHash is required"),
  operationKey: z.string().optional(),
});

export type SubmitCaseStudyFeedbackInput = z.infer<
  typeof SubmitCaseStudyFeedbackInputSchema
>;

export const SubmitCaseStudyFeedbackErrorCode = z.enum([
  "INVALID_INPUT",
  "RATE_LIMITED",
  "STORAGE_UNAVAILABLE",
]);
export type SubmitCaseStudyFeedbackErrorCode = z.infer<
  typeof SubmitCaseStudyFeedbackErrorCode
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

export type SubmitCaseStudyFeedbackResult = ServiceResult<
  SubmitCaseStudyFeedbackData,
  SubmitCaseStudyFeedbackErrorCode
>;

/**
 * Service contract for persisting visitor feedback on a case study with idempotency replay and duplicate rate-limiting.
 */
export interface SubmitCaseStudyFeedbackSpec {
  execute(
    input: SubmitCaseStudyFeedbackInput
  ): Promise<SubmitCaseStudyFeedbackResult>;
}
