import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { PersistedBlogPostRecord } from "../shared";

export const GetDraftBlogPostInputSchema = z.object({
  id: z.string().trim().min(1, "Blog draft ID is required"),
});

export type GetDraftBlogPostInput = z.infer<typeof GetDraftBlogPostInputSchema>;

export const GetDraftBlogPostErrorCode = z.enum([
  "INVALID_BLOG_POST_ID",
  "BLOG_POST_NOT_FOUND",
  "STORAGE_UNAVAILABLE",
]);

export type GetDraftBlogPostErrorCode = z.infer<
  typeof GetDraftBlogPostErrorCode
>;

export type GetDraftBlogPostResult = ServiceResult<
  PersistedBlogPostRecord,
  GetDraftBlogPostErrorCode
>;

export interface GetDraftBlogPostSpec {
  execute(input: GetDraftBlogPostInput): Promise<GetDraftBlogPostResult>;
}
