import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { FALLBACK_BLOG_POSTS } from "@/lib/fallback-blog-posts";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
import { createSuccess } from "@/lib/services/service-result";
import {
  compareBlogPostsNewestFirst,
  isValidBlogPost,
  toValidBlogPosts,
  type BlogPostData,
  type PersistedBlogPostRecord,
} from "../shared";
import type {
  ListPublishedBlogPostsInput,
  ListPublishedBlogPostsResult,
  ListPublishedBlogPostsSpec,
} from "./spec";

export interface ListPublishedBlogPostsPrismaPort {
  findMany(args: {
    where: { published: true };
    orderBy: { created_at: "desc" };
  }): Promise<PersistedBlogPostRecord[]>;
}

export interface ListPublishedBlogPostsDeps {
  blogPosts?: ListPublishedBlogPostsPrismaPort;
}

export class ListPublishedBlogPostsHandler implements ListPublishedBlogPostsSpec {
  private readonly blogPosts: ListPublishedBlogPostsPrismaPort;

  constructor(deps: ListPublishedBlogPostsDeps = {}) {
    this.blogPosts = deps.blogPosts ?? prisma.blogPost;
  }

  async execute(
    _input?: ListPublishedBlogPostsInput
  ): Promise<ListPublishedBlogPostsResult> {
    const cacheKey = getScopedRedisKey("blog:all_published");

    try {
      if (isRedisConfigured()) {
        const cached = await withRedisTimeout(
          redis.get<unknown>(cacheKey),
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
      const records = await this.blogPosts.findMany({
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
          "ListPublishedBlogPostsHandler: Database query failed, using static fallbacks:",
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

    if (isRedisConfigured()) {
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
