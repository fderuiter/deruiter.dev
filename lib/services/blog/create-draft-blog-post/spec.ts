import { z } from "zod";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import type { ServiceResult } from "@/lib/services/service-result";
import type { PersistedBlogPostRecord } from "../shared";

export const CreateDraftBlogPostInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  slug: z.string().trim().min(1, "Slug is required"),
  dek: z.string(),
  body: z.string().min(1, "Body is required"),
  pillar: z.enum(CONTENT_PILLARS),
  tags: z.string(),
  hero_image_url: z.string().nullable(),
});

export type CreateDraftBlogPostInput = z.infer<
  typeof CreateDraftBlogPostInputSchema
>;

export const CreateDraftBlogPostErrorCode = z.enum([
  "INVALID_BLOG_DRAFT",
  "DUPLICATE_BLOG_SLUG",
  "STORAGE_UNAVAILABLE",
]);

export type CreateDraftBlogPostErrorCode = z.infer<
  typeof CreateDraftBlogPostErrorCode
>;

export type CreateDraftBlogPostResult = ServiceResult<
  PersistedBlogPostRecord,
  CreateDraftBlogPostErrorCode
>;

export interface CreateDraftBlogPostSpec {
  execute(input: CreateDraftBlogPostInput): Promise<CreateDraftBlogPostResult>;
}
