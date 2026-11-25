import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const EvictBlogPostCacheInputSchema = z.object({
  slug: z.string(),
});

export type EvictBlogPostCacheInput = z.infer<
  typeof EvictBlogPostCacheInputSchema
>;

export interface EvictBlogPostCacheData {
  evicted: boolean;
}

export const EvictBlogPostCacheErrorCode = z.enum(["INVALID_INPUT"]);
export type EvictBlogPostCacheErrorCode = z.infer<
  typeof EvictBlogPostCacheErrorCode
>;

export type EvictBlogPostCacheResult = ServiceResult<
  EvictBlogPostCacheData,
  EvictBlogPostCacheErrorCode
>;

export interface EvictBlogPostCacheSpec {
  execute(input: EvictBlogPostCacheInput): Promise<EvictBlogPostCacheResult>;
}
