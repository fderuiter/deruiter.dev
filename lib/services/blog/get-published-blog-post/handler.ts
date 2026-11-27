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
  type PersistedBlogPostRecord,
} from "../shared";
import {
  GetPublishedBlogPostInputSchema,
  type GetPublishedBlogPostInput,
  type GetPublishedBlogPostResult,
  type GetPublishedBlogPostSpec,
} from "./spec";

export interface GetPublishedBlogPostPrismaPort {
  findUnique(args: {
    where: { slug: string };
  }): Promise<PersistedBlogPostRecord | null>;
}

export interface GetPublishedBlogPostDeps {
  blogPosts?: GetPublishedBlogPostPrismaPort;
}

export class GetPublishedBlogPostHandler implements GetPublishedBlogPostSpec {
  private readonly blogPosts: GetPublishedBlogPostPrismaPort;

  constructor(deps: GetPublishedBlogPostDeps = {}) {
    this.blogPosts = deps.blogPosts ?? prisma.blogPost;
  }

  async execute(
    input: GetPublishedBlogPostInput
  ): Promise<GetPublishedBlogPostResult> {
    const parsed = GetPublishedBlogPostInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_BLOG_SLUG", "Slug must be a string", {
        recoverable: false,
        details: parsed.error.issues,
      });
    }

    const trimmedSlug = parsed.data.slug.trim();
    if (!trimmedSlug) {
      return createSuccess(null);
    }

    const cacheKey = getScopedRedisKey(`blog:slug:${trimmedSlug}`);

    try {
      if (isRedisConfigured()) {
        const cached = await withRedisTimeout(
          redis.get<unknown>(cacheKey),
          1500,
          "Redis cache read timeout"
        );

        if (
          isValidBlogPost(cached) &&
          cached.slug === trimmedSlug &&
          cached.published === true
        ) {
          return createSuccess(toValidBlogPost(cached));
        }
      }
    } catch (cacheErr) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        const message = `GetPublishedBlogPostHandler: Redis cache read failed for "${trimmedSlug}", falling back:`;
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
      const r = await this.blogPosts.findUnique({
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
          `GetPublishedBlogPostHandler: DB query failed for slug "${trimmedSlug}", falling back:`,
          err
        );
      }
      failBuildOnDataSourceError("BlogPostService.getBlogPostBySlug", err);
      const fallback = FALLBACK_BLOG_POSTS.find(
        (p) =>
          p.slug === trimmedSlug && p.published === true && isValidBlogPost(p)
      );
      return createSuccess(fallback ? toValidBlogPost(fallback) : null);
    }

    if (dbRecordFound) {
      if (!dbResult) {
        return createSuccess(null);
      }
      if (isRedisConfigured()) {
        try {
          await withRedisTimeout(
            redis.set(cacheKey, dbResult, { ex: 3600 }),
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
