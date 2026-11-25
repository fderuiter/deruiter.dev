import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import {
  FALLBACK_CASE_STUDIES,
  type CaseStudyData,
} from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { RedisTimeoutError, withRedisTimeout } from "@/lib/redis-timeout";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { mapCaseStudyDbRecord, type CaseStudyDbRowLike } from "../shared";
import {
  GetCaseStudyBySlugInputSchema,
  type GetCaseStudyBySlugInput,
  type GetCaseStudyBySlugResult,
  type GetCaseStudyBySlugSpec,
} from "./spec";

export interface GetCaseStudyBySlugDeps {
  db?: {
    caseStudy: {
      findUnique(args: {
        where: { slug: string };
      }): Promise<CaseStudyDbRowLike | null>;
    };
  };
  redisClient?: Pick<typeof redis, "get" | "set">;
  isRedisReady?: () => boolean;
}

/**
 * Handler for retrieving a single published case study by slug via Redis read-through cache, Postgres, and static fallback.
 */
export class GetCaseStudyBySlugHandler implements GetCaseStudyBySlugSpec {
  private readonly db: NonNullable<GetCaseStudyBySlugDeps["db"]>;
  private readonly redisClient: Pick<typeof redis, "get" | "set">;
  private readonly isRedisReady: () => boolean;

  constructor(deps: GetCaseStudyBySlugDeps = {}) {
    this.db = deps.db ?? prisma;
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
  }

  async execute(
    input: GetCaseStudyBySlugInput
  ): Promise<GetCaseStudyBySlugResult> {
    const parsed = GetCaseStudyBySlugInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid case study slug input", {
        recoverable: false,
        details: parsed.error,
      });
    }

    const { slug, allowFallbackOnError } = parsed.data;
    const cacheKey = getScopedRedisKey(`cs:slug:${slug}`);

    try {
      const cached = !this.isRedisReady()
        ? null
        : await withRedisTimeout(
            this.redisClient.get<CaseStudyData>(cacheKey),
            1500,
            "Redis cache read timeout"
          );

      if (cached && typeof cached === "object" && cached.slug === slug) {
        return createSuccess({
          ...cached,
          created_at: new Date(cached.created_at),
          updated_at: new Date(cached.updated_at),
        });
      }
    } catch (cacheErr) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        const message = `CaseStudyService.getCaseStudyBySlug: Redis cache read failed for "${slug}", falling back:`;
        if (cacheErr instanceof RedisTimeoutError) {
          logger.warn(message, cacheErr, { skipTelemetry: true });
        } else {
          logger.warn(message, cacheErr);
        }
      }
    }

    let dbResult: CaseStudyData | null = null;
    try {
      const r = await this.db.caseStudy.findUnique({
        where: { slug },
      });
      if (r && r.published) {
        dbResult = mapCaseStudyDbRecord(r);
      }
    } catch (err) {
      if (!allowFallbackOnError) {
        return createFailure(
          "STORAGE_UNAVAILABLE",
          `Could not read case study "${slug}" from database`,
          { recoverable: true, details: err }
        );
      }
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          `CaseStudyService.getCaseStudyBySlug: DB query failed for slug "${slug}", falling back:`,
          err
        );
      }
      failBuildOnDataSourceError("CaseStudyService.getCaseStudyBySlug", err);
      return createSuccess(
        FALLBACK_CASE_STUDIES.find((s) => s.slug === slug) ?? null
      );
    }

    const finalResult =
      dbResult ?? FALLBACK_CASE_STUDIES.find((s) => s.slug === slug) ?? null;

    if (finalResult && this.isRedisReady()) {
      try {
        await Promise.race([
          this.redisClient.set(cacheKey, finalResult, { ex: 3600 }),
          new Promise((_, reject) => {
            const t = setTimeout(
              () => reject(new Error("Redis cache write timeout")),
              1500
            );
            t.unref?.();
          }),
        ]);
      } catch {
        // Tolerated
      }
    }

    return createSuccess(finalResult);
  }
}
