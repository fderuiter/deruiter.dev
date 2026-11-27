import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, isRedisConfigured, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type {
  BufferedReactionEvent,
  CaseStudyReactionFlushResult,
} from "../shared";
import {
  FlushCaseStudyReactionsInputSchema,
  type FlushCaseStudyReactionsInput,
  type FlushCaseStudyReactionsSpec,
} from "./spec";

export interface FlushCaseStudyReactionsPrismaPort {
  createMany(args: {
    data: Array<{
      id: string;
      caseStudySlug: string;
      reactionType: string;
      connectionHash: string;
      createdAt: Date;
    }>;
    skipDuplicates: true;
  }): Promise<{ count: number }>;
}

export interface FlushCaseStudyReactionsDeps {
  reactions?: FlushCaseStudyReactionsPrismaPort;
}

export class FlushCaseStudyReactionsHandler implements FlushCaseStudyReactionsSpec {
  private readonly reactions: FlushCaseStudyReactionsPrismaPort;

  constructor(deps: FlushCaseStudyReactionsDeps = {}) {
    this.reactions = deps.reactions ?? prisma.caseStudyReaction;
  }

  async execute(
    input: FlushCaseStudyReactionsInput = {}
  ): Promise<CaseStudyReactionFlushResult> {
    const parsed = FlushCaseStudyReactionsInputSchema.safeParse(input);
    const batchSize =
      parsed.success && parsed.data.batchSize !== undefined
        ? parsed.data.batchSize
        : 500;

    const queueKey = getScopedRedisKey("cs:reactions_queue");
    const processingKey = getScopedRedisKey("cs:reactions_processing");
    const dirtyKey = getScopedRedisKey("cs:dirty_reactions");

    if (!isRedisConfigured()) {
      return createSuccess({ processed: 0, inserted: 0 });
    }

    try {
      const existingProcessing = (await redis.lrange(
        processingKey,
        0,
        -1
      )) as BufferedReactionEvent[];
      let events: BufferedReactionEvent[] = Array.isArray(existingProcessing)
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
        createResult = await this.reactions.createMany({
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
          "FlushCaseStudyReactionsHandler: DB write failed; events remain in processing queue:",
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

      const ack = redis.pipeline();
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
            await redis.hgetall<Record<string, string | number>>(bufferKey);
        } catch {
          // Tolerated
        }

        let allZeroOrEmpty = true;
        if (remainingBuffer && typeof remainingBuffer === "object") {
          for (const [key, val] of Object.entries(remainingBuffer)) {
            if (Number(val) <= 0) {
              try {
                await redis.hdel(bufferKey, key);
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
            await redis.del(bufferKey);
          } catch {
            // Tolerated
          }
          try {
            await redis.srem(dirtyKey, slug);
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
          "FlushCaseStudyReactionsHandler: Flush operation encountered error:",
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
