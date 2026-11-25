import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogPostDbRecord } from "../shared";

export const GetDraftBlogPostsInputSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type GetDraftBlogPostsInput = z.infer<
  typeof GetDraftBlogPostsInputSchema
>;

export const GetDraftBlogPostsErrorCode = z.enum([
  "INVALID_INPUT",
  "STORAGE_UNAVAILABLE",
]);
export type GetDraftBlogPostsErrorCode = z.infer<
  typeof GetDraftBlogPostsErrorCode
>;

export interface GetDraftBlogPostsData {
  drafts: BlogPostDbRecord[];
  total: number;
}

export type GetDraftBlogPostsResult = ServiceResult<
  GetDraftBlogPostsData,
  GetDraftBlogPostsErrorCode
>;

/**
 * Service contract for retrieving paginated unpublished blog drafts for admin authoring.
 */
export interface GetDraftBlogPostsSpec {
  execute(input: GetDraftBlogPostsInput): Promise<GetDraftBlogPostsResult>;
}
