import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { FALLBACK_BLOG_POSTS } from "@/lib/fallback-blog-posts";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { RedisTimeoutError, withRedisTimeout } from "@/lib/redis-timeout";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  isValidBlogPost,
  toValidBlogPost,
  type BlogPostData,
  type BlogPostDbRecord,
} from "../shared";
import {
  GetBlogPostBySlugInputSchema,
  type GetBlogPostBySlugInput,
  type GetBlogPostBySlugResult,
  type GetBlogPostBySlugSpec,
} from "./spec";

export interface GetBlogPostBySlugDeps {
  redisClient?: {
    get<T = unknown>(key: string): Promise<T | null>;
    set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  };
  isRedisReady?: () => boolean;
  db?: {
    blogPost: {
      findUnique(args: {
        where: { slug: string };
      }): Promise<BlogPostDbRecord | null>;
    };
  };
}

/**
 * Handler for retrieving a single published blog post by slug via Two-Tier Cache Shield (ADR 0036).
 * Preserves draft precedence (`published === false` hides static fallback) and never caches fallbacks during DB outages.
 */
export class GetBlogPostBySlugHandler implements GetBlogPostBySlugSpec {
  private readonly redisClient: NonNullable<
    GetBlogPostBySlugDeps["redisClient"]
  >;
  private readonly isRedisReady: () => boolean;
  private readonly db: NonNullable<GetBlogPostBySlugDeps["db"]>;

  constructor(deps: GetBlogPostBySlugDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: GetBlogPostBySlugInput
  ): Promise<GetBlogPostBySlugResult> {
    const parsed = GetBlogPostBySlugInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid blog post slug",
        { recoverable: false, details: parsed.error }
      );
    }

    const trimmedSlug = parsed.data.slug.trim();
    if (!trimmedSlug) {
      return createFailure("NOT_FOUND", "Blog post not found", {
        recoverable: false,
      });
    }

    const cacheKey = getScopedRedisKey(`blog:slug:${trimmedSlug}`);

    try {
      if (this.isRedisReady()) {
        const cached = await withRedisTimeout(
          this.redisClient.get<unknown>(cacheKey),
          1500,
          "Redis cache read timeout"
        );

        if (
          isValidBlogPost(cached) &&
          cached.slug === trimmedSlug &&
          cached.published === true
        ) {
          const validCached = toValidBlogPost(cached);
          if (validCached) {
            return createSuccess(validCached);
          }
        }
      }
    } catch (cacheErr) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        const message = `BlogPostService.getBlogPostBySlug: Redis cache read failed for "${trimmedSlug}", falling back:`;
        if (cacheErr instanceof RedisTimeoutError) {
          logger.warn(message, cacheErr, { skipTelemetry: true });
        } else {
          logger.warn(message, cacheErr);
        }
      }
    }

    let dbRecordFound = false;
    let dbResult: BlogPostData | null = null;

    try {
      const r = await this.db.blogPost.findUnique({
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
      const validFallback = fallback ? toValidBlogPost(fallback) : null;
      if (!validFallback) {
        return createFailure(
          "NOT_FOUND",
          `Blog post "${trimmedSlug}" not found`,
          { recoverable: false }
        );
      }
      return createSuccess(validFallback);
    }

    if (dbRecordFound) {
      if (!dbResult) {
        return createFailure(
          "NOT_FOUND",
          `Blog post "${trimmedSlug}" not found`,
          { recoverable: false }
        );
      }
      if (this.isRedisReady()) {
        try {
          await withRedisTimeout(
            this.redisClient.set(cacheKey, dbResult, { ex: 3600 }),
            1500,
            "Redis cache write timeout"
          );
        } catch {
          // Tolerated
        }
      }
      return createSuccess(dbResult);
    }

    const fallback = FALLBACK_BLOG_POSTS.find(
      (p) =>
        p.slug === trimmedSlug && p.published === true && isValidBlogPost(p)
    );
    const finalResult = fallback ? toValidBlogPost(fallback) : null;

    if (!finalResult) {
      return createFailure(
        "NOT_FOUND",
        `Blog post "${trimmedSlug}" not found`,
        { recoverable: false }
      );
    }

    if (this.isRedisReady()) {
      try {
        await withRedisTimeout(
          this.redisClient.set(cacheKey, finalResult, { ex: 3600 }),
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
