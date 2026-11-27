import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const GetCaseStudyFeedbackInputSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required"),
  connectionHash: z.string().min(1, "Connection hash is required"),
});

export type GetCaseStudyFeedbackInput = z.infer<
  typeof GetCaseStudyFeedbackInputSchema
>;

export interface CaseStudyFeedbackItem {
  id: string;
  takeaways: unknown;
  comments: string;
  createdAt: Date | string;
}

export interface GetCaseStudyFeedbackData {
  caseStudySlug: string;
  hasSubmitted: boolean;
  totalFeedback: number;
  feedback: CaseStudyFeedbackItem[];
}

export const GetCaseStudyFeedbackErrorCode = z.enum([
  "INVALID_FEEDBACK_QUERY",
  "STORAGE_UNAVAILABLE",
]);

export type GetCaseStudyFeedbackErrorCode = z.infer<
  typeof GetCaseStudyFeedbackErrorCode
>;

export type GetCaseStudyFeedbackResult = ServiceResult<
  GetCaseStudyFeedbackData,
  GetCaseStudyFeedbackErrorCode
>;

export interface GetCaseStudyFeedbackSpec {
  execute(
    input: GetCaseStudyFeedbackInput
  ): Promise<GetCaseStudyFeedbackResult>;
}
