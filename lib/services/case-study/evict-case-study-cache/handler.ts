import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  caseStudyPaths,
  safeRevalidateCaseStudyPath,
  safeRevalidateCaseStudyTag,
} from "../shared";
import {
  EvictCaseStudyCacheInputSchema,
  type EvictCaseStudyCacheInput,
  type EvictCaseStudyCacheResult,
  type EvictCaseStudyCacheSpec,
} from "./spec";

export interface EvictCaseStudyCacheDeps {
  redisClient?: Pick<typeof redis, "del">;
  isRedisReady?: () => boolean;
  revalidatePathFn?: (path: string) => Promise<void>;
  revalidateTagFn?: (tag: string) => Promise<void>;
}

/**
 * Handler for evicting case study cache keys in Redis and revalidating ISR paths and tags.
 */
export class EvictCaseStudyCacheHandler implements EvictCaseStudyCacheSpec {
  private readonly redisClient: Pick<typeof redis, "del">;
  private readonly isRedisReady: () => boolean;
  private readonly revalidatePathFn: (path: string) => Promise<void>;
  private readonly revalidateTagFn: (tag: string) => Promise<void>;

  constructor(deps: EvictCaseStudyCacheDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
    this.revalidatePathFn =
      deps.revalidatePathFn ?? safeRevalidateCaseStudyPath;
    this.revalidateTagFn = deps.revalidateTagFn ?? safeRevalidateCaseStudyTag;
  }

  async execute(
    input: EvictCaseStudyCacheInput
  ): Promise<EvictCaseStudyCacheResult> {
    const parsed = EvictCaseStudyCacheInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid case study slug", {
        recoverable: false,
        details: parsed.error,
      });
    }

    const { slug } = parsed.data;
    const cacheKey = getScopedRedisKey(`cs:slug:${slug}`);
    const reactionsBaseKey = getScopedRedisKey(`cs:reactions_counts:${slug}`);
    const allPublishedKey = getScopedRedisKey("cs:all_published");
    const searchIndexKey = getScopedRedisKey("cs:search_index");

    let evicted = false;
    if (this.isRedisReady()) {
      try {
        await Promise.race([
          Promise.all([
            this.redisClient.del(cacheKey),
            this.redisClient.del(reactionsBaseKey),
            this.redisClient.del(allPublishedKey),
            this.redisClient.del(searchIndexKey),
          ]),
          new Promise((_, reject) => {
            const t = setTimeout(
              () => reject(new Error("Redis cache eviction timeout")),
              1500
            );
            t.unref?.();
          }),
        ]);
        evicted = true;
      } catch (err) {
        if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
          logger.warn(
            `CaseStudyService.evictCaseStudyCache: Redis eviction failed for "${slug}":`,
            err
          );
        }
      }
    }

    try {
      for (const path of caseStudyPaths(slug)) {
        await this.revalidatePathFn(path);
      }
      await this.revalidateTagFn(`case-study-${slug}`);
      await this.revalidateTagFn("case-studies");
    } catch {
      // Best-effort ISR invalidation
    }

    return createSuccess({ evicted });
  }
}
