import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const GetCaseStudyFeedbackInputSchema = z.object({
  caseStudySlug: z.string().min(1, "caseStudySlug is required"),
  connectionHash: z.string().min(1, "connectionHash is required"),
});

export type GetCaseStudyFeedbackInput = z.infer<
  typeof GetCaseStudyFeedbackInputSchema
>;

export const GetCaseStudyFeedbackErrorCode = z.enum([
  "INVALID_INPUT",
  "STORAGE_UNAVAILABLE",
]);
export type GetCaseStudyFeedbackErrorCode = z.infer<
  typeof GetCaseStudyFeedbackErrorCode
>;

export interface CaseStudyFeedbackItem {
  id: string;
  takeaways: string[];
  comments: string;
  createdAt: Date | string;
}

export interface GetCaseStudyFeedbackData {
  caseStudySlug: string;
  hasSubmitted: boolean;
  totalFeedback: number;
  feedback: CaseStudyFeedbackItem[];
}

export type GetCaseStudyFeedbackResult = ServiceResult<
  GetCaseStudyFeedbackData,
  GetCaseStudyFeedbackErrorCode
>;

/**
 * Service contract for reading persisted visitor feedback on a case study.
 */
export interface GetCaseStudyFeedbackSpec {
  execute(
    input: GetCaseStudyFeedbackInput
  ): Promise<GetCaseStudyFeedbackResult>;
}
