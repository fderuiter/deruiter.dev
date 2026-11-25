import { z } from "zod";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogPostDbRecord } from "../shared";

export const UpdateDraftBlogPostPatchSchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  dek: z.string().optional(),
  body: z.string().optional(),
  pillar: z.enum(CONTENT_PILLARS).optional(),
  tags: z.array(z.string()).optional(),
  heroImageUrl: z.string().nullable().optional(),
  published: z.boolean().optional(),
});

export const UpdateDraftBlogPostInputSchema = z.object({
  id: z.string().min(1, "Blog post ID is required"),
  patch: UpdateDraftBlogPostPatchSchema,
});

export type UpdateDraftBlogPostInput = z.infer<
  typeof UpdateDraftBlogPostInputSchema
>;

export const UpdateDraftBlogPostErrorCode = z.enum([
  "INVALID_INPUT",
  "NOT_FOUND",
  "CONFLICT",
  "STORAGE_UNAVAILABLE",
]);
export type UpdateDraftBlogPostErrorCode = z.infer<
  typeof UpdateDraftBlogPostErrorCode
>;

export type UpdateDraftBlogPostResult = ServiceResult<
  BlogPostDbRecord,
  UpdateDraftBlogPostErrorCode
>;

/**
 * Service contract for applying a partial edit or publish transition to a blog post or draft.
 */
export interface UpdateDraftBlogPostSpec {
  execute(input: UpdateDraftBlogPostInput): Promise<UpdateDraftBlogPostResult>;
}
