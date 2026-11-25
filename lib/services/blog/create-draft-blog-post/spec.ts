import { z } from "zod";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import type { ServiceResult } from "@/lib/services/service-result";
import type { BlogPostDbRecord } from "../shared";

export const CreateDraftBlogPostInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  dek: z.string(),
  body: z.string(),
  pillar: z.enum(CONTENT_PILLARS),
  tags: z.string(),
  hero_image_url: z.string().nullable(),
});

export type CreateDraftBlogPostInput = z.infer<
  typeof CreateDraftBlogPostInputSchema
>;

export const CreateDraftBlogPostErrorCode = z.enum([
  "INVALID_INPUT",
  "CONFLICT",
  "STORAGE_UNAVAILABLE",
]);
export type CreateDraftBlogPostErrorCode = z.infer<
  typeof CreateDraftBlogPostErrorCode
>;

export type CreateDraftBlogPostResult = ServiceResult<
  BlogPostDbRecord,
  CreateDraftBlogPostErrorCode
>;

/**
 * Service contract for sanitizing body HTML and persisting a new unpublished blog draft.
 */
export interface CreateDraftBlogPostSpec {
  execute(input: CreateDraftBlogPostInput): Promise<CreateDraftBlogPostResult>;
}
