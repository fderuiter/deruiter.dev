import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { CaseStudyData } from "../shared";

export const GetCaseStudyBySlugInputSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required"),
});

export type GetCaseStudyBySlugInput = z.infer<
  typeof GetCaseStudyBySlugInputSchema
>;

export const GetCaseStudyBySlugErrorCode = z.enum([
  "INVALID_CASE_STUDY_SLUG",
  "STORAGE_UNAVAILABLE",
]);

export type GetCaseStudyBySlugErrorCode = z.infer<
  typeof GetCaseStudyBySlugErrorCode
>;

export type GetCaseStudyBySlugResult = ServiceResult<
  CaseStudyData | null,
  GetCaseStudyBySlugErrorCode
>;

export interface GetCaseStudyBySlugSpec {
  execute(input: GetCaseStudyBySlugInput): Promise<GetCaseStudyBySlugResult>;
}
