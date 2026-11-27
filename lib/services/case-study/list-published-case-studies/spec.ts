import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { CaseStudyData } from "../shared";

export const ListPublishedCaseStudiesInputSchema = z.object({}).optional();

export type ListPublishedCaseStudiesInput = z.infer<
  typeof ListPublishedCaseStudiesInputSchema
>;

export const ListPublishedCaseStudiesErrorCode = z.enum([
  "INVALID_CASE_STUDY_QUERY",
]);

export type ListPublishedCaseStudiesErrorCode = z.infer<
  typeof ListPublishedCaseStudiesErrorCode
>;

export type ListPublishedCaseStudiesResult = ServiceResult<
  CaseStudyData[],
  ListPublishedCaseStudiesErrorCode
>;

export interface ListPublishedCaseStudiesSpec {
  execute(
    input?: ListPublishedCaseStudiesInput
  ): Promise<ListPublishedCaseStudiesResult>;
}
