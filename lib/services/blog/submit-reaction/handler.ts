import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { GetBlogPostBySlugHandler } from "../get-blog-post-by-slug/handler";
import type { GetBlogPostBySlugSpec } from "../get-blog-post-by-slug/spec";
import {
  getBaseBlogReactionCounts,
  getDefaultBlogReactionCounts,
  type BufferedBlogReactionEvent,
} from "../shared";
import {
  SubmitBlogReactionInputSchema,
  type SubmitBlogReactionInput,
  type SubmitBlogReactionResult,
  type SubmitBlogReactionSpec,
} from "./spec";

export interface BlogReactionPipelineLike {
  sadd(key: string, ...members: string[]): unknown;
  expire(key: string, seconds: number): unknown;
  hincrby(key: string, field: string, increment: number): unknown;
  rpush(key: string, ...elements: unknown[]): unknown;
  exec(): Promise<unknown[]>;
}

export interface BlogReactionRedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  sismember(key: string, member: string): Promise<number>;
  smembers(key: string): Promise<string[]>;
  hgetall<T extends Record<string, unknown> = Record<string, unknown>>(
    key: string
  ): Promise<T | null>;
  pipeline(): BlogReactionPipelineLike;
}

export interface SubmitBlogReactionDeps {
  redisClient?: BlogReactionRedisLike;
  isRedisReady?: () => boolean;
  getBlogPostBySlugHandler?: GetBlogPostBySlugSpec;
  db?: {
    blogPostReaction: {
      findFirst(args: {
        where: {
          blogPostSlug: string;
          reactionType: string;
          connectionHash: string;
        };
      }): Promise<{ id: string } | null>;
      create(args: {
        data: {
          blogPostSlug: string;
          reactionType: string;
          connectionHash: string;
        };
      }): Promise<unknown>;
      groupBy(args: {
        by: ["reactionType"];
        where: { blogPostSlug: string };
        _count: { id: true };
      }): Promise<Array<{ reactionType: string; _count: { id: number } }>>;
      findMany(args: {
        where: { blogPostSlug: string; connectionHash: string };
        select: { reactionType: true };
      }): Promise<Array<{ reactionType: string }>>;
    };
  };
  idGenerator?: () => string;
}

/**
 * Handler for submitting a reaction to a published blog post via Upstash Redis write-buffering.
 * Returns `NOT_FOUND` (404), `RATE_LIMITED` (429) on duplicate reaction, and `STORAGE_UNAVAILABLE` (503) on storage outages without ephemeral Map fallbacks (ADR 0043).
 */
export class SubmitBlogReactionHandler implements SubmitBlogReactionSpec {
  private readonly redisClient: BlogReactionRedisLike;
  private readonly isRedisReady: () => boolean;
  private readonly getBlogPostBySlugHandler: GetBlogPostBySlugSpec;
  private readonly db: NonNullable<SubmitBlogReactionDeps["db"]>;
  private readonly idGenerator: () => string;

  constructor(deps: SubmitBlogReactionDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
    this.getBlogPostBySlugHandler =
      deps.getBlogPostBySlugHandler ?? new GetBlogPostBySlugHandler();
    this.db = deps.db ?? prisma;
    this.idGenerator = deps.idGenerator ?? (() => crypto.randomUUID());
  }

  private async submitReactionDirect(
    blogPostSlug: string,
    reactionType: string,
    connectionHash: string
  ): Promise<SubmitBlogReactionResult> {
    try {
      const existing = await this.db.blogPostReaction.findFirst({
        where: {
          blogPostSlug,
          reactionType,
          connectionHash,
        },
      });

      if (existing) {
        const reactions = await this.db.blogPostReaction.groupBy({
          by: ["reactionType"],
          where: { blogPostSlug },
          _count: { id: true },
        });
        const userReactionsList = await this.db.blogPostReaction.findMany({
          where: { blogPostSlug, connectionHash },
          select: { reactionType: true },
        });
        const counts = getDefaultBlogReactionCounts();
        for (const r of reactions) {
          if (counts[r.reactionType] !== undefined) {
            counts[r.reactionType] = r._count.id;
          }
        }
        return createFailure(
          "RATE_LIMITED",
          "Duplicate reaction within the sliding window",
          {
            recoverable: false,
            details: {
              reactionType,
              counts,
              userReactions: userReactionsList.map((ur) => ur.reactionType),
            },
          }
        );
      }

      await this.db.blogPostReaction.create({
        data: {
          blogPostSlug,
          reactionType,
          connectionHash,
        },
      });

      const reactions = await this.db.blogPostReaction.groupBy({
        by: ["reactionType"],
        where: { blogPostSlug },
        _count: { id: true },
      });

      const userReactionsList = await this.db.blogPostReaction.findMany({
        where: { blogPostSlug, connectionHash },
        select: { reactionType: true },
      });

      const counts = getDefaultBlogReactionCounts();
      for (const r of reactions) {
        if (counts[r.reactionType] !== undefined) {
          counts[r.reactionType] = r._count.id;
        }
      }

      return createSuccess({
        reactionType,
        counts,
        userReactions: userReactionsList.map((ur) => ur.reactionType),
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.error("Database blog reaction creation failed:", err);
      }
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Reaction service temporarily unavailable. Please try again.",
        { recoverable: true, details: err }
      );
    }
  }

  async execute(
    input: SubmitBlogReactionInput
  ): Promise<SubmitBlogReactionResult> {
    const parsed = SubmitBlogReactionInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid blog reaction submission",
        { recoverable: false, details: parsed.error }
      );
    }

    const { blogPostSlug, reactionType, connectionHash } = parsed.data;

    const postRes = await this.getBlogPostBySlugHandler.execute({
      slug: blogPostSlug,
    });
    if (!postRes.success || !postRes.data.published) {
      return createFailure(
        "NOT_FOUND",
        "Blog post not found or not published",
        { recoverable: false }
      );
    }

    const userKey = getScopedRedisKey(
      `blog:user_reactions:${blogPostSlug}:${connectionHash}`
    );
    const bufferKey = getScopedRedisKey(
      `blog:reactions_buffer:${blogPostSlug}`
    );
    const queueKey = getScopedRedisKey("blog:reactions_queue");
    const dirtyKey = getScopedRedisKey("blog:dirty_reactions");

    if (!this.isRedisReady()) {
      return this.submitReactionDirect(
        blogPostSlug,
        reactionType,
        connectionHash
      );
    }

    try {
      const isMember = await Promise.race([
        this.redisClient.sismember(userKey, reactionType),
        new Promise<number>((_, reject) => {
          const t = setTimeout(
            () => reject(new Error("Redis sismember timeout")),
            1500
          );
          t.unref?.();
        }),
      ]);

      let userReactions: string[] = [];

      if (isMember === 1) {
        let members: unknown = null;
        try {
          members = await this.redisClient.smembers(userKey);
        } catch {
          // Tolerated
        }
        userReactions = Array.isArray(members)
          ? (members as string[])
          : [reactionType];

        const baseCounts = await getBaseBlogReactionCounts(blogPostSlug, {
          redisClient: this.redisClient,
          isRedisReady: this.isRedisReady,
        });
        let rawBuffer: Record<string, string | number> | null = null;
        try {
          rawBuffer =
            await this.redisClient.hgetall<Record<string, string | number>>(
              bufferKey
            );
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

        return createFailure(
          "RATE_LIMITED",
          "Duplicate reaction within the sliding window",
          {
            recoverable: false,
            details: {
              reactionType,
              counts,
              userReactions,
            },
          }
        );
      }

      const event: BufferedBlogReactionEvent = {
        id: this.idGenerator(),
        blogPostSlug,
        reactionType,
        connectionHash,
        createdAt: new Date().toISOString(),
      };

      const p = this.redisClient.pipeline();
      p.sadd(userKey, reactionType);
      p.expire(userKey, 30 * 24 * 60 * 60);
      p.hincrby(bufferKey, reactionType, 1);
      p.rpush(queueKey, event);
      p.sadd(dirtyKey, blogPostSlug);

      await Promise.race([
        p.exec(),
        new Promise((_, reject) => {
          const t = setTimeout(
            () =>
              reject(new Error("Redis submitBlogReaction pipeline timeout")),
            1500
          );
          t.unref?.();
        }),
      ]);

      let members: unknown = null;
      try {
        members = await this.redisClient.smembers(userKey);
      } catch {
        // Tolerated
      }
      userReactions = Array.isArray(members)
        ? (members as string[])
        : [reactionType];
      if (!userReactions.includes(reactionType)) {
        userReactions.push(reactionType);
      }

      const baseCounts = await getBaseBlogReactionCounts(blogPostSlug, {
        redisClient: this.redisClient,
        isRedisReady: this.isRedisReady,
      });
      let rawBuffer: Record<string, string | number> | null = null;
      try {
        rawBuffer =
          await this.redisClient.hgetall<Record<string, string | number>>(
            bufferKey
          );
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

      return createSuccess({
        reactionType,
        counts,
        userReactions,
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "BlogPostService.submitReaction: Redis buffering failed:",
          err
        );
        return createFailure(
          "STORAGE_UNAVAILABLE",
          "Reaction service temporarily unavailable. Please try again.",
          { recoverable: true, details: err }
        );
      }

      return this.submitReactionDirect(
        blogPostSlug,
        reactionType,
        connectionHash
      );
    }
  }
}
