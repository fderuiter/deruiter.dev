import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  hydrateBlogReactionCounts,
  type BlogReactionFlushResult,
  type BufferedBlogReactionEvent,
} from "../shared";
import {
  FlushBlogReactionsInputSchema,
  type FlushBlogReactionsInput,
  type FlushBlogReactionsSpec,
} from "./spec";

export interface FlushBlogReactionsPrismaPort {
  createMany(args: {
    data: Array<{
      id: string;
      blogPostSlug: string;
      reactionType: string;
      connectionHash: string;
      createdAt: Date;
    }>;
    skipDuplicates: true;
  }): Promise<{ count: number }>;
}

export interface FlushBlogReactionsDeps {
  reactions?: FlushBlogReactionsPrismaPort;
  hydrateCounts?: (slug: string) => Promise<Record<string, number>>;
}

export class FlushBlogReactionsHandler implements FlushBlogReactionsSpec {
  private readonly reactions: FlushBlogReactionsPrismaPort;
  private readonly hydrateCounts: (
    slug: string
  ) => Promise<Record<string, number>>;

  constructor(deps: FlushBlogReactionsDeps = {}) {
    this.reactions = deps.reactions ?? prisma.blogPostReaction;
    this.hydrateCounts = deps.hydrateCounts ?? hydrateBlogReactionCounts;
  }

  async execute(
    input: FlushBlogReactionsInput = {}
  ): Promise<BlogReactionFlushResult> {
    const parsed = FlushBlogReactionsInputSchema.safeParse(input);
    const batchSize =
      parsed.success && parsed.data.batchSize !== undefined
        ? parsed.data.batchSize
        : 500;

    const queueKey = getScopedRedisKey("blog:reactions_queue");
    const processingKey = getScopedRedisKey("blog:reactions_processing");
    const dirtyKey = getScopedRedisKey("blog:dirty_reactions");

    if (!isRedisConfigured()) {
      return createSuccess({ processed: 0, inserted: 0 });
    }

    try {
      const existingProcessing = (await redis.lrange(
        processingKey,
        0,
        -1
      )) as BufferedBlogReactionEvent[];
      let events: BufferedBlogReactionEvent[] = Array.isArray(
        existingProcessing
      )
        ? existingProcessing
        : [];

      if (events.length < batchSize) {
        const queueDepth = await redis.llen(queueKey);
        const needed = Math.min(batchSize - events.length, queueDepth);

        if (needed > 0) {
          const p = redis.pipeline();
          for (let i = 0; i < needed; i++) {
            p.lmove(queueKey, processingKey, "right", "left");
          }
          p.expire(processingKey, 48 * 60 * 60);
          const moveResults = await p.exec();

          const newlyMoved = moveResults.filter(
            (item): item is BufferedBlogReactionEvent =>
              item !== null &&
              typeof item === "object" &&
              "id" in item &&
              "blogPostSlug" in item
          );
          events = [...events, ...newlyMoved];
        }
      }

      if (events.length === 0) {
        return createSuccess({ processed: 0, inserted: 0 });
      }

      let createResult: { count: number };
      try {
        createResult = await this.reactions.createMany({
          data: events.map((e) => ({
            id: e.id,
            blogPostSlug: e.blogPostSlug,
            reactionType: e.reactionType,
            connectionHash: e.connectionHash,
            createdAt: new Date(e.createdAt),
          })),
          skipDuplicates: true,
        });
      } catch (dbErr) {
        logger.error(
          "FlushBlogReactionsHandler: DB write failed; events remain in processing queue:",
          dbErr
        );
        return createFailure(
          "PERSISTENCE_FAILED",
          "Buffered blog reactions could not be written to the database",
          { details: dbErr }
        );
      }

      const flushedCountsBySlug: Record<string, Record<string, number>> = {};
      for (const e of events) {
        if (!flushedCountsBySlug[e.blogPostSlug]) {
          flushedCountsBySlug[e.blogPostSlug] = {};
        }
        flushedCountsBySlug[e.blogPostSlug][e.reactionType] =
          (flushedCountsBySlug[e.blogPostSlug][e.reactionType] || 0) + 1;
      }

      const ack = redis.pipeline();
      for (const event of events) {
        ack.lrem(processingKey, 1, event);
      }

      for (const [slug, typeCounts] of Object.entries(flushedCountsBySlug)) {
        const bufferKey = getScopedRedisKey(`blog:reactions_buffer:${slug}`);
        const baseKey = getScopedRedisKey(`blog:reactions_counts:${slug}`);

        for (const [type, count] of Object.entries(typeCounts)) {
          ack.hincrby(bufferKey, type, -count);
        }
        ack.del(baseKey);
      }

      await ack.exec();

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
        await this.hydrateCounts(slug);
      }

      return createSuccess({
        processed: events.length,
        inserted: createResult.count,
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.error("FlushBlogReactionsHandler encountered error:", err);
      }
      return createFailure(
        "FLUSH_FAILED",
        "Buffered blog reactions could not be flushed from Redis",
        { details: err }
      );
    }
  }
}
