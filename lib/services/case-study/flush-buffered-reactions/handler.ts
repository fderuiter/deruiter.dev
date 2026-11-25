import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { BufferedReactionEvent } from "../shared";
import {
  FlushCaseStudyReactionsInputSchema,
  type FlushCaseStudyReactionsInput,
  type FlushCaseStudyReactionsResult,
  type FlushCaseStudyReactionsSpec,
} from "./spec";

export interface CaseStudyReactionFlushPipelineLike {
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

export interface CaseStudyReactionFlushRedisLike {
  lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]>;
  llen(key: string): Promise<number>;
  hgetall<T extends Record<string, unknown> = Record<string, unknown>>(
    key: string
  ): Promise<T | null>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  del(...keys: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  pipeline(): CaseStudyReactionFlushPipelineLike;
}

export interface FlushCaseStudyReactionsDeps {
  redisClient?: CaseStudyReactionFlushRedisLike;
  isRedisReady?: () => boolean;
  db?: {
    caseStudyReaction: {
      createMany(args: {
        data: Array<{
          id: string;
          caseStudySlug: string;
          reactionType: string;
          connectionHash: string;
          createdAt: Date;
        }>;
        skipDuplicates: boolean;
      }): Promise<{ count: number }>;
    };
  };
}

/**
 * Handler for flushing buffered case study reactions from Upstash Redis to PostgreSQL during maintenance.
 */
export class FlushCaseStudyReactionsHandler implements FlushCaseStudyReactionsSpec {
  private readonly redisClient: CaseStudyReactionFlushRedisLike;
  private readonly isRedisReady: () => boolean;
  private readonly db: NonNullable<FlushCaseStudyReactionsDeps["db"]>;

  constructor(deps: FlushCaseStudyReactionsDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.isRedisReady = deps.isRedisReady ?? isRedisConfigured;
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: FlushCaseStudyReactionsInput = {}
  ): Promise<FlushCaseStudyReactionsResult> {
    const parsed = FlushCaseStudyReactionsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        "Invalid reaction flush batch size",
        {
          recoverable: false,
          details: parsed.error,
        }
      );
    }

    const { batchSize } = parsed.data;
    const queueKey = getScopedRedisKey("cs:reactions_queue");
    const processingKey = getScopedRedisKey("cs:reactions_processing");
    const dirtyKey = getScopedRedisKey("cs:dirty_reactions");

    if (!this.isRedisReady()) {
      return createSuccess({ processed: 0, inserted: 0 });
    }

    try {
      const existingProcessing =
        await this.redisClient.lrange<BufferedReactionEvent>(
          processingKey,
          0,
          -1
        );
      let events: BufferedReactionEvent[] = Array.isArray(existingProcessing)
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
            (item): item is BufferedReactionEvent =>
              item !== null &&
              typeof item === "object" &&
              "id" in item &&
              "caseStudySlug" in item
          );
          events = [...events, ...newlyMoved];
        }
      }

      if (events.length === 0) {
        return createSuccess({ processed: 0, inserted: 0 });
      }

      let createResult: { count: number };
      try {
        createResult = await this.db.caseStudyReaction.createMany({
          data: events.map((e) => ({
            id: e.id,
            caseStudySlug: e.caseStudySlug,
            reactionType: e.reactionType,
            connectionHash: e.connectionHash,
            createdAt: new Date(e.createdAt),
          })),
          skipDuplicates: true,
        });
      } catch (dbErr) {
        logger.error(
          "CaseStudyService.flushBufferedReactionsToDatabase: DB write failed; events remain in processing queue:",
          dbErr
        );
        return createFailure(
          "PERSISTENCE_FAILED",
          "Buffered case study reactions could not be written to the database",
          { details: dbErr }
        );
      }

      const flushedCountsBySlug: Record<string, Record<string, number>> = {};
      for (const e of events) {
        if (!flushedCountsBySlug[e.caseStudySlug]) {
          flushedCountsBySlug[e.caseStudySlug] = {};
        }
        flushedCountsBySlug[e.caseStudySlug][e.reactionType] =
          (flushedCountsBySlug[e.caseStudySlug][e.reactionType] || 0) + 1;
      }

      const ack = this.redisClient.pipeline();
      for (const event of events) {
        ack.lrem(processingKey, 1, event);
      }

      for (const [slug, typeCounts] of Object.entries(flushedCountsBySlug)) {
        const bufferKey = getScopedRedisKey(`cs:reactions_buffer:${slug}`);
        const baseKey = getScopedRedisKey(`cs:reactions_counts:${slug}`);

        for (const [type, count] of Object.entries(typeCounts)) {
          ack.hincrby(bufferKey, type, -count);
        }
        ack.del(baseKey);
      }

      await ack.exec();

      for (const slug of Object.keys(flushedCountsBySlug)) {
        const bufferKey = getScopedRedisKey(`cs:reactions_buffer:${slug}`);
        let remainingBuffer: Record<string, string | number> | null = null;
        try {
          remainingBuffer =
            await this.redisClient.hgetall<Record<string, string | number>>(
              bufferKey
            );
        } catch {
          // Tolerated
        }

        let allZeroOrEmpty = true;
        if (remainingBuffer && typeof remainingBuffer === "object") {
          for (const [key, val] of Object.entries(remainingBuffer)) {
            if (Number(val) <= 0) {
              try {
                await this.redisClient.hdel(bufferKey, key);
              } catch {
                // Tolerated
              }
            } else {
              allZeroOrEmpty = false;
            }
          }
        }

        if (allZeroOrEmpty) {
          try {
            await this.redisClient.del(bufferKey);
          } catch {
            // Tolerated
          }
          try {
            await this.redisClient.srem(dirtyKey, slug);
          } catch {
            // Tolerated
          }
        }
      }

      return createSuccess({
        processed: events.length,
        inserted: createResult.count,
      });
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "CaseStudyService.flushBufferedReactionsToDatabase: Flush operation encountered error:",
          err
        );
      }
      return createFailure(
        "FLUSH_FAILED",
        "Buffered case study reactions could not be flushed from Redis",
        { details: err }
      );
    }
  }
}
