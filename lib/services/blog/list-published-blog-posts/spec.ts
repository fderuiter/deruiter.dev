import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogPostData } from "../shared";

export const ListPublishedBlogPostsInputSchema = z.object({}).optional();

export type ListPublishedBlogPostsInput = z.infer<
  typeof ListPublishedBlogPostsInputSchema
>;

export const ListPublishedBlogPostsErrorCode = z.enum(["INVALID_BLOG_QUERY"]);

export type ListPublishedBlogPostsErrorCode = z.infer<
  typeof ListPublishedBlogPostsErrorCode
>;

export type ListPublishedBlogPostsResult = ServiceResult<
  BlogPostData[],
  ListPublishedBlogPostsErrorCode
>;

export interface ListPublishedBlogPostsSpec {
  execute(
    input?: ListPublishedBlogPostsInput
  ): Promise<ListPublishedBlogPostsResult>;
}
