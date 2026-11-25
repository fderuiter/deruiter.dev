import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogPostDbRecord } from "../shared";

export const DeleteBlogPostInputSchema = z.object({
  id: z.string().min(1, "Blog post ID is required"),
});

export type DeleteBlogPostInput = z.infer<typeof DeleteBlogPostInputSchema>;

export const DeleteBlogPostErrorCode = z.enum([
  "INVALID_INPUT",
  "NOT_FOUND",
  "STORAGE_UNAVAILABLE",
]);
export type DeleteBlogPostErrorCode = z.infer<typeof DeleteBlogPostErrorCode>;

export type DeleteBlogPostResult = ServiceResult<
  BlogPostDbRecord,
  DeleteBlogPostErrorCode
>;

/**
 * Service contract for deleting a persisted blog post or draft by ID and evicting associated caches.
 */
export interface DeleteBlogPostSpec {
  execute(input: DeleteBlogPostInput): Promise<DeleteBlogPostResult>;
}
