import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const GetCaseStudyReactionsInputSchema = z.object({
  slug: z.string().trim().min(1, "Slug is required"),
  connectionHash: z.string().min(1, "Connection hash is required"),
});

export type GetCaseStudyReactionsInput = z.infer<
  typeof GetCaseStudyReactionsInputSchema
>;

export interface GetCaseStudyReactionsData {
  caseStudySlug: string;
  counts: Record<string, number>;
  userReactions: string[];
}

export const GetCaseStudyReactionsErrorCode = z.enum([
  "INVALID_REACTION_QUERY",
]);

export type GetCaseStudyReactionsErrorCode = z.infer<
  typeof GetCaseStudyReactionsErrorCode
>;

export type GetCaseStudyReactionsResult = ServiceResult<
  GetCaseStudyReactionsData,
  GetCaseStudyReactionsErrorCode
>;

export interface GetCaseStudyReactionsSpec {
  execute(
    input: GetCaseStudyReactionsInput
  ): Promise<GetCaseStudyReactionsResult>;
}
