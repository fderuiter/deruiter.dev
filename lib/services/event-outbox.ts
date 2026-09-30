import { z } from "zod";
import { isRedisConfigured, redis } from "@/lib/redis";
import {
  createSuccess,
  createFailure,
  ServiceResult,
} from "@/lib/services/service-result";
import { logger } from "@/lib/logger";
import { env, isBuildPhase } from "@/lib/env";

/**
 * Configuration parameters for generic Redis event outbox queue flushing.
 *
 * @template TEvent Event type stored in the Redis queue and processing list.
 * @template TEntity Optional database entity input type.
 */
export interface EventOutboxConfig<TEvent, _TEntity = unknown> {
  /** Scoped Redis key for the pending event queue. */
  queueKey: string;
  /** Scoped Redis key for the processing queue during flush recovery. */
  processingKey: string;
  /** Maximum number of events to process in a single flush cycle (default: 500). */
  batchSize?: number;
  /** Expiration in seconds for the processing queue key (default: 48 hours). */
  expireSeconds?: number;
  /** Type validation predicate for events read from Redis lists. */
  isValidEvent: (item: unknown) => item is TEvent;
  /** Callback to persist a batch of events to the database (e.g. Prisma `createMany`). */
  persistEvents: (events: TEvent[]) => Promise<{ count: number }>;
  /**
   * Optional callback invoked before executing the acknowledgement pipeline.
   * Allows appending domain-specific Redis operations (such as buffer counter decrements)
   * into the same atomic pipeline as event `lrem` removal.
   */
  onAcknowledge?: (
    events: TEvent[],
    ackPipeline: ReturnType<typeof redis.pipeline>
  ) => void | Promise<void>;
  /**
   * Optional callback invoked after successful database persistence and queue acknowledgement.
   * Useful for post-flush maintenance like buffer cleanup, dirty flag removal, or count hydration.
   */
  postAcknowledge?: (
    events: TEvent[],
    createResult: { count: number }
  ) => Promise<void>;
  /** Logger context tag for diagnostic messages. */
  loggerName?: string;
  /** Custom error message when database persistence fails. */
  persistenceErrorMessage?: string;
  /** Custom error message when Redis queue read/transfer fails. */
  flushErrorMessage?: string;
}

/** Error codes returned by {@link flushOutboxQueue}. */
export const OutboxFlushErrorCode = z.enum([
  "PERSISTENCE_FAILED",
  "FLUSH_FAILED",
]);
export type OutboxFlushErrorCode = z.infer<typeof OutboxFlushErrorCode>;

/** Typed result envelope returned by {@link flushOutboxQueue}. */
export type OutboxFlushResult = ServiceResult<
  { processed: number; inserted: number },
  OutboxFlushErrorCode
>;

/**
 * Flushes buffered events from an Upstash Redis list queue to Postgres in atomic batches.
 *
 * Enforces batch depth clamping using Redis `llen` and atomic transfers via `lmove`.
 * Enforces idempotent re-processing recovery from `processingKey` across interrupted runs.
 *
 * @template TEvent Event structure buffered in Redis.
 * @template TEntity Optional database entity model type.
 * @param config Outbox configuration specifying queue keys, predicates, and database handlers.
 * @returns Standard {@link ServiceResult} envelope containing `processed` and `inserted` counts or failure metadata.
 */
export async function flushOutboxQueue<TEvent, _TEntity = unknown>(
  config: EventOutboxConfig<TEvent, _TEntity>
): Promise<OutboxFlushResult> {
  const {
    queueKey,
    processingKey,
    batchSize = 500,
    expireSeconds = 48 * 60 * 60,
    isValidEvent,
    persistEvents,
    onAcknowledge,
    postAcknowledge,
    loggerName = "EventOutbox",
    persistenceErrorMessage = "Buffered events could not be written to the database",
    flushErrorMessage = "Buffered events could not be flushed from Redis",
  } = config;

  if (!isRedisConfigured()) {
    return createSuccess({ processed: 0, inserted: 0 });
  }

  try {
    // 1. Fetch pending items from processing queue (recovery from previous interrupted sync)
    const existingProcessing = (await redis.lrange(
      processingKey,
      0,
      -1
    )) as unknown[];
    let events: TEvent[] = Array.isArray(existingProcessing)
      ? existingProcessing.filter(isValidEvent)
      : [];

    // 2. Atomically move items from queue to processing if under batchSize
    if (events.length < batchSize) {
      const rawQueueDepth = await redis.llen(queueKey);
      const queueDepth =
        typeof rawQueueDepth === "number" && !Number.isNaN(rawQueueDepth)
          ? rawQueueDepth
          : 0;
      const needed = Math.min(batchSize - events.length, queueDepth);

      if (needed > 0) {
        const p = redis.pipeline();
        for (let i = 0; i < needed; i++) {
          p.lmove(queueKey, processingKey, "right", "left");
        }
        p.expire(processingKey, expireSeconds);
        const moveResults = await p.exec();

        const newlyMoved = moveResults.filter(isValidEvent);
        events = [...events, ...newlyMoved];
      }
    }

    if (events.length === 0) {
      return createSuccess({ processed: 0, inserted: 0 });
    }

    // 3. Persist events to Postgres in batch
    let createResult: { count: number };
    try {
      createResult = await persistEvents(events);
    } catch (dbErr) {
      logger.error(
        `${loggerName}: DB write failed; events remain in processing queue:`,
        dbErr
      );
      return createFailure("PERSISTENCE_FAILED", persistenceErrorMessage, {
        details: dbErr,
      });
    }

    // 4. Acknowledge persisted events from processing queue & run domain pipeline extensions
    const ack = redis.pipeline();
    for (const event of events) {
      ack.lrem(processingKey, 1, event);
    }

    if (onAcknowledge) {
      await onAcknowledge(events, ack);
    }

    await ack.exec();

    // 5. Run post-acknowledgement tasks (buffer cleanup, dirty flags, hydration)
    if (postAcknowledge) {
      await postAcknowledge(events, createResult);
    }

    return createSuccess({
      processed: events.length,
      inserted: createResult.count,
    });
  } catch (err) {
    if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
      logger.error(`${loggerName} encountered error:`, err);
    }
    return createFailure("FLUSH_FAILED", flushErrorMessage, { details: err });
  }
}
