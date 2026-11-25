import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogPostDbRecord } from "../shared";

export const GetBlogPostByIdInputSchema = z.object({
  id: z.string().min(1, "Blog post ID is required"),
});

export type GetBlogPostByIdInput = z.infer<typeof GetBlogPostByIdInputSchema>;

export const GetBlogPostByIdErrorCode = z.enum([
  "INVALID_INPUT",
  "NOT_FOUND",
  "STORAGE_UNAVAILABLE",
]);
export type GetBlogPostByIdErrorCode = z.infer<typeof GetBlogPostByIdErrorCode>;

export type GetBlogPostByIdResult = ServiceResult<
  BlogPostDbRecord,
  GetBlogPostByIdErrorCode
>;

/**
 * Service contract for retrieving a persisted blog post (published or draft) by ID for admin authoring.
 */
export interface GetBlogPostByIdSpec {
  execute(input: GetBlogPostByIdInput): Promise<GetBlogPostByIdResult>;
}
