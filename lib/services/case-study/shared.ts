import { z } from "zod";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import {
  FALLBACK_CASE_STUDIES,
  type CaseStudyData,
} from "@/lib/case-studies-data";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
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
  "INVALID_CASE_STUDY_IMAGE_INPUT",
  "CASE_STUDY_NOT_FOUND",
  "PERSISTENCE_FAILED",
]);
export type CaseStudyImageErrorCode = z.infer<typeof CaseStudyImageErrorCode>;

export type UpdateCaseStudyImageResult = ServiceResult<
  CaseStudyData,
  CaseStudyImageErrorCode
>;

export const CaseStudyReactionFlushErrorCode = z.enum([
  "PERSISTENCE_FAILED",
  "FLUSH_FAILED",
]);
export type CaseStudyReactionFlushErrorCode = z.infer<
  typeof CaseStudyReactionFlushErrorCode
>;

export type CaseStudyReactionFlushResult = ServiceResult<
  { processed: number; inserted: number },
  CaseStudyReactionFlushErrorCode
>;

export function toCaseStudySearchSummary(
  study: CaseStudySearchSummary
): CaseStudySearchSummary {
  return {
    id: study.id,
    slug: study.slug,
    title: study.title,
    primary_language: study.primary_language,
    tags: study.tags,
  };
}

export function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export function getDefaultCaseStudyReactionCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of ALLOWED_CASE_STUDY_REACTIONS) {
    counts[r] = 0;
  }
  return counts;
}

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
    // Tolerated outside of Next.js server runtime (e.g. unit tests)
  }
}

export async function safeRevalidateCaseStudyPath(path: string): Promise<void> {
  try {
    const { revalidatePath } = await import("next/cache");
    if (typeof revalidatePath === "function") {
      revalidatePath(path);
    }
  } catch {
    // Tolerated outside of Next.js server runtime (e.g. unit tests)
  }
}

export interface RawCaseStudyRecord {
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
  commands_json: string | null;
  playback_json: string | null;
  hero_image_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export function mapCaseStudyRecordToData(
  record: RawCaseStudyRecord,
  options: { preserveNullHeroImage?: boolean } = {}
): CaseStudyData {
  const fallback = FALLBACK_CASE_STUDIES.find((f) => f.slug === record.slug);
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    primary_language: record.primary_language,
    github_url: record.github_url ?? fallback?.github_url ?? "",
    external_platform_url: fallback?.external_platform_url,
    external_platform_type: fallback?.external_platform_type,
    interactive_url: fallback?.interactive_url,
    interactive_label: fallback?.interactive_label,
    benchmarks: fallback?.benchmarks,
    published: record.published,
    simulated_telemetry: record.simulated_telemetry,
    tags: record.tags,
    editorial_content: record.editorial_content,
    architectural_narrative: record.architectural_narrative,
    commands_json: record.commands_json ?? fallback?.commands_json ?? undefined,
    playback_json: record.playback_json ?? fallback?.playback_json ?? undefined,
    hero_image_url: options.preserveNullHeroImage
      ? (record.hero_image_url ?? null)
      : (record.hero_image_url ?? fallback?.hero_image_url ?? null),
    created_at: new Date(record.created_at),
    updated_at: new Date(record.updated_at),
  };
}

export async function getBaseCaseStudyReactionCounts(
  slug: string
): Promise<Record<string, number>> {
  const baseKey = getScopedRedisKey(`cs:reactions_counts:${slug}`);
  try {
    const cached = !isRedisConfigured()
      ? null
      : await withRedisTimeout(
          redis.get<Record<string, number>>(baseKey),
          1500,
          "Redis getBaseReactionCounts timeout"
        );
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
    if (isRedisConfigured()) {
      try {
        await withRedisTimeout(
          redis.set(baseKey, counts, { ex: 3600 }),
          1500,
          "Redis setBaseReactionCounts timeout"
        );
      } catch {
        // Tolerated
      }
    }
  } catch (err) {
    if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
      logger.warn(
        `CaseStudy: Failed to query base reactions for ${slug}:`,
        err
      );
    }
  }

  return counts;
}
