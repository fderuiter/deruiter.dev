import { z } from "zod";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import {
  FALLBACK_CASE_STUDIES,
  type CaseStudyData,
} from "@/lib/case-studies-data";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import type { ServiceResult } from "@/lib/services/service-result";

export type { CaseStudyData };

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

/** The five fields `/api/case-studies` exposes for search and discovery. */
export type CaseStudySearchSummary = Pick<
  CaseStudyData,
  "id" | "slug" | "title" | "primary_language" | "tags"
>;

export const ALLOWED_CASE_STUDY_REACTIONS = [
  "insightful",
  "mind_blowing",
  "actionable",
  "thorough",
] as const;

export const CaseStudyImageErrorCode = z.enum([
  "CASE_STUDY_NOT_FOUND",
  "PERSISTENCE_FAILED",
  "INVALID_INPUT",
]);
export type CaseStudyImageErrorCode = z.infer<typeof CaseStudyImageErrorCode>;

export type UpdateCaseStudyImageResult = ServiceResult<
  CaseStudyData,
  CaseStudyImageErrorCode
>;

export const CaseStudyReactionFlushErrorCode = z.enum([
  "PERSISTENCE_FAILED",
  "FLUSH_FAILED",
  "INVALID_INPUT",
]);
export type CaseStudyReactionFlushErrorCode = z.infer<
  typeof CaseStudyReactionFlushErrorCode
>;

export type CaseStudyReactionFlushResult = ServiceResult<
  { processed: number; inserted: number },
  CaseStudyReactionFlushErrorCode
>;

export function toCaseStudySearchSummary(
  s: CaseStudySearchSummary
): CaseStudySearchSummary {
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    primary_language: s.primary_language,
    tags: s.tags,
  };
}

export function getDefaultCaseStudyReactionCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of ALLOWED_CASE_STUDY_REACTIONS) {
    counts[r] = 0;
  }
  return counts;
}

/** Prisma unique-constraint violation check (`P2002`). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Pages that render a case study and require ISR revalidation on mutation. */
export function caseStudyPaths(slug: string): string[] {
  const paths = ["/", "/case-studies", `/case-studies/${slug}`];
  if (slug === "laser-loon") paths.push("/work/laser-loon");
  return paths;
}

export async function safeRevalidateCaseStudyTag(tag: string): Promise<void> {
  try {
    const { revalidateTag } = await import("next/cache");
    if (typeof revalidateTag === "function") {
      revalidateTag(tag, "max");
    }
  } catch {
    // Tolerated outside of Next.js server runtime
  }
}

export async function safeRevalidateCaseStudyPath(path: string): Promise<void> {
  try {
    const { revalidatePath } = await import("next/cache");
    if (typeof revalidatePath === "function") {
      revalidatePath(path);
    }
  } catch {
    // Tolerated outside of Next.js server runtime
  }
}

export interface CaseStudyDbRowLike {
  id: string;
  slug: string;
  title: string;
  primary_language: string;
  github_url: string | null;
  published: boolean;
  simulated_telemetry: boolean;
  tags: string;
  editorial_content: string;
  architectural_narrative: string;
  commands_json: unknown;
  playback_json: unknown;
  hero_image_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export function mapCaseStudyDbRecord(
  r: CaseStudyDbRowLike,
  preserveExplicitNullHero = false
): CaseStudyData {
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
      (r.commands_json as CaseStudyData["commands_json"]) ??
      fallback?.commands_json ??
      undefined,
    playback_json:
      (r.playback_json as CaseStudyData["playback_json"]) ??
      fallback?.playback_json ??
      undefined,
    hero_image_url: preserveExplicitNullHero
      ? (r.hero_image_url ?? null)
      : (r.hero_image_url ?? fallback?.hero_image_url ?? null),
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
  };
}

export interface BaseReactionRedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
}

export interface BaseReactionCountsDeps {
  redisClient?: BaseReactionRedisLike;
  isRedisReady?: () => boolean;
  db?: Pick<typeof prisma, "caseStudyReaction">;
}

export async function getBaseCaseStudyReactionCounts(
  slug: string,
  deps: BaseReactionCountsDeps = {}
): Promise<Record<string, number>> {
  const redisClient = deps.redisClient ?? redis;
  const redisReady = (deps.isRedisReady ?? isRedisConfigured)();
  const db = deps.db ?? prisma;
  const baseKey = getScopedRedisKey(`cs:reactions_counts:${slug}`);

  try {
    const cached = !redisReady
      ? null
      : await Promise.race([
          redisClient.get<Record<string, number>>(baseKey),
          new Promise<null>((_, reject) => {
            const t = setTimeout(
              () => reject(new Error("Redis getBaseReactionCounts timeout")),
              1500
            );
            t.unref?.();
          }),
        ]);
    if (cached && typeof cached === "object") {
      const counts = getDefaultCaseStudyReactionCounts();
      for (const r of ALLOWED_CASE_STUDY_REACTIONS) {
        if (typeof cached[r] === "number") {
          counts[r] = cached[r];
        }
      }
      return counts;
    }
  } catch {
    // Tolerated, fall through to database query
  }

  const counts = getDefaultCaseStudyReactionCounts();
  try {
    const reactions = await db.caseStudyReaction.groupBy({
      by: ["reactionType"],
      where: { caseStudySlug: slug },
      _count: { id: true },
    });
    for (const r of reactions) {
      if (counts[r.reactionType] !== undefined) {
        counts[r.reactionType] = r._count.id;
      }
    }
    if (redisReady) {
      try {
        await Promise.race([
          redisClient.set(baseKey, counts, { ex: 3600 }),
          new Promise((_, reject) => {
            const t = setTimeout(
              () => reject(new Error("Redis setBaseReactionCounts timeout")),
              1500
            );
            t.unref?.();
          }),
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
  }

  return counts;
}
