import { z } from "zod";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import type { ServiceResult } from "@/lib/services/service-result";
import type { PersistedBlogPostRecord } from "../shared";

export const UpdateDraftBlogPostPatchSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).optional(),
    dek: z.string().optional(),
    body: z.string().min(1).optional(),
    pillar: z.enum(CONTENT_PILLARS).optional(),
    tags: z.array(z.string()).optional(),
    heroImageUrl: z.string().nullable().optional(),
    published: z.boolean().optional(),
  })
  .refine(
    (payload) => Object.values(payload).some((value) => value !== undefined),
    { message: "At least one blog draft field must be provided" }
  );

export const UpdateDraftBlogPostInputSchema = z.object({
  id: z.string().trim().min(1, "Blog post ID is required"),
  updates: UpdateDraftBlogPostPatchSchema,
});

export type UpdateDraftBlogPostInput = z.infer<
  typeof UpdateDraftBlogPostInputSchema
>;

export const UpdateDraftBlogPostErrorCode = z.enum([
  "INVALID_BLOG_DRAFT_UPDATE",
  "EMPTY_DRAFT_UPDATE",
  "BLOG_POST_NOT_FOUND",
  "DUPLICATE_BLOG_SLUG",
  "STORAGE_UNAVAILABLE",
]);

export type UpdateDraftBlogPostErrorCode = z.infer<
  typeof UpdateDraftBlogPostErrorCode
>;

export type UpdateDraftBlogPostResult = ServiceResult<
  PersistedBlogPostRecord,
  UpdateDraftBlogPostErrorCode
>;

export interface UpdateDraftBlogPostSpec {
  execute(input: UpdateDraftBlogPostInput): Promise<UpdateDraftBlogPostResult>;
}
