import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
import { createSuccess } from "@/lib/services/service-result";
import {
  toCaseStudySearchSummary,
  type CaseStudySearchSummary,
} from "../shared";
import type {
  ListCaseStudySummariesInput,
  ListCaseStudySummariesResult,
  ListCaseStudySummariesSpec,
} from "./spec";

export interface ListCaseStudySummariesPrismaPort {
  findMany(args: {
    where: { published: true };
    select: {
      id: true;
      slug: true;
      title: true;
      primary_language: true;
      tags: true;
    };
    orderBy: { created_at: "asc" };
  }): Promise<CaseStudySearchSummary[]>;
}

export interface ListCaseStudySummariesDeps {
  caseStudies?: ListCaseStudySummariesPrismaPort;
}

export class ListCaseStudySummariesHandler implements ListCaseStudySummariesSpec {
  private readonly caseStudies: ListCaseStudySummariesPrismaPort;

  constructor(deps: ListCaseStudySummariesDeps = {}) {
    this.caseStudies = deps.caseStudies ?? prisma.caseStudy;
  }

  async execute(
    _input?: ListCaseStudySummariesInput
  ): Promise<ListCaseStudySummariesResult> {
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
      const cached = !isRedisConfigured()
        ? null
        : await withRedisTimeout(
            redis.get<CaseStudySearchSummary[]>(cacheKey),
            1500,
            "Redis getPublishedCaseStudies timeout"
          );

      if (Array.isArray(cached) && cached.length > 0) {
        return createSuccess(cached);
      }
    } catch {
      // Tolerated, fall through to DB query
    }

    let dbStudies: CaseStudySearchSummary[] = [];
    try {
      dbStudies = await this.caseStudies.findMany({
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
          "ListCaseStudySummariesHandler: Database query failed, using static fallbacks:",
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
