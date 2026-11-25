import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { CaseStudyData } from "../shared";

export const GetCaseStudyBySlugInputSchema = z.object({
  slug: z.string(),
  allowFallbackOnError: z.boolean().optional().default(true),
});

export type GetCaseStudyBySlugInput = z.input<
  typeof GetCaseStudyBySlugInputSchema
>;

export const GetCaseStudyBySlugErrorCode = z.enum([
  "INVALID_INPUT",
  "STORAGE_UNAVAILABLE",
]);
export type GetCaseStudyBySlugErrorCode = z.infer<
  typeof GetCaseStudyBySlugErrorCode
>;

export type GetCaseStudyBySlugResult = ServiceResult<
  CaseStudyData | null,
  GetCaseStudyBySlugErrorCode
>;

/**
 * Service contract for retrieving a single published case study by slug with Two-Tier Compute Shield caching.
 */
export interface GetCaseStudyBySlugSpec {
  execute(input: GetCaseStudyBySlugInput): Promise<GetCaseStudyBySlugResult>;
}
