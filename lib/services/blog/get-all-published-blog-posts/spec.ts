import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogPostData } from "../shared";

export const GetAllPublishedBlogPostsInputSchema = z
  .object({})
  .optional()
  .default({});

export type GetAllPublishedBlogPostsInput = z.input<
  typeof GetAllPublishedBlogPostsInputSchema
>;

export const GetAllPublishedBlogPostsErrorCode = z.enum(["INVALID_INPUT"]);
export type GetAllPublishedBlogPostsErrorCode = z.infer<
  typeof GetAllPublishedBlogPostsErrorCode
>;

export type GetAllPublishedBlogPostsResult = ServiceResult<
  BlogPostData[],
  GetAllPublishedBlogPostsErrorCode
>;

export interface GetAllPublishedBlogPostsSpec {
  execute(
    input?: GetAllPublishedBlogPostsInput
  ): Promise<GetAllPublishedBlogPostsResult>;
}
