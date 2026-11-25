import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import {
  FALLBACK_CASE_STUDIES,
  type CaseStudyData,
} from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { mapCaseStudyDbRecord, type CaseStudyDbRowLike } from "../shared";
import {
  GetAllPublishedCaseStudiesInputSchema,
  type GetAllPublishedCaseStudiesInput,
  type GetAllPublishedCaseStudiesResult,
  type GetAllPublishedCaseStudiesSpec,
} from "./spec";

export interface GetAllPublishedCaseStudiesDeps {
  db?: {
    caseStudy: {
      findMany(args: {
        where: { published: boolean };
        orderBy: { created_at: "asc" | "desc" };
      }): Promise<CaseStudyDbRowLike[]>;
    };
  };
  redisClient?: Pick<typeof redis, "get" | "set">;
  isRedisReady?: () => boolean;
}

/**
 * Handler for retrieving all published case studies combining database records with static fallbacks.
 */
export class GetAllPublishedCaseStudiesHandler implements GetAllPublishedCaseStudiesSpec {
  private readonly db: NonNullable<GetAllPublishedCaseStudiesDeps["db"]>;
  private readonly redisClient: Pick<typeof redis, "get" | "set">;
  private readonly isRedisReady: () => boolean;

  constructor(deps: GetAllPublishedCaseStudiesDeps = {}) {
    this.db = deps.db ?? prisma;
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
  }

  async execute(
    input: GetAllPublishedCaseStudiesInput = {}
  ): Promise<GetAllPublishedCaseStudiesResult> {
    const parsed = GetAllPublishedCaseStudiesInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid case study query input", {
        recoverable: false,
        details: parsed.error,
      });
    }

    const cacheKey = getScopedRedisKey("cs:all_published");

    try {
      const cached = !this.isRedisReady()
        ? null
        : await Promise.race([
            this.redisClient.get<CaseStudyData[]>(cacheKey),
            new Promise<null>((_, reject) => {
              const t = setTimeout(
                () =>
                  reject(new Error("Redis getAllPublishedCaseStudies timeout")),
                1500
              );
              t.unref?.();
            }),
          ]);

      if (Array.isArray(cached) && cached.length > 0) {
        return createSuccess(
          cached.map((s) => ({
            ...s,
            created_at: new Date(s.created_at),
            updated_at: new Date(s.updated_at),
          }))
        );
      }
    } catch {
      // Tolerated, fall through to DB query
    }

    let dbStudies: CaseStudyData[] = [];
    try {
      const records = await this.db.caseStudy.findMany({
        where: { published: true },
        orderBy: { created_at: "asc" },
      });
      dbStudies = records.map((r) => mapCaseStudyDbRecord(r));
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "CaseStudyService.getAllPublishedCaseStudies: Database query failed, using static fallbacks:",
          err
        );
      }
      failBuildOnDataSourceError(
        "CaseStudyService.getAllPublishedCaseStudies",
        err
      );
      return createSuccess([...FALLBACK_CASE_STUDIES]);
    }

    const seenSlugs = new Set(dbStudies.map((s) => s.slug));
    const merged: CaseStudyData[] = [...dbStudies];

    for (const fallback of FALLBACK_CASE_STUDIES) {
      if (!seenSlugs.has(fallback.slug)) {
        merged.push(fallback);
        seenSlugs.add(fallback.slug);
      }
    }

    if (merged.length > 0 && this.isRedisReady()) {
      try {
        await Promise.race([
          this.redisClient.set(cacheKey, merged, { ex: 3600 }),
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

    return createSuccess(merged);
  }
}
