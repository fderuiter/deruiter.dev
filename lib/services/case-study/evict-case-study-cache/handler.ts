import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
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

export class EvictCaseStudyCacheHandler implements EvictCaseStudyCacheSpec {
  async execute(
    input: EvictCaseStudyCacheInput
  ): Promise<EvictCaseStudyCacheResult> {
    const parsed = EvictCaseStudyCacheInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_CASE_STUDY_SLUG",
        parsed.error.issues[0]?.message ?? "Slug is required",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const slug = parsed.data.slug;
    const cacheKey = getScopedRedisKey(`cs:slug:${slug}`);
    const reactionsBaseKey = getScopedRedisKey(`cs:reactions_counts:${slug}`);
    const allPublishedKey = getScopedRedisKey("cs:all_published");
    const searchIndexKey = getScopedRedisKey("cs:search_index");

    let evicted = false;
    if (isRedisConfigured()) {
      try {
        await withRedisTimeout(
          Promise.all([
            redis.del(cacheKey),
            redis.del(reactionsBaseKey),
            redis.del(allPublishedKey),
            redis.del(searchIndexKey),
          ]),
          1500,
          "Redis cache eviction timeout"
        );
        evicted = true;
      } catch (err) {
        if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
          logger.warn(
            `EvictCaseStudyCacheHandler: Redis eviction failed for "${slug}":`,
            err
          );
        }
      }
    }

    try {
      for (const path of caseStudyPaths(slug)) {
        await safeRevalidateCaseStudyPath(path);
      }
      await safeRevalidateCaseStudyTag(`case-study-${slug}`);
      await safeRevalidateCaseStudyTag("case-studies");
    } catch {
      // Cache revalidation errors are non-fatal after Redis eviction
    }

    return createSuccess({ evicted });
  }
}
