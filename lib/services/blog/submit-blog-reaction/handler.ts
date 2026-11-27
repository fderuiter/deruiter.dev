import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { withRedisTimeout } from "@/lib/redis-timeout";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { GetPublishedBlogPostHandler } from "../get-published-blog-post/handler";
import type { GetPublishedBlogPostResult } from "../get-published-blog-post/spec";
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

export interface SubmitBlogReactionPrismaPort {
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
}

export interface SubmitBlogReactionDeps {
  reactions?: SubmitBlogReactionPrismaPort;
  getPublishedPost?: (slug: string) => Promise<GetPublishedBlogPostResult>;
  getBaseCounts?: (slug: string) => Promise<Record<string, number>>;
}

export class SubmitBlogReactionHandler implements SubmitBlogReactionSpec {
  private readonly reactions: SubmitBlogReactionPrismaPort;
  private readonly getPublishedPost: (
    slug: string
  ) => Promise<GetPublishedBlogPostResult>;
  private readonly getBaseCounts: (
    slug: string
  ) => Promise<Record<string, number>>;

  constructor(deps: SubmitBlogReactionDeps = {}) {
    this.reactions =
      deps.reactions ??
      (prisma.blogPostReaction as unknown as SubmitBlogReactionPrismaPort);
    const defaultGetPost = new GetPublishedBlogPostHandler();
    this.getPublishedPost =
      deps.getPublishedPost ?? ((slug) => defaultGetPost.execute({ slug }));
    this.getBaseCounts = deps.getBaseCounts ?? getBaseBlogReactionCounts;
  }

  private async submitDirectToPostgres(
    blogPostSlug: string,
    reactionType: string,
    connectionHash: string
  ): Promise<SubmitBlogReactionResult> {
    try {
      const existing = await this.reactions.findFirst({
        where: {
          blogPostSlug,
          reactionType,
          connectionHash,
        },
      });

      if (existing) {
        const grouped = await this.reactions.groupBy({
          by: ["reactionType"],
          where: { blogPostSlug },
          _count: { id: true },
        });
        const userReactionsList = await this.reactions.findMany({
          where: { blogPostSlug, connectionHash },
          select: { reactionType: true },
        });
        const counts = getDefaultBlogReactionCounts();
        for (const r of grouped) {
          if (counts[r.reactionType] !== undefined) {
            counts[r.reactionType] = r._count.id;
          }
        }
        return createFailure(
          "RATE_LIMITED",
          "Duplicate reaction within the sliding window",
          {
            recoverable: true,
            details: {
              counts,
              userReactions: userReactionsList.map((ur) => ur.reactionType),
            },
          }
        );
      }

      await this.reactions.create({
        data: {
          blogPostSlug,
          reactionType,
          connectionHash,
        },
      });

      const grouped = await this.reactions.groupBy({
        by: ["reactionType"],
        where: { blogPostSlug },
        _count: { id: true },
      });

      const userReactionsList = await this.reactions.findMany({
        where: { blogPostSlug, connectionHash },
        select: { reactionType: true },
      });

      const counts = getDefaultBlogReactionCounts();
      for (const r of grouped) {
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
        "INVALID_REACTION_INPUT",
        parsed.error.issues[0]?.message ?? "Invalid reaction payload",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const { blogPostSlug, reactionType, connectionHash } = parsed.data;
    let postResult: GetPublishedBlogPostResult;
    try {
      postResult = await this.getPublishedPost(blogPostSlug);
    } catch (err) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Reaction service temporarily unavailable. Please try again.",
        { recoverable: true, details: err }
      );
    }
    if (!postResult.success) {
      return createFailure("INVALID_REACTION_INPUT", postResult.error.message, {
        recoverable: false,
        details: postResult.error,
      });
    }
    if (!postResult.data || !postResult.data.published) {
      return createFailure(
        "BLOG_POST_NOT_FOUND",
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

    if (!isRedisConfigured()) {
      return this.submitDirectToPostgres(
        blogPostSlug,
        reactionType,
        connectionHash
      );
    }

    try {
      const isMember = await withRedisTimeout(
        redis.sismember(userKey, reactionType),
        1500,
        "Redis sismember timeout"
      );

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

        const baseCounts = await this.getBaseCounts(blogPostSlug);
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

        return createFailure(
          "RATE_LIMITED",
          "Duplicate reaction within the sliding window",
          { recoverable: true, details: { counts, userReactions } }
        );
      }

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

      await withRedisTimeout(
        p.exec(),
        1500,
        "Redis submitBlogReaction pipeline timeout"
      );

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

      const baseCounts = await this.getBaseCounts(blogPostSlug);
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

      return createSuccess({
        reactionType,
        counts,
        userReactions,
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn("SubmitBlogReactionHandler: Redis buffering failed:", err);
        return createFailure(
          "STORAGE_UNAVAILABLE",
          "Reaction service temporarily unavailable. Please try again.",
          { recoverable: true, details: err }
        );
      }

      return this.submitDirectToPostgres(
        blogPostSlug,
        reactionType,
        connectionHash
      );
    }
  }
}
