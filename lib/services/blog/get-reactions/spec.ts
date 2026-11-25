import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const GetBlogReactionsInputSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  connectionHash: z.string().min(1, "Connection hash is required"),
});

export type GetBlogReactionsInput = z.infer<typeof GetBlogReactionsInputSchema>;

export interface GetBlogReactionsData {
  blogPostSlug: string;
  counts: Record<string, number>;
  userReactions: string[];
}

export const GetBlogReactionsErrorCode = z.enum(["INVALID_INPUT"]);
export type GetBlogReactionsErrorCode = z.infer<
  typeof GetBlogReactionsErrorCode
>;

export type GetBlogReactionsResult = ServiceResult<
  GetBlogReactionsData,
  GetBlogReactionsErrorCode
>;

export interface GetBlogReactionsSpec {
  execute(input: GetBlogReactionsInput): Promise<GetBlogReactionsResult>;
}
