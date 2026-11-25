import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogPostDbRecord } from "../shared";

export const GetDraftBlogPostByIdInputSchema = z.object({
  id: z.string().min(1, "Blog draft ID is required"),
});

export type GetDraftBlogPostByIdInput = z.infer<
  typeof GetDraftBlogPostByIdInputSchema
>;

export const GetDraftBlogPostByIdErrorCode = z.enum([
  "INVALID_INPUT",
  "NOT_FOUND",
  "STORAGE_UNAVAILABLE",
]);
export type GetDraftBlogPostByIdErrorCode = z.infer<
  typeof GetDraftBlogPostByIdErrorCode
>;

export type GetDraftBlogPostByIdResult = ServiceResult<
  BlogPostDbRecord,
  GetDraftBlogPostByIdErrorCode
>;

/**
 * Service contract for retrieving an unpublished blog draft by ID.
 */
export interface GetDraftBlogPostByIdSpec {
  execute(
    input: GetDraftBlogPostByIdInput
  ): Promise<GetDraftBlogPostByIdResult>;
}
