import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  toCaseStudySearchSummary,
  type CaseStudySearchSummary,
} from "../shared";
import {
  GetPublishedCaseStudiesInputSchema,
  type GetPublishedCaseStudiesInput,
  type GetPublishedCaseStudiesResult,
  type GetPublishedCaseStudiesSpec,
} from "./spec";

export interface GetPublishedCaseStudiesDeps {
  db?: {
    caseStudy: {
      findMany(args: {
        where: { published: boolean };
        select: {
          id: true;
          slug: true;
          title: true;
          primary_language: true;
          tags: true;
        };
        orderBy: { created_at: "asc" | "desc" };
      }): Promise<CaseStudySearchSummary[]>;
    };
  };
  redisClient?: Pick<typeof redis, "get" | "set">;
  isRedisReady?: () => boolean;
}

/**
 * Handler for retrieving lightweight search-index summaries for published case studies.
 */
export class GetPublishedCaseStudiesHandler implements GetPublishedCaseStudiesSpec {
  private readonly db: NonNullable<GetPublishedCaseStudiesDeps["db"]>;
  private readonly redisClient: Pick<typeof redis, "get" | "set">;
  private readonly isRedisReady: () => boolean;

  constructor(deps: GetPublishedCaseStudiesDeps = {}) {
    this.db = deps.db ?? prisma;
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
  }

  async execute(
    input: GetPublishedCaseStudiesInput = {}
  ): Promise<GetPublishedCaseStudiesResult> {
    const parsed = GetPublishedCaseStudiesInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid search summary input", {
        recoverable: false,
        details: parsed.error,
      });
    }

    if (env.PLAYWRIGHT_TEST === "true") {
      return createSuccess([
        {
          id: "clinical-data-mapper",
          slug: "clinical-data-mapper",
          title: "Clinical Data Mapper",
          primary_language: "TypeScript",
          tags: "clinical, edc, mapping",
        },
        {
          id: "cadence-clinical",
          slug: "cadence-clinical",
          title: "Cadence Clinical",
          primary_language: "TypeScript",
          tags: "clinical, telemetry, real-time",
        },
        {
          id: "imednet-python-sdk",
          slug: "imednet-python-sdk",
          title: "iMedNet Python SDK",
          primary_language: "Python",
          tags: "sdk, clinical, integration",
        },
        {
          id: "inbody-qr-decoder",
          slug: "inbody-qr-decoder",
          title: "InBody QR Data Decoder",
          primary_language: "Python",
          tags: "python, reverse-engineering, qr-decoder, biometrics",
        },
      ]);
    }

    const cacheKey = getScopedRedisKey("cs:search_index");

    try {
      const cached = !this.isRedisReady()
        ? null
        : await Promise.race([
            this.redisClient.get<CaseStudySearchSummary[]>(cacheKey),
            new Promise<null>((_, reject) => {
              const t = setTimeout(
                () =>
                  reject(new Error("Redis getPublishedCaseStudies timeout")),
                1500
              );
              t.unref?.();
            }),
          ]);

      if (Array.isArray(cached) && cached.length > 0) {
        return createSuccess(cached);
      }
    } catch {
      // Tolerated
    }

    let dbStudies: CaseStudySearchSummary[] = [];
    try {
      dbStudies = await this.db.caseStudy.findMany({
        where: { published: true },
        select: {
          id: true,
          slug: true,
          title: true,
          primary_language: true,
          tags: true,
        },
        orderBy: { created_at: "asc" },
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "CaseStudyService.getPublishedCaseStudies: Database query failed, using static fallbacks:",
          err
        );
      }
      failBuildOnDataSourceError(
        "CaseStudyService.getPublishedCaseStudies",
        err
      );
      return createSuccess(FALLBACK_CASE_STUDIES.map(toCaseStudySearchSummary));
    }

    const seenSlugs = new Set(dbStudies.map((s) => s.slug));
    const merged: CaseStudySearchSummary[] = [...dbStudies];

    for (const fallback of FALLBACK_CASE_STUDIES) {
      if (!seenSlugs.has(fallback.slug)) {
        merged.push(toCaseStudySearchSummary(fallback));
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
