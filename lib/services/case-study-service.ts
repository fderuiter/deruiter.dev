import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { FALLBACK_CASE_STUDIES, CaseStudyData } from "@/lib/case-studies-data";
import { redis, getScopedRedisKey, isRedisConfigured } from "@/lib/redis";
import { sanitizeContentHtmlLazy } from "@/lib/content-sanitizer-lazy";
import { logger } from "@/lib/logger";

export type { CaseStudyData };

async function safeRevalidateTag(tag: string): Promise<void> {
  try {
    const { revalidateTag } = await import("next/cache");
    if (typeof revalidateTag === "function") {
      revalidateTag(tag, "max");
    }
  } catch {
    // Tolerated outside of Next.js server runtime (e.g. unit tests)
  }
}

export interface CaseStudySubmissionInput {
  title: string;
  slug: string;
  primary_language: string;
  editorial_content: string;
  architectural_narrative: string;
  tags: string;
  github_url?: string | null;
}

export interface FeedbackSubmissionInput {
  caseStudySlug: string;
  takeaways: string[];
  comments: string;
}

export interface ReactionSubmissionInput {
  caseStudySlug: string;
  reactionType: string;
}

export interface BufferedReactionEvent {
  id: string;
  caseStudySlug: string;
  reactionType: string;
  connectionHash: string;
  createdAt: string | Date;
}

const ALLOWED_REACTIONS = [
  "insightful",
  "mind_blowing",
  "actionable",
  "thorough",
] as const;

// In-memory fallback stores for offline/mock environments
const mockFeedbackStore = new Map<
  string,
  Array<{
    takeaways: string[];
    comments: string;
    connectionHash: string;
    createdAt: string;
  }>
>();
const mockReactionsStore = new Map<string, Map<string, number>>();

function getDefaultReactionCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of ALLOWED_REACTIONS) {
    counts[r] = 0;
  }
  return counts;
}

async function getBaseReactionCounts(
  slug: string
): Promise<Record<string, number>> {
  const baseKey = getScopedRedisKey(`cs:reactions_counts:${slug}`);
  try {
    const cached = !isRedisConfigured()
      ? null
      : await Promise.race([
          redis.get<Record<string, number>>(baseKey),
          new Promise<null>((_, reject) =>
            setTimeout(
              () => reject(new Error("Redis getBaseReactionCounts timeout")),
              1500
            )
          ),
        ]);
    if (cached && typeof cached === "object") {
      const counts = getDefaultReactionCounts();
      for (const r of ALLOWED_REACTIONS) {
        if (typeof cached[r] === "number") {
          counts[r] = cached[r];
        }
      }
      return counts;
    }
  } catch {
    // Tolerated, fall through to database query
  }

  // Cache miss or Redis timeout: fetch from DB
  const counts = getDefaultReactionCounts();
  try {
    const reactions = await prisma.caseStudyReaction.groupBy({
      by: ["reactionType"],
      where: { caseStudySlug: slug },
      _count: { id: true },
    });
    for (const r of reactions) {
      if (counts[r.reactionType] !== undefined) {
        counts[r.reactionType] = r._count.id;
      }
    }
    // Cache in Redis with 3600s TTL
    if (isRedisConfigured()) {
      try {
        await Promise.race([
          redis.set(baseKey, counts, { ex: 3600 }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Redis setBaseReactionCounts timeout")),
              1500
            )
          ),
        ]);
      } catch {
        // Tolerated
      }
    }
  } catch (err) {
    if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
      logger.warn(
        `CaseStudyService: Failed to query base reactions for ${slug}:`,
        err
      );
    }
    const slugMap = mockReactionsStore.get(slug);
    if (slugMap) {
      for (const [r, count] of slugMap.entries()) {
        counts[r] = count;
      }
    }
  }

  return counts;
}

/**
 * Persists a reaction straight to Postgres, falling back to the in-memory
 * mock store when the database is unreachable. Used when Upstash Redis is
 * not configured at all, and as the recovery path when buffering fails.
 */
async function submitReactionDirect(
  caseStudySlug: string,
  reactionType: string,
  connectionHash: string
) {
  try {
    await prisma.caseStudyReaction.createMany({
      data: [
        {
          caseStudySlug,
          reactionType,
          connectionHash,
        },
      ],
      skipDuplicates: true,
    });

    const reactions = await prisma.caseStudyReaction.groupBy({
      by: ["reactionType"],
      where: { caseStudySlug },
      _count: { id: true },
    });

    const userReactionsList = await prisma.caseStudyReaction.findMany({
      where: { caseStudySlug, connectionHash },
      select: { reactionType: true },
    });

    const counts = getDefaultReactionCounts();
    for (const r of reactions) {
      if (counts[r.reactionType] !== undefined) {
        counts[r.reactionType] = r._count.id;
      }
    }

    return {
      success: true,
      reactionType,
      counts,
      userReactions: userReactionsList.map((ur) => ur.reactionType),
    };
  } catch (dbErr) {
    if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
      logger.error(
        "Database reaction creation failed, using mock fallback:",
        dbErr
      );
    }
    if (!mockReactionsStore.has(caseStudySlug)) {
      mockReactionsStore.set(caseStudySlug, new Map());
    }
    const slugMap = mockReactionsStore.get(caseStudySlug)!;
    const currentCount = slugMap.get(reactionType) || 0;
    slugMap.set(reactionType, currentCount + 1);

    const counts = getDefaultReactionCounts();
    for (const [r, count] of slugMap.entries()) {
      counts[r] = count;
    }

    return {
      success: true,
      reactionType,
      counts,
      userReactions: [reactionType],
    };
  }
}

/** The five fields `/api/case-studies` exposes for search and discovery. */
export type CaseStudySearchSummary = Pick<
  CaseStudyData,
  "id" | "slug" | "title" | "primary_language" | "tags"
>;

function toSearchSummary(s: CaseStudySearchSummary): CaseStudySearchSummary {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    primary_language: s.primary_language,
    tags: s.tags,
  };
}

export class CaseStudyService {
  /**
   * Retrieves all published case studies combining database records with static fallbacks.
   * Prioritizes live database records and seamlessly appends missing static case studies.
   */
  static async getAllPublishedCaseStudies(): Promise<CaseStudyData[]> {
    const cacheKey = getScopedRedisKey("cs:all_published");

    // Check Upstash Redis cache first
    try {
      const cached = !isRedisConfigured()
        ? null
        : await Promise.race([
            redis.get<CaseStudyData[]>(cacheKey),
            new Promise<null>((_, reject) =>
              setTimeout(
                () =>
                  reject(new Error("Redis getAllPublishedCaseStudies timeout")),
                1500
              )
            ),
          ]);

      if (Array.isArray(cached) && cached.length > 0) {
        return cached.map((s) => ({
          ...s,
          created_at: new Date(s.created_at),
          updated_at: new Date(s.updated_at),
        }));
      }
    } catch {
      // Tolerated, fall through to DB query
    }

    let dbStudies: CaseStudyData[] = [];
    try {
      const records = await prisma.caseStudy.findMany({
        where: { published: true },
        orderBy: { created_at: "asc" },
      });
      dbStudies = records.map((r) => {
        const fallback = FALLBACK_CASE_STUDIES.find((f) => f.slug === r.slug);
        return {
          id: r.id,
          slug: r.slug,
          title: r.title,
          primary_language: r.primary_language,
          github_url: r.github_url ?? fallback?.github_url ?? "",
          external_platform_url: fallback?.external_platform_url,
          external_platform_type: fallback?.external_platform_type,
          interactive_url: fallback?.interactive_url,
          interactive_label: fallback?.interactive_label,
          benchmarks: fallback?.benchmarks,
          published: r.published,
          simulated_telemetry: r.simulated_telemetry,
          tags: r.tags,
          editorial_content: r.editorial_content,
          architectural_narrative: r.architectural_narrative,
          commands_json:
            r.commands_json ?? fallback?.commands_json ?? undefined,
          playback_json:
            r.playback_json ?? fallback?.playback_json ?? undefined,
          hero_image_url: r.hero_image_url ?? fallback?.hero_image_url ?? null,
          created_at: new Date(r.created_at),
          updated_at: new Date(r.updated_at),
        };
      });
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
      return [...FALLBACK_CASE_STUDIES];
    }

    const seenSlugs = new Set(dbStudies.map((s) => s.slug));
    const merged: CaseStudyData[] = [...dbStudies];

    for (const fallback of FALLBACK_CASE_STUDIES) {
      if (!seenSlugs.has(fallback.slug)) {
        merged.push(fallback);
        seenSlugs.add(fallback.slug);
      }
    }

    // Populate Redis cache with 3600s TTL
    if (merged.length > 0 && isRedisConfigured()) {
      try {
        await Promise.race([
          redis.set(cacheKey, merged, { ex: 3600 }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Redis cache write timeout")),
              1500
            )
          ),
        ]);
      } catch {
        // Tolerated
      }
    }

    return merged;
  }

  /**
   * Retrieves a single published case study by slug.
   * Employs the Two-Tier Compute Shield (ADR 0036):
   * - Check Upstash Redis read-through cache first (`cs:slug:[slug]`, 3600s TTL).
   * - On cache miss or Redis error, query Prisma and populate cache.
   * - Fall back to static dataset (FALLBACK_CASE_STUDIES) if absent from DB.
   */
  static async getCaseStudyBySlug(slug: string): Promise<CaseStudyData | null> {
    const cacheKey = getScopedRedisKey(`cs:slug:${slug}`);

    // Tier 2: Check Upstash Redis read-through cache with 1500ms timeout
    try {
      const cached = !isRedisConfigured()
        ? null
        : await Promise.race([
            redis.get<CaseStudyData>(cacheKey),
            new Promise<null>((_, reject) =>
              setTimeout(
                () => reject(new Error("Redis cache read timeout")),
                1500
              )
            ),
          ]);

      if (cached && typeof cached === "object" && cached.slug === slug) {
        return {
          ...cached,
          created_at: new Date(cached.created_at),
          updated_at: new Date(cached.updated_at),
        };
      }
    } catch (cacheErr) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          `CaseStudyService.getCaseStudyBySlug: Redis cache read failed for "${slug}", falling back:`,
          cacheErr
        );
      }
    }

    // Cache miss or Redis unavailable: Query database
    let dbResult: CaseStudyData | null = null;
    try {
      const r = await prisma.caseStudy.findUnique({
        where: { slug },
      });
      if (r && r.published) {
        const fallback = FALLBACK_CASE_STUDIES.find((f) => f.slug === r.slug);
        dbResult = {
          id: r.id,
          slug: r.slug,
          title: r.title,
          primary_language: r.primary_language,
          github_url: r.github_url ?? fallback?.github_url ?? "",
          external_platform_url: fallback?.external_platform_url,
          external_platform_type: fallback?.external_platform_type,
          interactive_url: fallback?.interactive_url,
          interactive_label: fallback?.interactive_label,
          benchmarks: fallback?.benchmarks,
          published: r.published,
          simulated_telemetry: r.simulated_telemetry,
          tags: r.tags,
          editorial_content: r.editorial_content,
          architectural_narrative: r.architectural_narrative,
          commands_json:
            r.commands_json ?? fallback?.commands_json ?? undefined,
          playback_json:
            r.playback_json ?? fallback?.playback_json ?? undefined,
          hero_image_url: r.hero_image_url ?? fallback?.hero_image_url ?? null,
          created_at: new Date(r.created_at),
          updated_at: new Date(r.updated_at),
        };
      }
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          `CaseStudyService.getCaseStudyBySlug: DB query failed for slug "${slug}", falling back:`,
          err
        );
      }
      failBuildOnDataSourceError("CaseStudyService.getCaseStudyBySlug", err);
    }

    const finalResult =
      dbResult ?? FALLBACK_CASE_STUDIES.find((s) => s.slug === slug) ?? null;

    // Populate Redis cache with 3600s TTL on resolution
    if (finalResult && isRedisConfigured()) {
      try {
        await Promise.race([
          redis.set(cacheKey, finalResult, { ex: 3600 }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Redis cache write timeout")),
              1500
            )
          ),
        ]);
      } catch {
        // Silently tolerate cache write failure
      }
    }

    return finalResult;
  }

  /**
   * Explicitly evicts a case study from the Upstash Redis read-through cache
   * and dispatches on-demand Next.js ISR tag revalidations.
   */
  static async evictCaseStudyCache(slug: string): Promise<boolean> {
    const cacheKey = getScopedRedisKey(`cs:slug:${slug}`);
    const reactionsBaseKey = getScopedRedisKey(`cs:reactions_counts:${slug}`);
    const allPublishedKey = getScopedRedisKey("cs:all_published");
    const searchIndexKey = getScopedRedisKey("cs:search_index");

    let evicted = false;
    // Without Upstash there is no cache to evict, but the ISR tags below must
    // still be revalidated.
    if (isRedisConfigured()) {
      try {
        await Promise.race([
          Promise.all([
            redis.del(cacheKey),
            redis.del(reactionsBaseKey),
            redis.del(allPublishedKey),
            redis.del(searchIndexKey),
          ]),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Redis cache eviction timeout")),
              1500
            )
          ),
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

    await safeRevalidateTag(`case-study-${slug}`);
    await safeRevalidateTag("case-studies");

    return evicted;
  }

  /**
   * Retrieves all published case study slugs for static route generation and sitemaps.
   */
  static async getAllPublishedSlugs(): Promise<string[]> {
    const studies = await CaseStudyService.getAllPublishedCaseStudies();
    return studies.map((s) => s.slug);
  }

  /**
   * Retrieves all published case studies for public search/discovery.
   * Reads the `cs:search_index` Upstash cache (3600s TTL) first; on a miss it
   * queries only the five summary columns from Postgres, appends static
   * fallbacks for slugs absent from the database, and caches the result.
   */
  static async getPublishedCaseStudies(): Promise<CaseStudySearchSummary[]> {
    if (env.PLAYWRIGHT_TEST === "true") {
      return [
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
      ];
    }

    const cacheKey = getScopedRedisKey("cs:search_index");

    // Check the dedicated Upstash search-index cache first. It holds only the
    // five summary fields, so a hit never transfers narrative or playback JSON.
    try {
      const cached = !isRedisConfigured()
        ? null
        : await Promise.race([
            redis.get<CaseStudySearchSummary[]>(cacheKey),
            new Promise<null>((_, reject) =>
              setTimeout(
                () =>
                  reject(new Error("Redis getPublishedCaseStudies timeout")),
                1500
              )
            ),
          ]);

      if (Array.isArray(cached) && cached.length > 0) {
        return cached;
      }
    } catch {
      // Tolerated, fall through to DB query
    }

    let dbStudies: CaseStudySearchSummary[] = [];
    try {
      // Project only the summary columns so Postgres never ships
      // editorial_content, architectural_narrative, commands_json or
      // playback_json for a search index that discards them.
      dbStudies = await prisma.caseStudy.findMany({
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
      return FALLBACK_CASE_STUDIES.map(toSearchSummary);
    }

    const seenSlugs = new Set(dbStudies.map((s) => s.slug));
    const merged: CaseStudySearchSummary[] = [...dbStudies];

    for (const fallback of FALLBACK_CASE_STUDIES) {
      if (!seenSlugs.has(fallback.slug)) {
        merged.push(toSearchSummary(fallback));
        seenSlugs.add(fallback.slug);
      }
    }

    // Populate Redis cache with 3600s TTL
    if (merged.length > 0 && isRedisConfigured()) {
      try {
        await Promise.race([
          redis.set(cacheKey, merged, { ex: 3600 }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Redis cache write timeout")),
              1500
            )
          ),
        ]);
      } catch {
        // Silently tolerate cache write failure
      }
    }

    return merged;
  }

  /**
   * Sanitizes rich text / HTML content submissions and persists draft case study.
   */
  static async submitCaseStudy(input: CaseStudySubmissionInput) {
    const {
      title,
      slug,
      primary_language,
      editorial_content,
      architectural_narrative,
      tags,
      github_url,
    } = input;

    const sanitizedEditorial = await sanitizeContentHtmlLazy(editorial_content);
    const sanitizedNarrative = await sanitizeContentHtmlLazy(
      architectural_narrative
    );

    const created = await prisma.caseStudy.create({
      data: {
        title,
        slug,
        primary_language,
        editorial_content: sanitizedEditorial,
        architectural_narrative: sanitizedNarrative,
        tags,
        github_url: github_url || null,
        published: false,
        simulated_telemetry: false,
      },
    });

    await CaseStudyService.evictCaseStudyCache(slug);
    return created;
  }

  /**
   * Updates the hero image asset URL for a case study and evicts cache.
   */
  static async updateCaseStudyImage(
    slug: string,
    heroImageUrl: string | null
  ): Promise<CaseStudyData> {
    const existing = await prisma.caseStudy.findUnique({
      where: { slug },
    });

    let updated;
    if (existing) {
      updated = await prisma.caseStudy.update({
        where: { slug },
        data: { hero_image_url: heroImageUrl },
      });
    } else {
      const fallback = FALLBACK_CASE_STUDIES.find((f) => f.slug === slug);
      if (!fallback) {
        throw new Error(`Case study with slug "${slug}" not found`);
      }
      updated = await prisma.caseStudy.create({
        data: {
          slug: fallback.slug,
          title: fallback.title,
          primary_language: fallback.primary_language,
          editorial_content: fallback.editorial_content,
          architectural_narrative: fallback.architectural_narrative,
          tags: fallback.tags,
          github_url: fallback.github_url,
          published: true,
          simulated_telemetry: fallback.simulated_telemetry,
          hero_image_url: heroImageUrl,
        },
      });
    }

    await CaseStudyService.evictCaseStudyCache(slug);

    const fallback = FALLBACK_CASE_STUDIES.find((f) => f.slug === slug);
    return {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      primary_language: updated.primary_language,
      github_url: updated.github_url ?? fallback?.github_url ?? "",
      external_platform_url: fallback?.external_platform_url,
      external_platform_type: fallback?.external_platform_type,
      interactive_url: fallback?.interactive_url,
      interactive_label: fallback?.interactive_label,
      benchmarks: fallback?.benchmarks,
      published: updated.published,
      simulated_telemetry: updated.simulated_telemetry,
      tags: updated.tags,
      editorial_content: updated.editorial_content,
      architectural_narrative: updated.architectural_narrative,
      commands_json:
        updated.commands_json ?? fallback?.commands_json ?? undefined,
      playback_json:
        updated.playback_json ?? fallback?.playback_json ?? undefined,
      hero_image_url: updated.hero_image_url ?? null,
      created_at: new Date(updated.created_at),
      updated_at: new Date(updated.updated_at),
    };
  }

  /**
   * Fetches user feedback for a given case study slug.
   */
  static async getFeedback(slug: string, connectionHash: string) {
    try {
      const feedbackList = await prisma.caseStudyFeedback.findMany({
        where: { caseStudySlug: slug },
        select: {
          id: true,
          takeaways: true,
          comments: true,
          createdAt: true,
          connectionHash: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      const hasSubmitted = feedbackList.some(
        (f) => f.connectionHash === connectionHash
      );

      return {
        success: true,
        caseStudySlug: slug,
        hasSubmitted,
        totalFeedback: feedbackList.length,
        feedback: feedbackList.map((f) => ({
          id: f.id,
          takeaways: JSON.parse(f.takeaways || "[]"),
          comments: f.comments,
          createdAt: f.createdAt,
        })),
      };
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.error("Failed to query case study feedback:", err);
      }
      const mockList = mockFeedbackStore.get(slug) || [];
      const hasSubmitted = mockList.some(
        (f) => f.connectionHash === connectionHash
      );
      return {
        success: true,
        caseStudySlug: slug,
        hasSubmitted,
        totalFeedback: mockList.length,
        feedback: mockList.map((f, i) => ({
          id: `mock-${i}`,
          takeaways: f.takeaways,
          comments: f.comments,
          createdAt: f.createdAt,
        })),
      };
    }
  }

  /**
   * Submits feedback for a case study with duplicate rate-limiting.
   */
  static async submitFeedback(
    input: FeedbackSubmissionInput,
    connectionHash: string
  ) {
    const { caseStudySlug, takeaways, comments } = input;

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existing = await prisma.caseStudyFeedback.findFirst({
        where: {
          caseStudySlug,
          connectionHash,
          createdAt: { gte: oneHourAgo },
        },
      });

      if (existing) {
        return {
          rateLimited: true,
          message:
            "Feedback already submitted for this case study. Please try again later.",
        };
      }

      const created = await prisma.caseStudyFeedback.create({
        data: {
          caseStudySlug,
          takeaways: JSON.stringify(takeaways),
          comments,
          connectionHash,
        },
      });

      return {
        rateLimited: false,
        success: true,
        message: "Feedback submitted successfully",
        feedback: {
          id: created.id,
          caseStudySlug: created.caseStudySlug,
          takeaways,
          comments: created.comments,
          createdAt: created.createdAt,
        },
      };
    } catch (dbErr) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.error(
          "Database feedback creation failed, using fallback:",
          dbErr
        );
      }
      const existingMock = (mockFeedbackStore.get(caseStudySlug) || []).find(
        (f) => f.connectionHash === connectionHash
      );
      if (existingMock) {
        return {
          rateLimited: true,
          message:
            "Feedback already submitted for this case study. Please try again later.",
        };
      }

      const list = mockFeedbackStore.get(caseStudySlug) || [];
      const newEntry = {
        takeaways,
        comments,
        connectionHash,
        createdAt: new Date().toISOString(),
      };
      mockFeedbackStore.set(caseStudySlug, [...list, newEntry]);

      return {
        rateLimited: false,
        success: true,
        message: "Feedback submitted successfully",
        feedback: {
          id: `mock-${Date.now()}`,
          caseStudySlug,
          takeaways,
          comments,
          createdAt: newEntry.createdAt,
        },
      };
    }
  }

  /**
   * Gets aggregated reactions for a case study.
   * Employs the Two-Tier Compute Shield (ADR 0036):
   * Reads cached base counts (3600s TTL) and merges uncommitted Redis write-buffer increments,
   * completely avoiding database queries during active browsing.
   */
  static async getReactions(slug: string, connectionHash: string) {
    const bufferKey = getScopedRedisKey(`cs:reactions_buffer:${slug}`);
    const userKey = getScopedRedisKey(
      `cs:user_reactions:${slug}:${connectionHash}`
    );

    try {
      // 1. Fetch base counts (Redis read-through or DB)
      const baseCounts = await getBaseReactionCounts(slug);

      // 2. Fetch buffered increments and user reactions from Redis with 1500ms timeout
      const [rawBuffer, userReactionsRaw] = !isRedisConfigured()
        ? [null, null]
        : await Promise.race([
            Promise.all([
              redis.hgetall<Record<string, string | number>>(bufferKey),
              redis.smembers(userKey),
            ]),
            new Promise<[null, null]>((_, reject) =>
              setTimeout(
                () => reject(new Error("Redis getReactions timeout")),
                1500
              )
            ),
          ]);

      const counts = { ...baseCounts };
      if (rawBuffer && typeof rawBuffer === "object") {
        for (const [r, inc] of Object.entries(rawBuffer)) {
          if (counts[r] !== undefined) {
            counts[r] = (counts[r] || 0) + Math.max(0, Number(inc) || 0);
          }
        }
      }

      let userReactions: string[] = Array.isArray(userReactionsRaw)
        ? userReactionsRaw
        : [];

      // If userReactions is empty in Redis, check DB once to backfill
      if (userReactions.length === 0) {
        try {
          const urList = await prisma.caseStudyReaction.findMany({
            where: { caseStudySlug: slug, connectionHash },
            select: { reactionType: true },
          });
          if (urList.length > 0) {
            userReactions = urList.map((ur) => ur.reactionType);
            try {
              const p = redis.pipeline();
              for (const ur of userReactions) {
                p.sadd(userKey, ur);
              }
              p.expire(userKey, 30 * 24 * 60 * 60);
              await p.exec();
            } catch {
              // Tolerated
            }
          }
        } catch {
          // Tolerated
        }
      }

      return {
        success: true,
        caseStudySlug: slug,
        counts,
        userReactions,
      };
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "CaseStudyService.getReactions: Redis path failed, falling back to DB/mock:",
          err
        );
      }

      // Fall back to direct Prisma queries
      try {
        const reactions = await prisma.caseStudyReaction.groupBy({
          by: ["reactionType"],
          where: { caseStudySlug: slug },
          _count: { id: true },
        });

        const userReactionsList = await prisma.caseStudyReaction.findMany({
          where: { caseStudySlug: slug, connectionHash },
          select: { reactionType: true },
        });

        const counts = getDefaultReactionCounts();
        for (const r of reactions) {
          if (counts[r.reactionType] !== undefined) {
            counts[r.reactionType] = r._count.id;
          }
        }

        return {
          success: true,
          caseStudySlug: slug,
          counts,
          userReactions: userReactionsList.map((ur) => ur.reactionType),
        };
      } catch (dbErr) {
        if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
          logger.error("Failed to query case study reactions from DB:", dbErr);
        }
        const counts = getDefaultReactionCounts();
        const slugMap = mockReactionsStore.get(slug);
        if (slugMap) {
          for (const [r, count] of slugMap.entries()) {
            counts[r] = count;
          }
        }
        return {
          success: true,
          caseStudySlug: slug,
          counts,
          userReactions: [],
        };
      }
    }
  }

  /**
   * Submits a reaction for a case study.
   * Employs Write-Buffering in Upstash Redis (ADR 0036):
   * Buffers reaction increments via HINCRBY and enqueues events without waking Neon Postgres.
   */
  static async submitReaction(
    input: ReactionSubmissionInput,
    connectionHash: string
  ) {
    const { caseStudySlug, reactionType } = input;
    const userKey = getScopedRedisKey(
      `cs:user_reactions:${caseStudySlug}:${connectionHash}`
    );
    const bufferKey = getScopedRedisKey(`cs:reactions_buffer:${caseStudySlug}`);
    const queueKey = getScopedRedisKey("cs:reactions_queue");
    const dirtyKey = getScopedRedisKey("cs:dirty_reactions");

    // Local, test and preview runs without Upstash credentials have no usable
    // Redis. Go straight to the durable path rather than spending two 1500ms
    // timeouts per reaction before the catch below falls back anyway.
    if (!isRedisConfigured()) {
      return submitReactionDirect(caseStudySlug, reactionType, connectionHash);
    }

    try {
      // 1. Check if user already reacted via Redis
      const isMember = await Promise.race([
        redis.sismember(userKey, reactionType),
        new Promise<number>((_, reject) =>
          setTimeout(() => reject(new Error("Redis sismember timeout")), 1500)
        ),
      ]);

      let userReactions: string[] = [];

      if (isMember === 1) {
        // Already reacted, do not duplicate increment
        let members: unknown = null;
        try {
          members = await redis.smembers(userKey);
        } catch {
          // Tolerated
        }
        userReactions = Array.isArray(members)
          ? (members as string[])
          : [reactionType];
      } else {
        // New reaction: push event to queue, increment buffer, and record user reaction
        const eventId = crypto.randomUUID();
        const event: BufferedReactionEvent = {
          id: eventId,
          caseStudySlug,
          reactionType,
          connectionHash,
          createdAt: new Date().toISOString(),
        };

        const p = redis.pipeline();
        p.sadd(userKey, reactionType);
        p.expire(userKey, 30 * 24 * 60 * 60); // 30 days
        p.hincrby(bufferKey, reactionType, 1);
        p.rpush(queueKey, event);
        p.sadd(dirtyKey, caseStudySlug);

        await Promise.race([
          p.exec(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Redis submitReaction pipeline timeout")),
              1500
            )
          ),
        ]);

        let members: unknown = null;
        try {
          members = await redis.smembers(userKey);
        } catch {
          // Tolerated
        }
        userReactions = Array.isArray(members)
          ? (members as string[])
          : [reactionType];
        if (!userReactions.includes(reactionType)) {
          userReactions.push(reactionType);
        }
      }

      // Get current merged counts
      const baseCounts = await getBaseReactionCounts(caseStudySlug);
      let rawBuffer: Record<string, string | number> | null = null;
      try {
        rawBuffer =
          await redis.hgetall<Record<string, string | number>>(bufferKey);
      } catch {
        // Tolerated
      }
      const counts = { ...baseCounts };
      if (rawBuffer && typeof rawBuffer === "object") {
        for (const [r, inc] of Object.entries(rawBuffer)) {
          if (counts[r] !== undefined) {
            counts[r] = (counts[r] || 0) + Math.max(0, Number(inc) || 0);
          }
        }
      }

      return {
        success: true,
        reactionType,
        counts,
        userReactions,
      };
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "CaseStudyService.submitReaction: Redis buffering failed, falling back to DB/mock:",
          err
        );
      }

      return submitReactionDirect(caseStudySlug, reactionType, connectionHash);
    }
  }

  /**
   * Flushes buffered reactions from Upstash Redis to Neon Postgres in batches.
   * Designed for execution during scheduled maintenance (ADR 0036).
   */
  static async flushBufferedReactionsToDatabase(
    batchSize = 500
  ): Promise<{ processed: number; inserted: number }> {
    const queueKey = getScopedRedisKey("cs:reactions_queue");
    const processingKey = getScopedRedisKey("cs:reactions_processing");
    const dirtyKey = getScopedRedisKey("cs:dirty_reactions");

    // Nothing can have been buffered without Redis, so the daily cron should
    // not spend a round trip against a dummy endpoint.
    if (!isRedisConfigured()) {
      return { processed: 0, inserted: 0 };
    }

    try {
      // 1. Fetch pending items from processing queue (if any from previous interrupted sync)
      const existingProcessing = (await redis.lrange(
        processingKey,
        0,
        -1
      )) as BufferedReactionEvent[];
      let events: BufferedReactionEvent[] = Array.isArray(existingProcessing)
        ? existingProcessing
        : [];

      // 2. Atomically move items from queue to processing if under batchSize
      if (events.length < batchSize) {
        // Clamp to the real queue depth. A blind batchSize-wide pipeline burns
        // one Upstash command per slot every run even when the queue is empty,
        // which the 10k commands/day ceiling in AGENTS.md section 22 cannot absorb.
        const queueDepth = await redis.llen(queueKey);
        const needed = Math.min(batchSize - events.length, queueDepth);

        if (needed > 0) {
          const p = redis.pipeline();
          for (let i = 0; i < needed; i++) {
            p.lmove(queueKey, processingKey, "right", "left");
          }
          p.expire(processingKey, 48 * 60 * 60);
          const moveResults = await p.exec();

          const newlyMoved = moveResults.filter(
            (item): item is BufferedReactionEvent =>
              item !== null &&
              typeof item === "object" &&
              "id" in item &&
              "caseStudySlug" in item
          );
          events = [...events, ...newlyMoved];
        }
      }

      if (events.length === 0) {
        return { processed: 0, inserted: 0 };
      }

      // 3. Persist events to Postgres in batch
      let createResult: { count: number };
      try {
        createResult = await prisma.caseStudyReaction.createMany({
          data: events.map((e) => ({
            // Pin the primary key to the id minted when the event was buffered.
            // The primary key makes queue replays idempotent, while the payload
            // constraint prevents duplicate visitor reactions.
            id: e.id,
            caseStudySlug: e.caseStudySlug,
            reactionType: e.reactionType,
            connectionHash: e.connectionHash,
            createdAt: new Date(e.createdAt),
          })),
          skipDuplicates: true,
        });
      } catch (dbErr) {
        logger.error(
          "CaseStudyService.flushBufferedReactionsToDatabase: DB write failed; events remain in processing queue:",
          dbErr
        );
        throw dbErr;
      }

      // 4. Acknowledge persisted events from processing queue and reconcile buffer counters
      const flushedCountsBySlug: Record<string, Record<string, number>> = {};
      for (const e of events) {
        if (!flushedCountsBySlug[e.caseStudySlug]) {
          flushedCountsBySlug[e.caseStudySlug] = {};
        }
        flushedCountsBySlug[e.caseStudySlug][e.reactionType] =
          (flushedCountsBySlug[e.caseStudySlug][e.reactionType] || 0) + 1;
      }

      const ack = redis.pipeline();
      for (const event of events) {
        ack.lrem(processingKey, 1, event);
      }

      for (const [slug, typeCounts] of Object.entries(flushedCountsBySlug)) {
        const bufferKey = getScopedRedisKey(`cs:reactions_buffer:${slug}`);
        const baseKey = getScopedRedisKey(`cs:reactions_counts:${slug}`);

        for (const [type, count] of Object.entries(typeCounts)) {
          ack.hincrby(bufferKey, type, -count);
        }
        // Evict cached base count so next read pulls updated DB totals
        ack.del(baseKey);
      }

      await ack.exec();

      // Clean up empty buffers and dirty flags
      for (const slug of Object.keys(flushedCountsBySlug)) {
        const bufferKey = getScopedRedisKey(`cs:reactions_buffer:${slug}`);
        let remainingBuffer: Record<string, string | number> | null = null;
        try {
          remainingBuffer =
            await redis.hgetall<Record<string, string | number>>(bufferKey);
        } catch {
          // Tolerated
        }

        let allZeroOrEmpty = true;
        if (remainingBuffer && typeof remainingBuffer === "object") {
          for (const [key, val] of Object.entries(remainingBuffer)) {
            if (Number(val) <= 0) {
              try {
                await redis.hdel(bufferKey, key);
              } catch {
                // Tolerated
              }
            } else {
              allZeroOrEmpty = false;
            }
          }
        }

        if (allZeroOrEmpty) {
          try {
            await redis.del(bufferKey);
          } catch {
            // Tolerated
          }
          try {
            await redis.srem(dirtyKey, slug);
          } catch {
            // Tolerated
          }
        }
      }

      return {
        processed: events.length,
        inserted: createResult.count,
      };
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "CaseStudyService.flushBufferedReactionsToDatabase: Flush operation encountered error:",
          err
        );
      }
      return { processed: 0, inserted: 0 };
    }
  }
}
