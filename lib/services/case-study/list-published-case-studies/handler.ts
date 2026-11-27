import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
import { createSuccess } from "@/lib/services/service-result";
import {
  mapCaseStudyRecordToData,
  type CaseStudyData,
  type RawCaseStudyRecord,
} from "../shared";
import type {
  ListPublishedCaseStudiesInput,
  ListPublishedCaseStudiesResult,
  ListPublishedCaseStudiesSpec,
} from "./spec";

export interface ListPublishedCaseStudiesPrismaPort {
  findMany(args: {
    where: { published: true };
    orderBy: { created_at: "asc" };
  }): Promise<RawCaseStudyRecord[]>;
}

export interface ListPublishedCaseStudiesDeps {
  caseStudies?: ListPublishedCaseStudiesPrismaPort;
}

export class ListPublishedCaseStudiesHandler implements ListPublishedCaseStudiesSpec {
  private readonly caseStudies: ListPublishedCaseStudiesPrismaPort;

  constructor(deps: ListPublishedCaseStudiesDeps = {}) {
    this.caseStudies = deps.caseStudies ?? prisma.caseStudy;
  }

  async execute(
    _input?: ListPublishedCaseStudiesInput
  ): Promise<ListPublishedCaseStudiesResult> {
    const cacheKey = getScopedRedisKey("cs:all_published");

    try {
      const cached = !isRedisConfigured()
        ? null
        : await withRedisTimeout(
            redis.get<CaseStudyData[]>(cacheKey),
            1500,
            "Redis getAllPublishedCaseStudies timeout"
          );

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
      const records = await this.caseStudies.findMany({
        where: { published: true },
        orderBy: { created_at: "asc" },
      });
      dbStudies = records.map((r) => mapCaseStudyRecordToData(r));
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "ListPublishedCaseStudiesHandler: Database query failed, using static fallbacks:",
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

    if (merged.length > 0 && isRedisConfigured()) {
      try {
        await withRedisTimeout(
          redis.set(cacheKey, merged, { ex: 3600 }),
          1500,
          "Redis cache write timeout"
        );
      } catch {
        // Tolerated
      }
    }

    return createSuccess(merged);
  }
}
