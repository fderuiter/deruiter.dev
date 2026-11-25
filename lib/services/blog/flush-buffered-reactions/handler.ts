import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { HydrateBlogReactionCountsHandler } from "../hydrate-reaction-counts/handler";
import type { HydrateBlogReactionCountsSpec } from "../hydrate-reaction-counts/spec";
import type {
  BlogReactionFlushResult,
  BufferedBlogReactionEvent,
} from "../shared";
import {
  FlushBlogReactionsInputSchema,
  type FlushBlogReactionsInput,
  type FlushBlogReactionsSpec,
} from "./spec";

export interface FlushBlogReactionsPipelineLike {
  lmove(
    source: string,
    destination: string,
    whereFrom: "left" | "right",
    whereTo: "left" | "right"
  ): unknown;
  expire(key: string, seconds: number): unknown;
  lrem(key: string, count: number, element: unknown): unknown;
  hincrby(key: string, field: string, increment: number): unknown;
  del(...keys: string[]): unknown;
  exec(): Promise<unknown[]>;
}

export interface FlushBlogReactionsDeps {
  redisClient?: {
    lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]>;
    llen(key: string): Promise<number>;
    hgetall<T extends Record<string, unknown> = Record<string, unknown>>(
      key: string
    ): Promise<T | null>;
    srem(key: string, ...members: string[]): Promise<number>;
    set(key: string, value: unknown): Promise<unknown>;
    pipeline(): FlushBlogReactionsPipelineLike;
  };
  isRedisReady?: () => boolean;
  db?: {
    blogPostReaction: {
      createMany(args: {
        data: Array<{
          id: string;
          blogPostSlug: string;
          reactionType: string;
          connectionHash: string;
          createdAt: Date;
        }>;
        skipDuplicates: boolean;
      }): Promise<{ count: number }>;
      groupBy(args: {
        by: ["reactionType"];
        where: { blogPostSlug: string };
        _count: { id: true };
      }): Promise<Array<{ reactionType: string; _count: { id: number } }>>;
    };
  };
  hydrateHandler?: HydrateBlogReactionCountsSpec;
}

/**
 * Handler for flushing buffered blog post reactions from Upstash Redis to Neon PostgreSQL in atomic LMOVE batches.
 */
export class FlushBlogReactionsHandler implements FlushBlogReactionsSpec {
  private readonly redisClient: NonNullable<
    FlushBlogReactionsDeps["redisClient"]
  >;
  private readonly isRedisReady: () => boolean;
  private readonly db: NonNullable<FlushBlogReactionsDeps["db"]>;
  private readonly hydrateHandler: HydrateBlogReactionCountsSpec;

  constructor(deps: FlushBlogReactionsDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
    this.db = deps.db ?? prisma;
    this.hydrateHandler =
      deps.hydrateHandler ??
      new HydrateBlogReactionCountsHandler({
        redisClient: this.redisClient,
        isRedisReady: this.isRedisReady,
        db: this.db,
      });
  }

  async execute(
    input: FlushBlogReactionsInput = {}
  ): Promise<BlogReactionFlushResult> {
    const parsed = FlushBlogReactionsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid batch size",
        { recoverable: false, details: parsed.error }
      );
    }

    const { batchSize } = parsed.data;
    const queueKey = getScopedRedisKey("blog:reactions_queue");
    const processingKey = getScopedRedisKey("blog:reactions_processing");
    const dirtyKey = getScopedRedisKey("blog:dirty_reactions");

    if (!this.isRedisReady()) {
      return createSuccess({ processed: 0, inserted: 0 });
    }

    try {
      const existingProcessing =
        await this.redisClient.lrange<BufferedBlogReactionEvent>(
          processingKey,
          0,
          -1
        );
      let events: BufferedBlogReactionEvent[] = Array.isArray(
        existingProcessing
      )
        ? existingProcessing
        : [];

      if (events.length < batchSize) {
        const queueDepth = await this.redisClient.llen(queueKey);
        const needed = Math.min(batchSize - events.length, queueDepth);

        if (needed > 0) {
          const p = this.redisClient.pipeline();
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
        createResult = await this.db.blogPostReaction.createMany({
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
          "BlogPostService.flushBufferedReactionsToDatabase: DB write failed; events remain in processing queue:",
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

      const ack = this.redisClient.pipeline();
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
            await this.redisClient.hgetall<Record<string, string | number>>(
              bufferKey
            );
        } catch {
          // Tolerated
        }

        const isBufferEmpty =
          !remainingBuffer ||
          Object.values(remainingBuffer).every((val) => Number(val) <= 0);

        if (isBufferEmpty) {
          try {
            await this.redisClient.srem(dirtyKey, slug);
          } catch {
            // Tolerated
          }
        }
      }

      for (const slug of Object.keys(flushedCountsBySlug)) {
        await this.hydrateHandler.execute({ slug });
      }

      return createSuccess({
        processed: events.length,
        inserted: createResult.count,
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.error(
          "BlogPostService.flushBufferedReactionsToDatabase encountered error:",
          err
        );
      }
      return createFailure(
        "FLUSH_FAILED",
        "Buffered blog reactions could not be flushed from Redis",
        { details: err }
      );
    }
  }
}
