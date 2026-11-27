import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { PersistedBlogPostRecord } from "../shared";

export const ListDraftBlogPostsInputSchema = z.object({
  page: z.number().int().min(1, "Page must be at least 1"),
  pageSize: z
    .number()
    .int()
    .min(1, "Page size must be at least 1")
    .max(100, "Page size must be at most 100"),
});

export type ListDraftBlogPostsInput = z.infer<
  typeof ListDraftBlogPostsInputSchema
>;

export interface ListDraftBlogPostsData {
  drafts: PersistedBlogPostRecord[];
  total: number;
}

export const ListDraftBlogPostsErrorCode = z.enum([
  "INVALID_PAGINATION",
  "STORAGE_UNAVAILABLE",
]);

export type ListDraftBlogPostsErrorCode = z.infer<
  typeof ListDraftBlogPostsErrorCode
>;

export type ListDraftBlogPostsResult = ServiceResult<
  ListDraftBlogPostsData,
  ListDraftBlogPostsErrorCode
>;

export interface ListDraftBlogPostsSpec {
  execute(input: ListDraftBlogPostsInput): Promise<ListDraftBlogPostsResult>;
}
