import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { FALLBACK_BLOG_POSTS, BlogPostData } from "@/lib/fallback-blog-posts";
import { redis, getScopedRedisKey, isRedisConfigured } from "@/lib/redis";
import { CONTENT_PILLARS, type ContentPillar } from "@/lib/blog/types";
import { sanitizeContentHtmlLazy } from "@/lib/content-sanitizer-lazy";
import { ALLOWED_REACTIONS } from "@/lib/schemas";
import { logger } from "@/lib/logger";
import { z } from "zod";
import {
  createFailure,
  createSuccess,
  type ServiceResult,
} from "@/lib/services/service-result";
import { flushOutboxQueue } from "@/lib/services/event-outbox";

export type { BlogPostData };

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

const mockBlogReactionsStore = new Map<string, Map<string, number>>();

function getDefaultBlogReactionCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of ALLOWED_REACTIONS) {
    counts[r] = 0;
  }
  return counts;
}

async function getBaseBlogReactionCounts(
  slug: string
): Promise<Record<string, number>> {
  const baseKey = getScopedRedisKey(`blog:reactions_counts:${slug}`);
  try {
    const cached = !isRedisConfigured()
      ? null
      : await Promise.race([
          redis.get<Record<string, number>>(baseKey),
          new Promise<null>((_, reject) =>
            setTimeout(
              () =>
                reject(new Error("Redis getBaseBlogReactionCounts timeout")),
              1500
            )
          ),
        ]);
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

  // Zero-Neon-Wake Boundary (ADR 0043 §3): Never query Postgres on the public read path.
  // When Redis is cold or times out, return zeroed defaults without querying Postgres. Database is hydrated exclusively during seed or scheduled maintenance.
  const counts = getDefaultBlogReactionCounts();
  if (!isRedisConfigured()) {
    const slugMap = mockBlogReactionsStore.get(slug);
    if (slugMap) {
      for (const [r, count] of slugMap.entries()) {
        counts[r] = count;
      }
    }
  }

  return counts;
}

async function submitBlogReactionDirect(
  blogPostSlug: string,
  reactionType: string,
  connectionHash: string
) {
  try {
    const existing = await prisma.blogPostReaction.findFirst({
      where: {
        blogPostSlug,
        reactionType,
        connectionHash,
      },
    });

    if (existing) {
      const reactions = await prisma.blogPostReaction.groupBy({
        by: ["reactionType"],
        where: { blogPostSlug },
        _count: { id: true },
      });
      const userReactionsList = await prisma.blogPostReaction.findMany({
        where: { blogPostSlug, connectionHash },
        select: { reactionType: true },
      });
      const counts = getDefaultBlogReactionCounts();
      for (const r of reactions) {
        if (counts[r.reactionType] !== undefined) {
          counts[r.reactionType] = r._count.id;
        }
      }
      return {
        success: false,
        duplicate: true,
        reactionType,
        counts,
        userReactions: userReactionsList.map((ur) => ur.reactionType),
        message: "Duplicate reaction within the sliding window",
      };
    }

    await prisma.blogPostReaction.create({
      data: {
        blogPostSlug,
        reactionType,
        connectionHash,
      },
    });

    const reactions = await prisma.blogPostReaction.groupBy({
      by: ["reactionType"],
      where: { blogPostSlug },
      _count: { id: true },
    });

    const userReactionsList = await prisma.blogPostReaction.findMany({
      where: { blogPostSlug, connectionHash },
      select: { reactionType: true },
    });

    const counts = getDefaultBlogReactionCounts();
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
  } catch (err) {
    if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
      logger.warn(
        "Database blog reaction creation failed, using mock fallback:",
        err
      );
    }

    let slugMap = mockBlogReactionsStore.get(blogPostSlug);
    if (!slugMap) {
      slugMap = new Map();
      mockBlogReactionsStore.set(blogPostSlug, slugMap);
    }
    const currentCount = slugMap.get(reactionType) || 0;
    slugMap.set(reactionType, currentCount + 1);

    const counts = getDefaultBlogReactionCounts();
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

/**
 * Validates whether a pillar identifier matches the closed ContentPillar taxonomy.
 */
export function isValidPillar(pillar: unknown): pillar is ContentPillar {
  return (
    typeof pillar === "string" &&
    (CONTENT_PILLARS as readonly string[]).includes(pillar)
  );
}

/**
 * Safely parses and validates a date value into a concrete Date instance.
 * Rejects NaN dates, unparsable strings, and out-of-range timestamps.
 */
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

/**
 * Asserts whether an unknown item satisfies the BlogPostData contract with
 * validated dates, non-empty identity fields, and closed pillar taxonomy.
 */
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

/**
 * Error codes returned by {@link parseBlogPostDates} (ADR 0028).
 */
export const BlogPostDateErrorCode = z.enum(["INVALID_DATE_CONTRACT"]);
export type BlogPostDateErrorCode = z.infer<typeof BlogPostDateErrorCode>;

/** Result envelope of {@link parseBlogPostDates}. */
export type BlogPostDatesResult = ServiceResult<
  BlogPostData,
  BlogPostDateErrorCode
>;

/**
 * Error codes returned by {@link BlogPostService.flushBufferedReactionsToDatabase}
 * (ADR 0028).
 *
 * `PERSISTENCE_FAILED` means the batch did not reach Postgres and stays in the
 * processing queue for the next run. `FLUSH_FAILED` covers the Redis queue
 * reads and acknowledgement around it; persisted events that were not
 * acknowledged are replayed idempotently through their pinned ids.
 */
export const BlogReactionFlushErrorCode = z.enum([
  "PERSISTENCE_FAILED",
  "FLUSH_FAILED",
]);
export type BlogReactionFlushErrorCode = z.infer<
  typeof BlogReactionFlushErrorCode
>;

/** Result envelope of {@link BlogPostService.flushBufferedReactionsToDatabase}. */
export type BlogReactionFlushResult = ServiceResult<
  { processed: number; inserted: number },
  BlogReactionFlushErrorCode
>;

/**
 * Coerces created_at and updated_at on a BlogPostData record into validated
 * Date instances. Returns `INVALID_DATE_CONTRACT` when either date is invalid.
 */
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

/**
 * Validates candidate records and returns the valid ones with coerced dates,
 * preserving input order. Records failing either check are dropped.
 */
export function toValidBlogPosts(items: readonly unknown[]): BlogPostData[] {
  const posts: BlogPostData[] = [];
  for (const item of items) {
    if (!isValidBlogPost(item)) continue;
    const parsed = parseBlogPostDates(item);
    if (parsed.success) posts.push(parsed.data);
  }
  return posts;
}

/** Returns the post with coerced dates, or null when the record is invalid. */
function toValidBlogPost(item: unknown): BlogPostData | null {
  return toValidBlogPosts([item])[0] ?? null;
}

/**
 * Deterministic newest-first sort comparator for blog post items.
 * Uses created_at descending with slug ascending as a tie-breaker.
 * Handles invalid or missing dates safely without returning NaN.
 */
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

/**
 * Executes a promise with an upper timeout bound, always clearing the underlying
 * timer resource upon completion to prevent timer leaks in event loops.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutErrorMsg: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutErrorMsg));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function safeRevalidatePath(
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
      logger.warn(
        `BlogPostService.safeRevalidatePath: Path revalidation failed for "${path}":`,
        err
      );
    }
  }
}

async function safeRevalidateTag(tag: string): Promise<void> {
  try {
    const { revalidateTag } = await import("next/cache");
    if (typeof revalidateTag === "function") {
      revalidateTag(tag, "max");
    }
  } catch (err) {
    if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
      logger.warn(
        `BlogPostService.safeRevalidateTag: Tag revalidation failed for "${tag}":`,
        err
      );
    }
  }
}

export class BlogPostService {
  /**
   * Retrieves all persisted blog posts (published and drafts) ordered by update timestamp
   * for administrative display.
   */
  static async getAllBlogPostsAdmin() {
    try {
      return await prisma.blogPost.findMany({
        orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "BlogPostService.getAllBlogPostsAdmin: Database query failed:",
          err
        );
      }
      failBuildOnDataSourceError("BlogPostService.getAllBlogPostsAdmin", err);
      return [];
    }
  }

  /**
   * Retrieves only persisted unpublished drafts for the authenticated admin
   * collection. This intentionally never consults the public fallback data.
   */
  static async getDraftBlogPosts({ page, pageSize }: BlogDraftPagination) {
    const skip = (page - 1) * pageSize;
    const [drafts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where: { published: false },
        orderBy: [{ updated_at: "desc" }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.blogPost.count({ where: { published: false } }),
    ]);

    return { drafts, total };
  }

  /**
   * Persists an unpublished blog draft using server-owned publication state.
   * The existing public cache is evicted only after Prisma confirms creation.
   */
  static async createDraftBlogPost(input: CreateBlogDraftInput) {
    const sanitizedBody = await sanitizeContentHtmlLazy(input.body);
    const wordCount = sanitizedBody
      .replace(/<[^>]*>/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    const created = await prisma.blogPost.create({
      data: {
        title: input.title,
        slug: input.slug,
        dek: input.dek,
        body: sanitizedBody,
        pillar: input.pillar,
        tags: input.tags,
        hero_image_url: input.hero_image_url,
        reading_time_minutes: Math.max(1, Math.ceil(wordCount / 200)),
        published: false,
      },
    });

    await BlogPostService.evictBlogPostCache(input.slug);
    return created;
  }

  /**
   * Retrieves a persisted blog post by ID (published or draft) for admin inspection.
   */
  static async getBlogPostById(id: string) {
    try {
      return await prisma.blogPost.findUnique({
        where: { id },
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          `BlogPostService.getBlogPostById: Database query failed for ID "${id}":`,
          err
        );
      }
      failBuildOnDataSourceError("BlogPostService.getBlogPostById", err);
      return null;
    }
  }

  /**
   * Retrieves a persisted unpublished draft for an authorized admin item read.
   * Static public fallbacks are deliberately excluded from this private workflow.
   */
  static async getDraftBlogPostById(id: string) {
    return prisma.blogPost.findFirst({
      where: { id, published: false },
    });
  }

  /**
   * Applies a partial edit to a blog post or draft. Handles publishing state transitions.
   * Cache eviction runs only after persistence returns the updated record.
   */
  static async updateDraftBlogPost(id: string, input: UpdateBlogDraftInput) {
    let existing = await BlogPostService.getDraftBlogPostById(id);
    if (!existing) {
      existing = await BlogPostService.getBlogPostById(id);
    }
    if (!existing) {
      return null;
    }

    const data: {
      title?: string;
      slug?: string;
      dek?: string;
      body?: string;
      pillar?: ContentPillar;
      tags?: string;
      hero_image_url?: string | null;
      reading_time_minutes?: number;
      published?: boolean;
    } = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.dek !== undefined) data.dek = input.dek;
    if (input.pillar !== undefined) data.pillar = input.pillar;
    if (input.tags !== undefined) data.tags = input.tags.join(", ");
    if (input.published !== undefined) data.published = input.published;
    if (input.heroImageUrl !== undefined) {
      data.hero_image_url = input.heroImageUrl;
    }
    if (input.body !== undefined) {
      const sanitizedBody = await sanitizeContentHtmlLazy(input.body);
      const wordCount = sanitizedBody
        .replace(/<[^>]*>/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
      data.body = sanitizedBody;
      data.reading_time_minutes = Math.max(1, Math.ceil(wordCount / 200));
    }

    let updated: typeof existing | undefined;
    if (!existing.published) {
      const [res] = await prisma.blogPost.updateManyAndReturn({
        where: { id, published: false },
        data,
      });
      updated = res;
    }
    if (!updated) {
      const [res] = await prisma.blogPost.updateManyAndReturn({
        where: { id },
        data,
      });
      updated = res;
    }

    if (!updated) {
      return null;
    }

    // Publishing queues a Systems Dispatch announcement for the daily
    // maintenance run; nothing is sent synchronously on publish (#841).
    if (!existing.published && updated.published) {
      try {
        // Lazy: newsletter-service pulls in the DOM sanitizer chain (#1340).
        const { NewsletterService } =
          await import("@/lib/services/newsletter-service");
        await NewsletterService.queuePostAnnouncement(updated.id);
      } catch (err) {
        logger.error("Failed to queue the newsletter announcement:", err);
      }
    }

    const slugs = new Set([existing.slug, updated.slug]);
    await Promise.all(
      [...slugs].map((slug) => BlogPostService.evictBlogPostCache(slug))
    );
    return updated;
  }

  /**
   * Deletes a persisted blog post or draft by ID and evicts associated caches.
   */
  static async deleteBlogPost(id: string) {
    const existing = await prisma.blogPost.findUnique({
      where: { id },
    });
    if (!existing) {
      return null;
    }

    await prisma.blogPost.delete({
      where: { id },
    });

    await BlogPostService.evictBlogPostCache(existing.slug);
    return existing;
  }

  /**
   * Retrieves all published blog posts combining database records with
   * static fallbacks. Employs the Two-Tier Cache Shield (ADR 0036, ADR 0041):
   * Redis read-through cache first, then Neon, then the static `FALLBACK_BLOG_POSTS`
   * safety net so a database outage never breaks the `/blog` index or the sitemap.
   *
   * Guarantees:
   * - Empty lists are cached with bounded TTL to avoid repeated database reads.
   * - Unpublished drafts in DB or cache are never exposed.
   * - Published DB records take precedence over same-slug fallbacks.
   * - Resulting list is strictly ordered newest-first by creation timestamp.
   */
  static async getAllPublishedBlogPosts(): Promise<BlogPostData[]> {
    const cacheKey = getScopedRedisKey("blog:all_published");

    try {
      if (isRedisConfigured()) {
        const cached = await withTimeout(
          redis.get<unknown>(cacheKey),
          1500,
          "Redis getAllPublishedBlogPosts timeout"
        );

        if (Array.isArray(cached)) {
          if (cached.length === 0) {
            return [];
          }
          const valid = toValidBlogPosts(cached);
          if (valid.length > 0) {
            valid.sort(compareBlogPostsNewestFirst);
            return valid;
          }
          // If cached had entries but NONE were valid, the cached array is malformed.
          // Fall through to DB query to heal and serve fresh data.
        }
      }
    } catch {
      // Tolerated, fall through to DB query
    }

    const dbPosts: BlogPostData[] = [];
    const dbSlugs = new Set<string>();

    try {
      const records = await prisma.blogPost.findMany({
        where: { published: true },
        orderBy: { created_at: "desc" },
      });

      for (const r of records) {
        dbSlugs.add(r.slug);
        if (r.published) {
          const rawItem = {
            id: r.id,
            slug: r.slug,
            title: r.title,
            dek: r.dek,
            body: r.body,
            pillar: r.pillar,
            tags: r.tags,
            published: r.published,
            reading_time_minutes: r.reading_time_minutes,
            hero_image_url: r.hero_image_url,
            created_at: new Date(r.created_at),
            updated_at: new Date(r.updated_at),
          };
          dbPosts.push(...toValidBlogPosts([rawItem]));
        }
      }
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "BlogPostService.getAllPublishedBlogPosts: Database query failed, using static fallbacks:",
          err
        );
      }
      failBuildOnDataSourceError(
        "BlogPostService.getAllPublishedBlogPosts",
        err
      );
      return toValidBlogPosts(
        FALLBACK_BLOG_POSTS.filter((p) => p.published)
      ).sort(compareBlogPostsNewestFirst);
    }

    const merged: BlogPostData[] = [...dbPosts];

    for (const fallback of FALLBACK_BLOG_POSTS) {
      if (
        fallback.published &&
        !dbSlugs.has(fallback.slug) &&
        isValidBlogPost(fallback)
      ) {
        merged.push(...toValidBlogPosts([fallback]));
        dbSlugs.add(fallback.slug);
      }
    }

    merged.sort(compareBlogPostsNewestFirst);

    if (isRedisConfigured()) {
      try {
        await withTimeout(
          redis.set(cacheKey, merged, { ex: 3600 }),
          1500,
          "Redis cache write timeout"
        );
      } catch {
        // Tolerated
      }
    }

    return merged;
  }

  /**
   * Retrieves a single published blog post by slug.
   * Employs the Two-Tier Cache Shield (ADR 0036):
   * - Check Upstash Redis read-through cache first (`blog:slug:[slug]`, 3600s TTL).
   * - On cache miss or Redis error, query Prisma and populate cache.
   * - Fall back to the static `FALLBACK_BLOG_POSTS` dataset only if absent from DB.
   * - If a record exists in DB with `published === false`, returns `null` (draft precedence).
   */
  static async getBlogPostBySlug(slug: string): Promise<BlogPostData | null> {
    const trimmedSlug = typeof slug === "string" ? slug.trim() : "";
    if (!trimmedSlug) {
      return null;
    }

    const cacheKey = getScopedRedisKey(`blog:slug:${trimmedSlug}`);

    try {
      if (isRedisConfigured()) {
        const cached = await withTimeout(
          redis.get<unknown>(cacheKey),
          1500,
          "Redis cache read timeout"
        );

        if (
          isValidBlogPost(cached) &&
          cached.slug === trimmedSlug &&
          cached.published === true
        ) {
          return toValidBlogPost(cached);
        }
      }
    } catch (cacheErr) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          `BlogPostService.getBlogPostBySlug: Redis cache read failed for "${trimmedSlug}", falling back:`,
          cacheErr
        );
      }
    }

    let dbRecordFound = false;
    let dbResult: BlogPostData | null = null;

    try {
      const r = await prisma.blogPost.findUnique({
        where: { slug: trimmedSlug },
      });
      if (r) {
        dbRecordFound = true;
        if (r.published) {
          const rawItem = {
            id: r.id,
            slug: r.slug,
            title: r.title,
            dek: r.dek,
            body: r.body,
            pillar: r.pillar,
            tags: r.tags,
            published: r.published,
            reading_time_minutes: r.reading_time_minutes,
            hero_image_url: r.hero_image_url,
            created_at: new Date(r.created_at),
            updated_at: new Date(r.updated_at),
          };
          dbResult = toValidBlogPost(rawItem);
        }
      }
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          `BlogPostService.getBlogPostBySlug: DB query failed for slug "${trimmedSlug}", falling back:`,
          err
        );
      }
      failBuildOnDataSourceError("BlogPostService.getBlogPostBySlug", err);
      const fallback = FALLBACK_BLOG_POSTS.find(
        (p) =>
          p.slug === trimmedSlug && p.published === true && isValidBlogPost(p)
      );
      return fallback ? toValidBlogPost(fallback) : null;
    }

    if (dbRecordFound) {
      if (!dbResult) {
        return null;
      }
      if (isRedisConfigured()) {
        try {
          await withTimeout(
            redis.set(cacheKey, dbResult, { ex: 3600 }),
            1500,
            "Redis cache write timeout"
          );
        } catch {
          // Tolerated
        }
      }
      return dbResult;
    }

    const fallback = FALLBACK_BLOG_POSTS.find(
      (p) =>
        p.slug === trimmedSlug && p.published === true && isValidBlogPost(p)
    );
    const finalResult = fallback ? toValidBlogPost(fallback) : null;

    if (finalResult && isRedisConfigured()) {
      try {
        await withTimeout(
          redis.set(cacheKey, finalResult, { ex: 3600 }),
          1500,
          "Redis cache write timeout"
        );
      } catch {
        // Tolerated
      }
    }

    return finalResult;
  }

  /**
   * Explicitly evicts a blog post from the Upstash Redis read-through cache
   * and dispatches on-demand Next.js ISR path revalidations for rendered routes
   * (`/blog`, `/blog/[slug]`) and associated cache tags.
   *
   * Admin draft creation and editing invoke this after confirmed persistence.
   *
   * @param slug - The unique URL slug of the blog post to evict.
   * @returns True if the Redis cache keys were successfully deleted; false if Redis
   *          was unconfigured, timed out, or encountered a deletion error.
   */
  static async evictBlogPostCache(slug: string): Promise<boolean> {
    const trimmedSlug = typeof slug === "string" ? slug.trim() : "";
    if (!trimmedSlug) {
      return false;
    }

    const cacheKey = getScopedRedisKey(`blog:slug:${trimmedSlug}`);
    const allPublishedKey = getScopedRedisKey("blog:all_published");

    let evicted = false;
    if (isRedisConfigured()) {
      try {
        await withTimeout(
          redis.del(cacheKey, allPublishedKey),
          1500,
          "Redis cache eviction timeout"
        );
        evicted = true;
      } catch (err) {
        if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
          logger.warn(
            `BlogPostService.evictBlogPostCache: Redis eviction failed for "${trimmedSlug}":`,
            err
          );
        }
      }
    }

    await safeRevalidatePath(`/blog/${trimmedSlug}`);
    await safeRevalidatePath("/blog");
    await safeRevalidatePath("/sitemap.xml");
    await safeRevalidateTag(`blog-post-${trimmedSlug}`);
    await safeRevalidateTag("blog-posts");

    return evicted;
  }

  /**
   * Gets aggregated reactions for a blog post.
   * Employs Two-Tier Compute Shield:
   * Reads cached base counts (3600s TTL) and merges uncommitted Redis write-buffer increments,
   * completely avoiding database queries during active browsing.
   */
  static async getReactions(slug: string, connectionHash: string) {
    const bufferKey = getScopedRedisKey(`blog:reactions_buffer:${slug}`);
    const userKey = getScopedRedisKey(
      `blog:user_reactions:${slug}:${connectionHash}`
    );

    try {
      const baseCounts = await getBaseBlogReactionCounts(slug);

      const [rawBuffer, userReactionsRaw] = !isRedisConfigured()
        ? [null, null]
        : await Promise.race([
            Promise.all([
              redis.hgetall<Record<string, string | number>>(bufferKey),
              redis.smembers(userKey),
            ]),
            new Promise<[null, null]>((_, reject) =>
              setTimeout(
                () => reject(new Error("Redis getBlogReactions timeout")),
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

      const userReactions: string[] = Array.isArray(userReactionsRaw)
        ? userReactionsRaw
        : [];

      return {
        success: true,
        blogPostSlug: slug,
        counts,
        userReactions,
      };
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "BlogPostService.getReactions: Redis path failed, returning compute-shielded defaults:",
          err
        );
      }

      const counts = getDefaultBlogReactionCounts();
      const slugMap = mockBlogReactionsStore.get(slug);
      if (slugMap) {
        for (const [r, count] of slugMap.entries()) {
          counts[r] = count;
        }
      }
      return {
        success: true,
        blogPostSlug: slug,
        counts,
        userReactions: [],
      };
    }
  }

  /**
   * Submits a reaction for a published blog post.
   * Buffers reaction increments via HINCRBY in Upstash Redis without waking Neon Postgres.
   */
  static async submitReaction(
    input: BlogPostReactionSubmissionInput,
    connectionHash: string
  ): Promise<{
    success: boolean;
    notFound?: boolean;
    duplicate?: boolean;
    message?: string;
    reactionType?: string;
    counts?: Record<string, number>;
    userReactions?: string[];
  }> {
    const { blogPostSlug, reactionType } = input;

    const post = await BlogPostService.getBlogPostBySlug(blogPostSlug);
    if (!post || !post.published) {
      return {
        success: false,
        notFound: true,
        message: "Blog post not found or not published",
      };
    }

    const userKey = getScopedRedisKey(
      `blog:user_reactions:${blogPostSlug}:${connectionHash}`
    );
    const bufferKey = getScopedRedisKey(
      `blog:reactions_buffer:${blogPostSlug}`
    );
    const queueKey = getScopedRedisKey("blog:reactions_queue");
    const dirtyKey = getScopedRedisKey("blog:dirty_reactions");

    if (!isRedisConfigured()) {
      const res = await submitBlogReactionDirect(
        blogPostSlug,
        reactionType,
        connectionHash
      );
      return { ...res, notFound: false };
    }

    try {
      const isMember = await Promise.race([
        redis.sismember(userKey, reactionType),
        new Promise<number>((_, reject) =>
          setTimeout(() => reject(new Error("Redis sismember timeout")), 1500)
        ),
      ]);

      let userReactions: string[] = [];

      if (isMember === 1) {
        let members: unknown = null;
        try {
          members = await redis.smembers(userKey);
        } catch {
          // Tolerated
        }
        userReactions = Array.isArray(members)
          ? (members as string[])
          : [reactionType];

        const baseCounts = await getBaseBlogReactionCounts(blogPostSlug);
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
          success: false,
          duplicate: true,
          reactionType,
          counts,
          userReactions,
          message: "Duplicate reaction within the sliding window",
        };
      } else {
        const eventId = crypto.randomUUID();
        const event: BufferedBlogReactionEvent = {
          id: eventId,
          blogPostSlug,
          reactionType,
          connectionHash,
          createdAt: new Date().toISOString(),
        };

        const p = redis.pipeline();
        p.sadd(userKey, reactionType);
        p.expire(userKey, 30 * 24 * 60 * 60);
        p.hincrby(bufferKey, reactionType, 1);
        p.rpush(queueKey, event);
        p.sadd(dirtyKey, blogPostSlug);

        await Promise.race([
          p.exec(),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error("Redis submitBlogReaction pipeline timeout")),
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

      const baseCounts = await getBaseBlogReactionCounts(blogPostSlug);
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
          "BlogPostService.submitReaction: Redis buffering failed:",
          err
        );
        return {
          success: false,
          message:
            "Reaction service temporarily unavailable. Please try again.",
        };
      }

      const res = await submitBlogReactionDirect(
        blogPostSlug,
        reactionType,
        connectionHash
      );
      return { ...res, notFound: false };
    }
  }

  /**
   * Flushes buffered blog post reactions from Upstash Redis to Neon Postgres in batches.
   * Executed during scheduled maintenance.
   *
   * Never throws: failures are returned as a typed
   * {@link BlogReactionFlushErrorCode}.
   */
  static async flushBufferedReactionsToDatabase(
    batchSize = 500
  ): Promise<BlogReactionFlushResult> {
    const queueKey = getScopedRedisKey("blog:reactions_queue");
    const processingKey = getScopedRedisKey("blog:reactions_processing");
    const dirtyKey = getScopedRedisKey("blog:dirty_reactions");

    return flushOutboxQueue<BufferedBlogReactionEvent>({
      queueKey,
      processingKey,
      batchSize,
      isValidEvent: (item): item is BufferedBlogReactionEvent =>
        item !== null &&
        typeof item === "object" &&
        "id" in item &&
        "blogPostSlug" in item,
      persistEvents: async (events) => {
        return prisma.blogPostReaction.createMany({
          data: events.map((e) => ({
            id: e.id,
            blogPostSlug: e.blogPostSlug,
            reactionType: e.reactionType,
            connectionHash: e.connectionHash,
            createdAt: new Date(e.createdAt),
          })),
          skipDuplicates: true,
        });
      },
      onAcknowledge: (events, ack) => {
        const flushedCountsBySlug: Record<string, Record<string, number>> = {};
        for (const e of events) {
          if (!flushedCountsBySlug[e.blogPostSlug]) {
            flushedCountsBySlug[e.blogPostSlug] = {};
          }
          flushedCountsBySlug[e.blogPostSlug][e.reactionType] =
            (flushedCountsBySlug[e.blogPostSlug][e.reactionType] || 0) + 1;
        }

        for (const [slug, typeCounts] of Object.entries(flushedCountsBySlug)) {
          const bufferKey = getScopedRedisKey(`blog:reactions_buffer:${slug}`);
          const baseKey = getScopedRedisKey(`blog:reactions_counts:${slug}`);

          for (const [type, count] of Object.entries(typeCounts)) {
            ack.hincrby(bufferKey, type, -count);
          }
          ack.del(baseKey);
        }
      },
      postAcknowledge: async (events) => {
        const flushedCountsBySlug: Record<string, Record<string, number>> = {};
        for (const e of events) {
          if (!flushedCountsBySlug[e.blogPostSlug]) {
            flushedCountsBySlug[e.blogPostSlug] = {};
          }
          flushedCountsBySlug[e.blogPostSlug][e.reactionType] =
            (flushedCountsBySlug[e.blogPostSlug][e.reactionType] || 0) + 1;
        }

        for (const slug of Object.keys(flushedCountsBySlug)) {
          const bufferKey = getScopedRedisKey(`blog:reactions_buffer:${slug}`);
          let remainingBuffer: Record<string, string | number> | null = null;
          try {
            remainingBuffer =
              await redis.hgetall<Record<string, string | number>>(bufferKey);
          } catch {
            // Tolerated
          }

          const isBufferEmpty =
            !remainingBuffer ||
            Object.values(remainingBuffer).every((val) => Number(val) <= 0);

          if (isBufferEmpty) {
            try {
              await redis.srem(dirtyKey, slug);
            } catch {
              // Tolerated
            }
          }
        }

        for (const slug of Object.keys(flushedCountsBySlug)) {
          await BlogPostService.hydrateBlogReactionCounts(slug);
        }
      },
      loggerName: "BlogPostService.flushBufferedReactionsToDatabase",
      persistenceErrorMessage:
        "Buffered blog reactions could not be written to the database",
      flushErrorMessage:
        "Buffered blog reactions could not be flushed from Redis",
    });
  }

  /**
   * Hydrates the authoritative base reaction counts in Upstash Redis from Postgres.
   * Executed during scheduled maintenance or database seeding when Postgres is awake.
   * Never invoked on the public visitor read path per ADR 0043 §3.
   */
  static async hydrateBlogReactionCounts(
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
        await Promise.race([
          redis.set(baseKey, counts),
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error("Redis hydrateBlogReactionCounts timeout")),
              1500
            )
          ),
        ]);
      }
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          `BlogPostService: Failed to hydrate base reactions for ${slug}:`,
          err
        );
      }
    }

    return counts;
  }
}
