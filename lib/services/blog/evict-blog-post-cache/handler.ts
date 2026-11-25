import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { safeRevalidateBlogPath, safeRevalidateBlogTag } from "../shared";
import {
  EvictBlogPostCacheInputSchema,
  type EvictBlogPostCacheInput,
  type EvictBlogPostCacheResult,
  type EvictBlogPostCacheSpec,
} from "./spec";

export interface EvictBlogPostCacheDeps {
  redisClient?: {
    del(...keys: string[]): Promise<number>;
  };
  isRedisReady?: () => boolean;
  revalidatePath?: (path: string, type?: "layout" | "page") => Promise<void>;
  revalidateTag?: (tag: string) => Promise<void>;
}

/**
 * Handler for evicting a blog post from the Upstash Redis read-through cache and revalidating ISR paths and tags.
 */
export class EvictBlogPostCacheHandler implements EvictBlogPostCacheSpec {
  private readonly redisClient: NonNullable<
    EvictBlogPostCacheDeps["redisClient"]
  >;
  private readonly isRedisReady: () => boolean;
  private readonly revalidatePath: NonNullable<
    EvictBlogPostCacheDeps["revalidatePath"]
  >;
  private readonly revalidateTag: NonNullable<
    EvictBlogPostCacheDeps["revalidateTag"]
  >;

  constructor(deps: EvictBlogPostCacheDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
    this.revalidatePath = deps.revalidatePath ?? safeRevalidateBlogPath;
    this.revalidateTag = deps.revalidateTag ?? safeRevalidateBlogTag;
  }

  async execute(
    input: EvictBlogPostCacheInput
  ): Promise<EvictBlogPostCacheResult> {
    const parsed = EvictBlogPostCacheInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid blog post slug",
        { recoverable: false, details: parsed.error }
      );
    }

    const trimmedSlug = parsed.data.slug.trim();
    if (!trimmedSlug) {
      return createSuccess({ evicted: false });
    }

    const cacheKey = getScopedRedisKey(`blog:slug:${trimmedSlug}`);
    const allPublishedKey = getScopedRedisKey("blog:all_published");

    let evicted = false;
    if (this.isRedisReady()) {
      try {
        await withRedisTimeout(
          this.redisClient.del(cacheKey, allPublishedKey),
          1500,
          "Redis cache eviction timeout"
        );
        evicted = true;
      } catch (err) {
        if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
          logger.warn(
            `BlogPostService.evictBlogPostCache: Redis eviction failed for "${trimmedSlug}":`,
            err
          );
        }
      }
    }

    await this.revalidatePath(`/blog/${trimmedSlug}`);
    await this.revalidatePath(`/blog/${trimmedSlug}/opengraph-image`);
    await this.revalidatePath("/blog");
    await this.revalidatePath("/sitemap.xml");
    await this.revalidateTag(`blog-post-${trimmedSlug}`);
    await this.revalidateTag("blog-posts");

    return createSuccess({ evicted });
  }
}
