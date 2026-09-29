import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { redis, getScopedRedisKey } from "@/lib/redis";
import { RateLimitParamsSchema } from "@/lib/schemas";
import { Ratelimit } from "@upstash/ratelimit";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  generateClientConnectionHash,
  extractClientIp,
} from "./privacy-service";

export interface TelemetryEventInput {
  projectSlug: string;
  eventType: string;
}

/** A telemetry event as it is held in, and read back from, the Redis buffer. */
export interface BufferedTelemetryEvent {
  id: string;
  projectSlug: string;
  eventType: string;
  createdAt: string | Date;
}

export interface LocalCacheEntry {
  count: number;
  expiresAt: number;
}

const rateLimitConfig = RateLimitParamsSchema.parse({});
const RATE_LIMIT_WINDOW_S = rateLimitConfig.windowMs / 1000;
const MAX_REQUESTS_PER_WINDOW = rateLimitConfig.maxRequests;
const RATE_LIMIT_TIMEOUT_MS = 1500;

const sdkEphemeralCache = new Map<string, number>();

const createRateLimiter = (prefix: string) =>
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      MAX_REQUESTS_PER_WINDOW,
      `${RATE_LIMIT_WINDOW_S} s`
    ),
    ephemeralCache: sdkEphemeralCache,
    prefix,
  });

let activePrefix = getScopedRedisKey("@upstash/ratelimit");
let ratelimitInstance = createRateLimiter(activePrefix);

function getRateLimiter() {
  const currentPrefix = getScopedRedisKey("@upstash/ratelimit");
  if (currentPrefix !== activePrefix) {
    activePrefix = currentPrefix;
    ratelimitInstance = createRateLimiter(currentPrefix);
  }
  return ratelimitInstance;
}

let activeGeneration = new Map<string, LocalCacheEntry>();
let inactiveGeneration = new Map<string, LocalCacheEntry>();
let lastSwapTime = Date.now();

const SWAP_INTERVAL_MS = 5000;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30000;
let circuitBreakerCooldownUntil = 0;

function swapGenerations() {
  const temp = inactiveGeneration;
  inactiveGeneration = activeGeneration;
  activeGeneration = temp;
  activeGeneration.clear();
  lastSwapTime = Date.now();
}

function checkAndSwapPassive() {
  const now = Date.now();
  if (now - lastSwapTime >= SWAP_INTERVAL_MS) {
    if (now - lastSwapTime >= SWAP_INTERVAL_MS * 2) {
      activeGeneration.clear();
      inactiveGeneration.clear();
      lastSwapTime = now;
    } else {
      swapGenerations();
    }
  }
}

export const _testCache = {
  get active() {
    return activeGeneration;
  },
  get inactive() {
    return inactiveGeneration;
  },
  get circuitBreakerCooldownUntil() {
    return circuitBreakerCooldownUntil;
  },
  swap() {
    swapGenerations();
  },
  reset() {
    activeGeneration.clear();
    inactiveGeneration.clear();
    lastSwapTime = Date.now();
    circuitBreakerCooldownUntil = 0;
  },
};

const BUFFER_ENQUEUE_TIMEOUT_MS = 2000;

/** Raised when the Redis buffer write exceeds its time budget. */
class BufferEnqueueTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Redis buffer enqueue timed out after ${timeoutMs}ms`);
    this.name = "BufferEnqueueTimeoutError";
  }
}

export class TelemetryService {
  /**
   * Evaluates rate limiting anonymously using Web Crypto SHA-256 IP hashing.
   */
  static async isRateLimited(
    req: NextRequest
  ): Promise<{ limited: boolean; headers?: Record<string, string> }> {
    checkAndSwapPassive();

    const ip = extractClientIp(req);
    const ipHash = await generateClientConnectionHash(ip);
    const now = Date.now();

    const isCircuitActive = now < circuitBreakerCooldownUntil;

    const buildLocalHeaders = (entry: LocalCacheEntry) => ({
      "X-RateLimit-Limit": String(MAX_REQUESTS_PER_WINDOW),
      "X-RateLimit-Remaining": String(
        Math.max(0, MAX_REQUESTS_PER_WINDOW - entry.count)
      ),
      "X-RateLimit-Reset": String(Math.ceil(entry.expiresAt / 1000)),
    });

    let cached = activeGeneration.get(ipHash);
    if (!cached) {
      cached = inactiveGeneration.get(ipHash);
    }

    if (isCircuitActive) {
      if (cached && now < cached.expiresAt) {
        cached.count += 1;
        cached.expiresAt = Math.max(
          cached.expiresAt,
          circuitBreakerCooldownUntil
        );
      } else {
        cached = {
          count: 1,
          expiresAt: Math.max(circuitBreakerCooldownUntil, now + 5000),
        };
        activeGeneration.set(ipHash, cached);
      }

      const isLimited = cached.count > MAX_REQUESTS_PER_WINDOW;
      return {
        limited: isLimited,
        headers: buildLocalHeaders(cached),
      };
    }

    if (cached && now < cached.expiresAt) {
      if (cached.count < MAX_REQUESTS_PER_WINDOW) {
        cached.count += 1;
        return {
          limited: false,
          headers: buildLocalHeaders(cached),
        };
      }
    }

    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `Upstream rate limiting request timed out after ${RATE_LIMIT_TIMEOUT_MS}ms`
            )
          );
        }, RATE_LIMIT_TIMEOUT_MS);
        timer.unref?.();
      });

      let result;
      try {
        result = await Promise.race([
          getRateLimiter().limit(ipHash),
          timeoutPromise,
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }

      const headers = {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
      };

      if (result.success) {
        activeGeneration.set(ipHash, {
          count: MAX_REQUESTS_PER_WINDOW - result.remaining,
          expiresAt: Math.min(result.reset, now + 5000),
        });
        return { limited: false, headers };
      } else {
        activeGeneration.delete(ipHash);
        inactiveGeneration.delete(ipHash);
        return { limited: true, headers };
      }
    } catch (err) {
      logger.error(
        "Upstream rate limiting check failed, activating 30s circuit breaker fallback:",
        err
      );
      circuitBreakerCooldownUntil = now + CIRCUIT_BREAKER_COOLDOWN_MS;

      if (cached && now < cached.expiresAt) {
        cached.count += 1;
        cached.expiresAt = Math.max(
          cached.expiresAt,
          circuitBreakerCooldownUntil
        );
      } else {
        cached = {
          count: 1,
          expiresAt: circuitBreakerCooldownUntil,
        };
        activeGeneration.set(ipHash, cached);
      }

      const isLimited = cached.count > MAX_REQUESTS_PER_WINDOW;
      return {
        limited: isLimited,
        headers: buildLocalHeaders(cached),
      };
    } finally {
      // Memory sweeping check when capacity is reached
      if (activeGeneration.size > 5000) {
        for (const [key, entry] of activeGeneration.entries()) {
          if (Date.now() >= entry.expiresAt) {
            activeGeneration.delete(key);
          }
        }
      }
    }
  }

  /**
   * Records a telemetry interaction event into the Redis buffer queue.
   *
   * The Redis buffer is the only store in front of the sync job, so a failed
   * enqueue drops the event outright. `buffered` reports whether the event was
   * actually accepted so callers never present a dropped event as durable.
   */
  static async recordEvent(
    data: TelemetryEventInput
  ): Promise<{ event: BufferedTelemetryEvent; buffered: boolean }> {
    const eventId = crypto.randomUUID();
    const eventData = {
      id: eventId,
      projectSlug: data.projectSlug,
      eventType: data.eventType,
      createdAt: new Date(),
    };

    if (env.PLAYWRIGHT_TEST === "true") {
      return { event: eventData, buffered: true };
    }

    try {
      const bufferKey = getScopedRedisKey("telemetry_buffer");
      const p = redis.pipeline();
      p.lpush(bufferKey, eventData);
      p.expire(bufferKey, 48 * 60 * 60); // 48 hours

      let execTimer: ReturnType<typeof setTimeout> | undefined;
      const execTimeoutPromise = new Promise<never>((_, reject) => {
        execTimer = setTimeout(() => {
          reject(new BufferEnqueueTimeoutError(BUFFER_ENQUEUE_TIMEOUT_MS));
        }, BUFFER_ENQUEUE_TIMEOUT_MS);
        execTimer.unref?.();
      });

      let listLength: unknown;
      try {
        const [len] = await Promise.race([p.exec(), execTimeoutPromise]);
        listLength = len;
      } finally {
        if (execTimer) clearTimeout(execTimer);
      }

      if (Number(listLength) > 1000) {
        logger.error(
          "ALERT: Secondary telemetry buffer occupancy exceeds threshold."
        );
      }
    } catch (err) {
      // A slow Upstash round trip is an expected degradation: the beacon is
      // answered with a cheap 202 and the client never retries, so it is not
      // an application error and must not spend Sentry quota (#1341).
      if (err instanceof BufferEnqueueTimeoutError) {
        logger.warn(
          "Telemetry buffer enqueue timed out; event dropped (non-durable 202):",
          { timeoutMs: BUFFER_ENQUEUE_TIMEOUT_MS }
        );
        return { event: eventData, buffered: false };
      }
      // Losing the event here is silent by nature: nothing else holds it.
      logger.error("Failed to commit telemetry event to Redis buffer:", err);
      return { event: eventData, buffered: false };
    }

    return { event: eventData, buffered: true };
  }

  /**
   * Fetches aggregate portfolio view/click telemetry statistics.
   */
  static async getAggregateStats() {
    if (env.PLAYWRIGHT_TEST === "true") {
      return {
        "synthetic-probe-runner": { views: 5, clicks: 2 },
        simulator: { views: 10, clicks: 4 },
        neuro: { views: 8, clicks: 3 },
      };
    }

    const formattedStats: Record<string, { views: number; clicks: number }> =
      {};

    await prisma.$transaction(
      async (transaction) => {
        const [rawStats, rollupStats] = await Promise.all([
          transaction.telemetryEvent.groupBy({
            by: ["projectSlug", "eventType"],
            where: { eventType: { in: ["page_view", "project_click"] } },
            _count: { id: true },
          }),
          transaction.telemetryDailyRollup.groupBy({
            by: ["projectSlug", "eventType"],
            where: { eventType: { in: ["page_view", "project_click"] } },
            _sum: { count: true },
          }),
        ]);

        const addStats = (slug: string, eventType: string, count: number) => {
          if (eventType !== "page_view" && eventType !== "project_click") {
            return;
          }

          if (!formattedStats[slug]) {
            formattedStats[slug] = { views: 0, clicks: 0 };
          }

          if (eventType === "page_view") {
            formattedStats[slug].views += count;
          } else {
            formattedStats[slug].clicks += count;
          }
        };

        for (const item of rawStats) {
          addStats(item.projectSlug, item.eventType, item._count.id);
        }

        for (const item of rollupStats) {
          addStats(item.projectSlug, item.eventType, item._sum.count ?? 0);
        }
      },
      { isolationLevel: "RepeatableRead" }
    );

    return formattedStats;
  }

  /**
   * Synchronizes buffered telemetry events from Redis into PostgreSQL.
   *
   * Events move from `telemetry_buffer` to `telemetry_processing` one at a time
   * with LMOVE, so a crash mid-transfer cannot drop them, and a batch that
   * fails to reach the database stays in `telemetry_processing` for the next
   * run. Acknowledgement is per event rather than per queue: only the events
   * this invocation persisted are removed, so an overlapping invocation's
   * batch survives. Re-processing is idempotent through the explicit event id.
   */
  static async syncBufferedEvents(batchSize: number) {
    type BufferedEvent = BufferedTelemetryEvent;
    const bufferKey = getScopedRedisKey("telemetry_buffer");
    const processingKey = getScopedRedisKey("telemetry_processing");

    // 1. Fetch any pending events previously transferred to processing queue but not yet synced to DB
    const existingProcessing = (await redis.lrange(
      processingKey,
      0,
      -1
    )) as BufferedEvent[];
    let events: BufferedEvent[] = Array.isArray(existingProcessing)
      ? existingProcessing
      : [];

    // 2. If existing processing queue has fewer items than batchSize, atomically move remaining batch from buffer
    if (events.length < batchSize) {
      const needed = batchSize - events.length;
      const p = redis.pipeline();
      for (let i = 0; i < needed; i++) {
        p.lmove(bufferKey, processingKey, "right", "left");
      }
      p.expire(processingKey, 48 * 60 * 60);
      const moveResults = await p.exec();

      const newlyMoved = moveResults.filter(
        (item): item is BufferedEvent =>
          item !== null && typeof item === "object" && "id" in item
      );

      events = [...events, ...newlyMoved];
    }

    if (events.length === 0) {
      return { processed: 0, inserted: 0 };
    }

    let createResult;
    try {
      createResult = await prisma.telemetryEvent.createMany({
        data: events.map((e) => ({
          id: e.id,
          projectSlug: e.projectSlug,
          eventType: e.eventType,
          createdAt: new Date(e.createdAt),
        })),
        skipDuplicates: true,
      });
    } catch (dbErr) {
      logger.warn(
        "Primary database write failed during sync. Telemetry event batch remains intact in processing queue.",
        dbErr
      );
      throw dbErr;
    }

    // On successful DB write, acknowledge exactly the events this invocation
    // persisted. Deleting the whole key would also discard events that an
    // overlapping sync moved into the processing queue after step 1 read it,
    // losing them before they ever reached the database. LREM removes a single
    // occurrence per owned event, so a concurrently moved event survives.
    const ack = redis.pipeline();
    for (const event of events) {
      ack.lrem(processingKey, 1, event);
    }
    await ack.exec();

    return { processed: events.length, inserted: createResult.count };
  }

  /**
   * Rolls raw events older than the cutoff into daily aggregates and removes
   * only the rows committed by the same database transaction.
   */
  static async rollupAndPruneRawEvents(before: Date): Promise<{
    rollupsUpserted: number;
    rawEventsDeleted: number;
  }> {
    return prisma.$transaction(async (transaction) => {
      const rollupsUpserted = await transaction.$executeRaw`
        INSERT INTO "TelemetryDailyRollup"
          ("day", "projectSlug", "eventType", "count", "createdAt", "updatedAt")
        SELECT
          date_trunc('day', "createdAt")::date,
          "projectSlug",
          "eventType",
          COUNT(*)::integer,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM "TelemetryEvent"
        WHERE "createdAt" < ${before}
        GROUP BY date_trunc('day', "createdAt")::date, "projectSlug", "eventType"
        ON CONFLICT ("day", "projectSlug", "eventType")
        DO UPDATE SET
          "count" = "TelemetryDailyRollup"."count" + EXCLUDED."count",
          "updatedAt" = CURRENT_TIMESTAMP
      `;

      const rawEventsDeleted = await transaction.$executeRaw`
        DELETE FROM "TelemetryEvent" WHERE "createdAt" < ${before}
      `;

      return { rollupsUpserted, rawEventsDeleted };
    });
  }
}
