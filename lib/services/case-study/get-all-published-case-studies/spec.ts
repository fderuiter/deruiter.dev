import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { CaseStudyData } from "../shared";

export const GetAllPublishedCaseStudiesInputSchema = z
  .object({})
  .optional()
  .default({});

export type GetAllPublishedCaseStudiesInput = z.infer<
  typeof GetAllPublishedCaseStudiesInputSchema
>;

export const GetAllPublishedCaseStudiesErrorCode = z.enum([
  "INVALID_INPUT",
  "STORAGE_UNAVAILABLE",
]);
export type GetAllPublishedCaseStudiesErrorCode = z.infer<
  typeof GetAllPublishedCaseStudiesErrorCode
>;

export type GetAllPublishedCaseStudiesResult = ServiceResult<
  CaseStudyData[],
  GetAllPublishedCaseStudiesErrorCode
>;

/**
 * Service contract for retrieving all published case studies with Redis read-through caching and static fallback merge.
 */
export interface GetAllPublishedCaseStudiesSpec {
  execute(
    input?: GetAllPublishedCaseStudiesInput
  ): Promise<GetAllPublishedCaseStudiesResult>;
}
