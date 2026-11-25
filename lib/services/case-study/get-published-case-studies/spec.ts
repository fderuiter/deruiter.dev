import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { CaseStudySearchSummary } from "../shared";

export const GetPublishedCaseStudiesInputSchema = z
  .object({})
  .optional()
  .default({});

export type GetPublishedCaseStudiesInput = z.infer<
  typeof GetPublishedCaseStudiesInputSchema
>;

export const GetPublishedCaseStudiesErrorCode = z.enum([
  "INVALID_INPUT",
  "STORAGE_UNAVAILABLE",
]);
export type GetPublishedCaseStudiesErrorCode = z.infer<
  typeof GetPublishedCaseStudiesErrorCode
>;

export type GetPublishedCaseStudiesResult = ServiceResult<
  CaseStudySearchSummary[],
  GetPublishedCaseStudiesErrorCode
>;

/**
 * Service contract for retrieving lightweight published case study search summaries.
 */
export interface GetPublishedCaseStudiesSpec {
  execute(
    input?: GetPublishedCaseStudiesInput
  ): Promise<GetPublishedCaseStudiesResult>;
}
