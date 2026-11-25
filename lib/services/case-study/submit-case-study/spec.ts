import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { CaseStudyDbRowLike } from "../shared";

export const SubmitCaseStudyInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  primary_language: z.string().min(1, "Primary language is required"),
  editorial_content: z.string(),
  architectural_narrative: z.string(),
  tags: z.string(),
  github_url: z.string().nullable().optional(),
});

export type SubmitCaseStudyInput = z.infer<typeof SubmitCaseStudyInputSchema>;

export const SubmitCaseStudyErrorCode = z.enum([
  "INVALID_INPUT",
  "DUPLICATE_SLUG",
  "STORAGE_UNAVAILABLE",
]);
export type SubmitCaseStudyErrorCode = z.infer<typeof SubmitCaseStudyErrorCode>;

export type SubmitCaseStudyResult = ServiceResult<
  CaseStudyDbRowLike,
  SubmitCaseStudyErrorCode
>;

/**
 * Service contract for sanitizing HTML content and persisting a draft case study.
 */
export interface SubmitCaseStudySpec {
  execute(input: SubmitCaseStudyInput): Promise<SubmitCaseStudyResult>;
}
