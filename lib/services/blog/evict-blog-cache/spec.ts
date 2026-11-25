import { z } from "zod";
import type { ServiceResult } from "@/lib/services/service-result";

export const EvictBlogCacheInputSchema = z.object({
  slug: z.string(),
});

export type EvictBlogCacheInput = z.infer<typeof EvictBlogCacheInputSchema>;

export interface EvictBlogCacheData {
  evicted: boolean;
}

export const EvictBlogCacheErrorCode = z.enum(["INVALID_BLOG_SLUG"]);

export type EvictBlogCacheErrorCode = z.infer<typeof EvictBlogCacheErrorCode>;

export type EvictBlogCacheResult = ServiceResult<
  EvictBlogCacheData,
  EvictBlogCacheErrorCode
>;

export interface EvictBlogCacheSpec {
  execute(input: EvictBlogCacheInput): Promise<EvictBlogCacheResult>;
}
