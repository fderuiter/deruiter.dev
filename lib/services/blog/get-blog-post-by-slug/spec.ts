import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogPostData } from "../shared";

export const GetBlogPostBySlugInputSchema = z.object({
  slug: z.string(),
});

export type GetBlogPostBySlugInput = z.infer<
  typeof GetBlogPostBySlugInputSchema
>;

export const GetBlogPostBySlugErrorCode = z.enum([
  "NOT_FOUND",
  "INVALID_INPUT",
]);
export type GetBlogPostBySlugErrorCode = z.infer<
  typeof GetBlogPostBySlugErrorCode
>;

export type GetBlogPostBySlugResult = ServiceResult<
  BlogPostData,
  GetBlogPostBySlugErrorCode
>;

export interface GetBlogPostBySlugSpec {
  execute(input: GetBlogPostBySlugInput): Promise<GetBlogPostBySlugResult>;
}
