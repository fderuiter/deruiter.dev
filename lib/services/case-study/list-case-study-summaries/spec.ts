import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { CaseStudySearchSummary } from "../shared";

export const ListCaseStudySummariesInputSchema = z.object({}).optional();

export type ListCaseStudySummariesInput = z.infer<
  typeof ListCaseStudySummariesInputSchema
>;

export const ListCaseStudySummariesErrorCode = z.enum([
  "INVALID_CASE_STUDY_SUMMARY_QUERY",
]);

export type ListCaseStudySummariesErrorCode = z.infer<
  typeof ListCaseStudySummariesErrorCode
>;

export type ListCaseStudySummariesResult = ServiceResult<
  CaseStudySearchSummary[],
  ListCaseStudySummariesErrorCode
>;

export interface ListCaseStudySummariesSpec {
  execute(
    input?: ListCaseStudySummariesInput
  ): Promise<ListCaseStudySummariesResult>;
}
