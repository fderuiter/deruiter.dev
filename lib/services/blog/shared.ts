import { z } from "zod";
import { CONTENT_PILLARS, type ContentPillar } from "@/lib/blog/types";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import type { BlogPostData } from "@/lib/fallback-blog-posts";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
import { ALLOWED_REACTIONS } from "@/lib/schemas";
import {
  createFailure,
  createSuccess,
  type ServiceResult,
} from "@/lib/services/service-result";

export type { BlogPostData };

export interface PersistedBlogPostRecord {
  id: string;
  slug: string;
  title: string;
  dek: string;
  body: string;
  pillar: string;
  tags: string;
  published: boolean;
  reading_time_minutes: number | null;
  hero_image_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BlogPostReactionSubmissionInput {
  blogPostSlug: string;
  reactionType: string;
}

export interface BufferedBlogReactionEvent {
  id: string;
  blogPostSlug: string;
  reactionType: string;
  connectionHash: string;
  createdAt: string;
}

export interface CreateBlogDraftInput {
  title: string;
  slug: string;
  dek: string;
  body: string;
  pillar: ContentPillar;
  tags: string;
  hero_image_url: string | null;
}

export interface UpdateBlogDraftInput {
  title?: string;
  slug?: string;
  dek?: string;
  body?: string;
  pillar?: ContentPillar;
  tags?: string[];
  heroImageUrl?: string | null;
  published?: boolean;
}

export interface BlogDraftPagination {
  page: number;
  pageSize: number;
}

export const BlogPostDateErrorCode = z.enum(["INVALID_DATE_CONTRACT"]);
export type BlogPostDateErrorCode = z.infer<typeof BlogPostDateErrorCode>;

export type BlogPostDatesResult = ServiceResult<
  BlogPostData,
  BlogPostDateErrorCode
>;

export const BlogReactionFlushErrorCode = z.enum([
  "PERSISTENCE_FAILED",
  "FLUSH_FAILED",
]);
export type BlogReactionFlushErrorCode = z.infer<
  typeof BlogReactionFlushErrorCode
>;

export type BlogReactionFlushResult = ServiceResult<
  { processed: number; inserted: number },
  BlogReactionFlushErrorCode
>;

export function isBlogUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === "P2002" ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("Unique constraint failed"))
  );
}

export function computeReadingTimeMinutes(sanitizedHtml: string): number {
  const wordCount = sanitizedHtml
    .replace(/<[^>]*>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export function isValidPillar(pillar: unknown): pillar is ContentPillar {
  return (
    typeof pillar === "string" &&
    (CONTENT_PILLARS as readonly string[]).includes(pillar)
  );
}

export function parseValidDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;

  if (
    value instanceof Date ||
    Object.prototype.toString.call(value) === "[object Date]"
  ) {
    const d = value as Date;
    const time = d.getTime();
    if (Number.isNaN(time)) return null;
    const year = d.getUTCFullYear();
    if (year < 1970 || year > 9999) return null;
    try {
      d.toISOString();
      return new Date(time);
    } catch {
      return null;
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    const time = d.getTime();
    if (Number.isNaN(time)) return null;
    const year = d.getUTCFullYear();
    if (year < 1970 || year > 9999) return null;
    try {
      d.toISOString();
      return new Date(time);
    } catch {
      return null;
    }
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (value < 0 || value > 253402300799999) return null;
    const d = new Date(value);
    const time = d.getTime();
    if (Number.isNaN(time)) return null;
    const year = d.getUTCFullYear();
    if (year < 1970 || year > 9999) return null;
    try {
      d.toISOString();
      return new Date(time);
    } catch {
      return null;
    }
  }

  return null;
}

export function isValidBlogPost(item: unknown): item is BlogPostData {
  if (!item || typeof item !== "object") return false;
  const p = item as Record<string, unknown>;
  if (
    typeof p.id !== "string" ||
    !p.id.trim() ||
    typeof p.slug !== "string" ||
    !p.slug.trim() ||
    typeof p.title !== "string" ||
    !p.title.trim() ||
    typeof p.dek !== "string" ||
    typeof p.body !== "string" ||
    !isValidPillar(p.pillar) ||
    typeof p.tags !== "string" ||
    p.published !== true
  ) {
    return false;
  }

  if (
    p.reading_time_minutes !== null &&
    p.reading_time_minutes !== undefined &&
    (typeof p.reading_time_minutes !== "number" ||
      !Number.isFinite(p.reading_time_minutes) ||
      p.reading_time_minutes < 0)
  ) {
    return false;
  }

  if (
    p.hero_image_url !== null &&
    p.hero_image_url !== undefined &&
    typeof p.hero_image_url !== "string"
  ) {
    return false;
  }

  const createdAt = parseValidDate(p.created_at);
  const updatedAt = parseValidDate(p.updated_at);
  if (!createdAt || !updatedAt) {
    return false;
  }

  return true;
}

export function parseBlogPostDates(post: BlogPostData): BlogPostDatesResult {
  const createdAt = parseValidDate(post?.created_at);
  const updatedAt = parseValidDate(post?.updated_at);
  if (!createdAt || !updatedAt) {
    return createFailure(
      "INVALID_DATE_CONTRACT",
      `parseBlogPostDates: Invalid date contract for blog post "${post?.slug ?? "unknown"}"`,
      { recoverable: false }
    );
  }
  return createSuccess({
    ...post,
    created_at: createdAt,
    updated_at: updatedAt,
  });
}

export function toValidBlogPosts(items: readonly unknown[]): BlogPostData[] {
  const posts: BlogPostData[] = [];
  for (const item of items) {
    if (!isValidBlogPost(item)) continue;
    const parsed = parseBlogPostDates(item);
    if (parsed.success) posts.push(parsed.data);
  }
  return posts;
}

export function toValidBlogPost(item: unknown): BlogPostData | null {
  return toValidBlogPosts([item])[0] ?? null;
}

export function compareBlogPostsNewestFirst<
  T extends { created_at: Date; slug: string },
>(a: T, b: T): number {
  const timeA =
    a.created_at instanceof Date
      ? a.created_at.getTime()
      : new Date(a.created_at).getTime();
  const timeB =
    b.created_at instanceof Date
      ? b.created_at.getTime()
      : new Date(b.created_at).getTime();

  const validA = !Number.isNaN(timeA);
  const validB = !Number.isNaN(timeB);

  if (validA && validB) {
    const timeDiff = timeB - timeA;
    if (timeDiff !== 0) {
      return timeDiff;
    }
  } else if (validA && !validB) {
    return -1;
  } else if (!validA && validB) {
    return 1;
  }

  const slugA = typeof a.slug === "string" ? a.slug : "";
  const slugB = typeof b.slug === "string" ? b.slug : "";
  return slugA.localeCompare(slugB);
}

export function getDefaultBlogReactionCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of ALLOWED_REACTIONS) {
    counts[r] = 0;
  }
  return counts;
}

/**
 * Zero-Neon-Wake Boundary (ADR 0043 §3): Never query Postgres on the public read path.
 * When Redis is cold or times out, return zeroed defaults without querying Postgres.
 */
export async function getBaseBlogReactionCounts(
  slug: string
): Promise<Record<string, number>> {
  const baseKey = getScopedRedisKey(`blog:reactions_counts:${slug}`);
  try {
    const cached = !isRedisConfigured()
      ? null
      : await withRedisTimeout(
          redis.get<Record<string, number>>(baseKey),
          1500,
          "Redis getBaseBlogReactionCounts timeout"
        );
    if (cached && typeof cached === "object") {
      const counts = getDefaultBlogReactionCounts();
      for (const r of ALLOWED_REACTIONS) {
        if (typeof cached[r] === "number") {
          counts[r] = cached[r];
        }
      }
      return counts;
    }
  } catch {
    // Tolerated
  }

  return getDefaultBlogReactionCounts();
}

export async function hydrateBlogReactionCounts(
  slug: string
): Promise<Record<string, number>> {
  const baseKey = getScopedRedisKey(`blog:reactions_counts:${slug}`);
  const counts = getDefaultBlogReactionCounts();

  try {
    const reactions = await prisma.blogPostReaction.groupBy({
      by: ["reactionType"],
      where: { blogPostSlug: slug },
      _count: { id: true },
    });
    for (const r of reactions) {
      if (counts[r.reactionType] !== undefined) {
        counts[r.reactionType] = r._count.id;
      }
    }

    if (isRedisConfigured()) {
      await withRedisTimeout(
        redis.set(baseKey, counts),
        1500,
        "Redis hydrateBlogReactionCounts timeout"
      );
    }
  } catch (err) {
    if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
      logger.warn(
        `BlogPost: Failed to hydrate base reactions for ${slug}:`,
        err
      );
    }
  }

  return counts;
}

export async function safeRevalidateBlogPath(
  path: string,
  type?: "layout" | "page"
): Promise<void> {
  try {
    const { revalidatePath } = await import("next/cache");
    if (typeof revalidatePath === "function") {
      revalidatePath(path, type);
    }
  } catch (err) {
    if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
      logger.warn(`BlogPost: Path revalidation failed for "${path}":`, err);
    }
  }
}

export async function safeRevalidateBlogTag(tag: string): Promise<void> {
  try {
    const { revalidateTag } = await import("next/cache");
    if (typeof revalidateTag === "function") {
      revalidateTag(tag, "max");
    }
  } catch (err) {
    if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
      logger.warn(`BlogPost: Tag revalidation failed for "${tag}":`, err);
    }
  }
}
