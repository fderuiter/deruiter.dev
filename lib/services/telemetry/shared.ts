import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { RateLimitParamsSchema } from "@/lib/schemas";
import { redis, getScopedRedisKey } from "@/lib/redis";
import type { ServiceResult } from "@/lib/services/service-result";

/**
 * Error codes returned by telemetry maintenance operations (ADR 0028).
 */
export const TelemetryMaintenanceErrorCode = z.enum([
  "QUEUE_UNAVAILABLE",
  "PERSISTENCE_FAILED",
  "ACKNOWLEDGEMENT_FAILED",
  "RETENTION_FAILED",
  "AGGREGATE_FAILED",
  "INVALID_INPUT",
]);
export type TelemetryMaintenanceErrorCode = z.infer<
  typeof TelemetryMaintenanceErrorCode
>;

/** Result envelope of buffered telemetry event synchronization. */
export type TelemetrySyncResult = ServiceResult<
  { processed: number; inserted: number },
  TelemetryMaintenanceErrorCode
>;

/** Result envelope of refreshing cached aggregate telemetry statistics. */
export type TelemetryAggregateRefreshResult = ServiceResult<
  { projects: number },
  TelemetryMaintenanceErrorCode
>;

/** Result envelope of rolling up and pruning raw telemetry events. */
export type TelemetryRetentionResult = ServiceResult<
  { rollupsUpserted: number; rawEventsDeleted: number },
  TelemetryMaintenanceErrorCode
>;

/** Views and clicks per project slug returned by the public telemetry GET endpoint. */
export type TelemetryAggregateStats = Record<
  string,
  { views: number; clicks: number }
>;

/** Redis key holding the daily precomputed telemetry aggregate (#3201). */
export const TELEMETRY_AGGREGATE_KEY = "telemetry:aggregate";

export const AggregateStatsSchema = z.record(
  z.string(),
  z.object({
    views: z.number().int().nonnegative(),
    clicks: z.number().int().nonnegative(),
  })
);

export interface TelemetryEventInput {
  projectSlug: string;
  eventType: string;
}

/** A telemetry event stored in and read back from the Upstash Redis buffer. */
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
export const RATE_LIMIT_WINDOW_S = rateLimitConfig.windowMs / 1000;
export const MAX_REQUESTS_PER_WINDOW = rateLimitConfig.maxRequests;
export const RATE_LIMIT_TIMEOUT_MS = 1500;
export const SWAP_INTERVAL_MS = 5000;
export const CIRCUIT_BREAKER_COOLDOWN_MS = 30000;
export const AGGREGATE_STATS_TTL_MS = 10000;
export const BUFFER_ENQUEUE_TIMEOUT_MS = 2000;

/** Raised when the Redis buffer write exceeds its bounded time budget. */
export class BufferEnqueueTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Redis buffer enqueue timed out after ${timeoutMs}ms`);
    this.name = "BufferEnqueueTimeoutError";
  }
}

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

export function getTelemetryRateLimiter(): Ratelimit {
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
let circuitBreakerCooldownUntil = 0;

let aggregateStatsCache: {
  data: TelemetryAggregateStats;
  expiresAt: number;
} | null = null;

export function cloneAggregateStats(
  stats: Record<string, { views: number; clicks: number }>
): TelemetryAggregateStats {
  const result: TelemetryAggregateStats = {};
  for (const slug of Object.keys(stats)) {
    const val = stats[slug];
    if (val) {
      result[slug] = { views: val.views, clicks: val.clicks };
    }
  }
  return result;
}

export function swapTelemetryGenerations(): void {
  const temp = inactiveGeneration;
  inactiveGeneration = activeGeneration;
  activeGeneration = temp;
  activeGeneration.clear();
  lastSwapTime = Date.now();
}

export function checkAndSwapTelemetryPassive(): void {
  const now = Date.now();
  if (now - lastSwapTime >= SWAP_INTERVAL_MS) {
    if (now - lastSwapTime >= SWAP_INTERVAL_MS * 2) {
      activeGeneration.clear();
      inactiveGeneration.clear();
      lastSwapTime = now;
    } else {
      swapTelemetryGenerations();
    }
  }
}

export function getActiveGeneration(): Map<string, LocalCacheEntry> {
  return activeGeneration;
}

export function getInactiveGeneration(): Map<string, LocalCacheEntry> {
  return inactiveGeneration;
}

export function getCircuitBreakerCooldownUntil(): number {
  return circuitBreakerCooldownUntil;
}

export function setCircuitBreakerCooldownUntil(timestampMs: number): void {
  circuitBreakerCooldownUntil = timestampMs;
}

export function getAggregateStatsCacheState(): {
  data: TelemetryAggregateStats;
  expiresAt: number;
} | null {
  return aggregateStatsCache;
}

export function setAggregateStatsCacheState(
  next: {
    data: TelemetryAggregateStats;
    expiresAt: number;
  } | null
): void {
  aggregateStatsCache = next;
}

export function clearTelemetryAggregateCache(): void {
  aggregateStatsCache = null;
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
  get aggregateStats() {
    return aggregateStatsCache;
  },
  swap() {
    swapTelemetryGenerations();
  },
  clearAggregateCache() {
    aggregateStatsCache = null;
  },
  clearAggregateStatsCache() {
    aggregateStatsCache = null;
  },
  reset() {
    activeGeneration.clear();
    inactiveGeneration.clear();
    lastSwapTime = Date.now();
    circuitBreakerCooldownUntil = 0;
    aggregateStatsCache = null;
  },
};
