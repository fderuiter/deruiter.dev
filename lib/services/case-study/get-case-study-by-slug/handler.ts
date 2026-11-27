import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { RedisTimeoutError, withRedisTimeout } from "@/lib/redis-timeout";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  mapCaseStudyRecordToData,
  type CaseStudyData,
  type RawCaseStudyRecord,
} from "../shared";
import {
  GetCaseStudyBySlugInputSchema,
  type GetCaseStudyBySlugInput,
  type GetCaseStudyBySlugResult,
  type GetCaseStudyBySlugSpec,
} from "./spec";

export interface GetCaseStudyBySlugPrismaPort {
  findUnique(args: {
    where: { slug: string };
  }): Promise<RawCaseStudyRecord | null>;
}

export interface GetCaseStudyBySlugDeps {
  caseStudies?: GetCaseStudyBySlugPrismaPort;
}

export class GetCaseStudyBySlugHandler implements GetCaseStudyBySlugSpec {
  private readonly caseStudies: GetCaseStudyBySlugPrismaPort;

  constructor(deps: GetCaseStudyBySlugDeps = {}) {
    this.caseStudies = deps.caseStudies ?? prisma.caseStudy;
  }

  async execute(
    input: GetCaseStudyBySlugInput
  ): Promise<GetCaseStudyBySlugResult> {
    const parsed = GetCaseStudyBySlugInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_CASE_STUDY_SLUG",
        parsed.error.issues[0]?.message ?? "Slug is required",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const slug = parsed.data.slug;
    const cacheKey = getScopedRedisKey(`cs:slug:${slug}`);

    try {
      const cached = !isRedisConfigured()
        ? null
        : await withRedisTimeout(
            redis.get<CaseStudyData>(cacheKey),
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
        const message = `GetCaseStudyBySlugHandler: Redis cache read failed for "${slug}", falling back:`;
        if (cacheErr instanceof RedisTimeoutError) {
          logger.warn(message, cacheErr, { skipTelemetry: true });
        } else {
          logger.warn(message, cacheErr);
        }
      }
    }

    let dbResult: CaseStudyData | null = null;
    try {
      const record = await this.caseStudies.findUnique({
        where: { slug },
      });
      if (record && record.published) {
        dbResult = mapCaseStudyRecordToData(record);
      }
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          `GetCaseStudyBySlugHandler: DB query failed for slug "${slug}", falling back:`,
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

    if (finalResult && isRedisConfigured()) {
      try {
        await withRedisTimeout(
          redis.set(cacheKey, finalResult, { ex: 3600 }),
          1500,
          "Redis cache write timeout"
        );
      } catch {
        // Tolerated
      }
    }

    return createSuccess(finalResult);
  }
}
