import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { FALLBACK_BLOG_POSTS } from "@/lib/fallback-blog-posts";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  compareBlogPostsNewestFirst,
  isValidBlogPost,
  toValidBlogPosts,
  type BlogPostData,
  type BlogPostDbRecord,
} from "../shared";
import {
  GetAllPublishedBlogPostsInputSchema,
  type GetAllPublishedBlogPostsInput,
  type GetAllPublishedBlogPostsResult,
  type GetAllPublishedBlogPostsSpec,
} from "./spec";

export interface GetAllPublishedBlogPostsDeps {
  redisClient?: {
    get<T = unknown>(key: string): Promise<T | null>;
    set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  };
  isRedisReady?: () => boolean;
  db?: {
    blogPost: {
      findMany(args: {
        where: { published: true };
        orderBy: { created_at: "desc" };
      }): Promise<BlogPostDbRecord[]>;
    };
  };
}

/**
 * Handler for retrieving all published blog posts via Two-Tier Cache Shield (ADR 0036, ADR 0041)
 * with static fallback resilience during database outages outside build phase.
 */
export class GetAllPublishedBlogPostsHandler implements GetAllPublishedBlogPostsSpec {
  private readonly redisClient: NonNullable<
    GetAllPublishedBlogPostsDeps["redisClient"]
  >;
  private readonly isRedisReady: () => boolean;
  private readonly db: NonNullable<GetAllPublishedBlogPostsDeps["db"]>;

  constructor(deps: GetAllPublishedBlogPostsDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: GetAllPublishedBlogPostsInput = {}
  ): Promise<GetAllPublishedBlogPostsResult> {
    const parsed = GetAllPublishedBlogPostsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid input",
        { recoverable: false, details: parsed.error }
      );
    }

    const cacheKey = getScopedRedisKey("blog:all_published");

    try {
      if (this.isRedisReady()) {
        const cached = await withRedisTimeout(
          this.redisClient.get<unknown>(cacheKey),
          1500,
          "Redis getAllPublishedBlogPosts timeout"
        );

        if (Array.isArray(cached)) {
          if (cached.length === 0) {
            return createSuccess([]);
          }
          const valid = toValidBlogPosts(cached);
          if (valid.length > 0) {
            valid.sort(compareBlogPostsNewestFirst);
            return createSuccess(valid);
          }
        }
      }
    } catch {
      // Tolerated, fall through to DB query
    }

    const dbPosts: BlogPostData[] = [];
    const dbSlugs = new Set<string>();

    try {
      const records = await this.db.blogPost.findMany({
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
      return createSuccess(
        toValidBlogPosts(FALLBACK_BLOG_POSTS.filter((p) => p.published)).sort(
          compareBlogPostsNewestFirst
        )
      );
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

    if (this.isRedisReady()) {
      try {
        await withRedisTimeout(
          this.redisClient.set(cacheKey, merged, { ex: 3600 }),
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
