import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { PersistedBlogPostRecord } from "../shared";

export const GetAdminBlogPostByIdInputSchema = z.object({
  id: z.string().trim().min(1, "Blog post ID is required"),
});

export type GetAdminBlogPostByIdInput = z.infer<
  typeof GetAdminBlogPostByIdInputSchema
>;

export const GetAdminBlogPostByIdErrorCode = z.enum([
  "INVALID_BLOG_POST_ID",
  "BLOG_POST_NOT_FOUND",
  "STORAGE_UNAVAILABLE",
]);

export type GetAdminBlogPostByIdErrorCode = z.infer<
  typeof GetAdminBlogPostByIdErrorCode
>;

export type GetAdminBlogPostByIdResult = ServiceResult<
  PersistedBlogPostRecord,
  GetAdminBlogPostByIdErrorCode
>;

export interface GetAdminBlogPostByIdSpec {
  execute(
    input: GetAdminBlogPostByIdInput
  ): Promise<GetAdminBlogPostByIdResult>;
}
