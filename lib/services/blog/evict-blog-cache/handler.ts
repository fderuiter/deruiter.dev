import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { safeRevalidateBlogPath, safeRevalidateBlogTag } from "../shared";
import {
  EvictBlogCacheInputSchema,
  type EvictBlogCacheInput,
  type EvictBlogCacheResult,
  type EvictBlogCacheSpec,
} from "./spec";

export class EvictBlogCacheHandler implements EvictBlogCacheSpec {
  async execute(input: EvictBlogCacheInput): Promise<EvictBlogCacheResult> {
    const parsed = EvictBlogCacheInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_BLOG_SLUG", "Slug must be a string", {
        recoverable: false,
        details: parsed.error.issues,
      });
    }

    const trimmedSlug = parsed.data.slug.trim();
    if (!trimmedSlug) {
      return createSuccess({ evicted: false });
    }

    const cacheKey = getScopedRedisKey(`blog:slug:${trimmedSlug}`);
    const allPublishedKey = getScopedRedisKey("blog:all_published");

    let evicted = false;
    if (isRedisConfigured()) {
      try {
        await withRedisTimeout(
          redis.del(cacheKey, allPublishedKey),
          1500,
          "Redis cache eviction timeout"
        );
        evicted = true;
      } catch (err) {
        if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
          logger.warn(
            `EvictBlogCacheHandler: Redis eviction failed for "${trimmedSlug}":`,
            err
          );
        }
      }
    }

    try {
      await safeRevalidateBlogPath(`/blog/${trimmedSlug}`);
      await safeRevalidateBlogPath(`/blog/${trimmedSlug}/opengraph-image`);
      await safeRevalidateBlogPath("/blog");
      await safeRevalidateBlogPath("/sitemap.xml");
      await safeRevalidateBlogTag(`blog-post-${trimmedSlug}`);
      await safeRevalidateBlogTag("blog-posts");
    } catch {
      // Cache revalidation errors are non-fatal after Redis eviction
    }

    return createSuccess({ evicted });
  }
}
