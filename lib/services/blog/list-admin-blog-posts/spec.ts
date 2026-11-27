import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";
import type { PersistedBlogPostRecord } from "../shared";

export const ListAdminBlogPostsInputSchema = z.object({}).optional();

export type ListAdminBlogPostsInput = z.infer<
  typeof ListAdminBlogPostsInputSchema
>;

export const ListAdminBlogPostsErrorCode = z.enum(["STORAGE_UNAVAILABLE"]);

export type ListAdminBlogPostsErrorCode = z.infer<
  typeof ListAdminBlogPostsErrorCode
>;

export type ListAdminBlogPostsResult = ServiceResult<
  PersistedBlogPostRecord[],
  ListAdminBlogPostsErrorCode
>;

export interface ListAdminBlogPostsSpec {
  execute(input?: ListAdminBlogPostsInput): Promise<ListAdminBlogPostsResult>;
}
