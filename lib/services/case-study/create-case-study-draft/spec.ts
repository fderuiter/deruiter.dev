import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { RawCaseStudyRecord } from "../shared";

export const CreateCaseStudyDraftInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  slug: z.string().trim().min(1, "Slug is required"),
  primary_language: z.string().trim().min(1, "Primary language is required"),
  editorial_content: z.string(),
  architectural_narrative: z.string(),
  tags: z.string(),
  github_url: z.string().nullable().optional(),
});

export type CreateCaseStudyDraftInput = z.infer<
  typeof CreateCaseStudyDraftInputSchema
>;

export const CreateCaseStudyDraftErrorCode = z.enum([
  "INVALID_CASE_STUDY_DRAFT",
  "DUPLICATE_CASE_STUDY_SLUG",
  "STORAGE_UNAVAILABLE",
]);

export type CreateCaseStudyDraftErrorCode = z.infer<
  typeof CreateCaseStudyDraftErrorCode
>;

export type CreateCaseStudyDraftResult = ServiceResult<
  RawCaseStudyRecord,
  CreateCaseStudyDraftErrorCode
>;

export interface CreateCaseStudyDraftSpec {
  execute(
    input: CreateCaseStudyDraftInput
  ): Promise<CreateCaseStudyDraftResult>;
}
