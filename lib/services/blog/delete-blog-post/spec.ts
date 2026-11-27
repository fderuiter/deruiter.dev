import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { PersistedBlogPostRecord } from "../shared";

export const DeleteBlogPostInputSchema = z.object({
  id: z.string().trim().min(1, "Blog post ID is required"),
});

export type DeleteBlogPostInput = z.infer<typeof DeleteBlogPostInputSchema>;

export const DeleteBlogPostErrorCode = z.enum([
  "INVALID_BLOG_POST_ID",
  "BLOG_POST_NOT_FOUND",
  "STORAGE_UNAVAILABLE",
]);

export type DeleteBlogPostErrorCode = z.infer<typeof DeleteBlogPostErrorCode>;

export type DeleteBlogPostResult = ServiceResult<
  PersistedBlogPostRecord,
  DeleteBlogPostErrorCode
>;

export interface DeleteBlogPostSpec {
  execute(input: DeleteBlogPostInput): Promise<DeleteBlogPostResult>;
}
