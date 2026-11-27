import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogPostData } from "../shared";

export const GetPublishedBlogPostInputSchema = z.object({
  slug: z.string(),
});

export type GetPublishedBlogPostInput = z.infer<
  typeof GetPublishedBlogPostInputSchema
>;

export const GetPublishedBlogPostErrorCode = z.enum(["INVALID_BLOG_SLUG"]);

export type GetPublishedBlogPostErrorCode = z.infer<
  typeof GetPublishedBlogPostErrorCode
>;

export type GetPublishedBlogPostResult = ServiceResult<
  BlogPostData | null,
  GetPublishedBlogPostErrorCode
>;

export interface GetPublishedBlogPostSpec {
  execute(
    input: GetPublishedBlogPostInput
  ): Promise<GetPublishedBlogPostResult>;
}
