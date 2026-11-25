import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogPostDbRecord } from "../shared";

export const GetAllBlogPostsAdminInputSchema = z
  .object({})
  .optional()
  .default({});

export type GetAllBlogPostsAdminInput = z.infer<
  typeof GetAllBlogPostsAdminInputSchema
>;

export const GetAllBlogPostsAdminErrorCode = z.enum([
  "INVALID_INPUT",
  "STORAGE_UNAVAILABLE",
]);
export type GetAllBlogPostsAdminErrorCode = z.infer<
  typeof GetAllBlogPostsAdminErrorCode
>;

export type GetAllBlogPostsAdminResult = ServiceResult<
  BlogPostDbRecord[],
  GetAllBlogPostsAdminErrorCode
>;

/**
 * Service contract for retrieving all persisted blog posts (published and drafts) for the admin console.
 */
export interface GetAllBlogPostsAdminSpec {
  execute(
    input?: GetAllBlogPostsAdminInput
  ): Promise<GetAllBlogPostsAdminResult>;
}
