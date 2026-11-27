import { z } from "zod";
import { RateLimitParamsSchema } from "@/lib/schemas";
import { Ratelimit } from "@upstash/ratelimit";
import { redis, getScopedRedisKey } from "@/lib/redis";
import type { ServiceResult } from "../service-result";

/**
 * Error codes returned by the telemetry maintenance operations (ADR 0028).
 */
export const TelemetryMaintenanceErrorCode = z.enum([
  "QUEUE_UNAVAILABLE",
  "PERSISTENCE_FAILED",
  "ACKNOWLEDGEMENT_FAILED",
  "RETENTION_FAILED",
  "AGGREGATE_FAILED",
]);
export type TelemetryMaintenanceErrorCode = z.infer<
  typeof TelemetryMaintenanceErrorCode
>;

/** Result envelope of SyncBufferedEventsHandler. */
export type TelemetrySyncResult = ServiceResult<
  { processed: number; inserted: number },
  TelemetryMaintenanceErrorCode
>;

/** Result envelope of RefreshTelemetryAggregateStatsHandler. */
export type TelemetryAggregateRefreshResult = ServiceResult<
  { projects: number },
  TelemetryMaintenanceErrorCode
>;

/** Views and clicks per project slug, as the public telemetry GET returns them. */
export type TelemetryAggregateStats = Record<
  string,
  { views: number; clicks: number }
>;

/** Redis key holding the aggregate the daily maintenance run writes (#3201). */
export const TELEMETRY_AGGREGATE_KEY = "telemetry:aggregate";

export const TelemetryAggregateStatsSchema = z.record(
  z.string(),
  z.object({
    views: z.number().int().nonnegative(),
    clicks: z.number().int().nonnegative(),
  })
);

/** Result envelope of RollupAndPruneTelemetryHandler. */
export type TelemetryRetentionResult = ServiceResult<
  { rollupsUpserted: number; rawEventsDeleted: number },
  TelemetryMaintenanceErrorCode
>;

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
export const RATE_LIMIT_WINDOW_S = rateLimitConfig.windowMs / 1000;
export const MAX_REQUESTS_PER_WINDOW = rateLimitConfig.maxRequests;
export const RATE_LIMIT_TIMEOUT_MS = 1500;
export const SWAP_INTERVAL_MS = 5000;
export const CIRCUIT_BREAKER_COOLDOWN_MS = 30000;
export const AGGREGATE_STATS_TTL_MS = 10000;
export const BUFFER_ENQUEUE_TIMEOUT_MS = 2000;

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
  stats: TelemetryAggregateStats
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

export function getTelemetryActiveGeneration(): Map<string, LocalCacheEntry> {
  return activeGeneration;
}

export function getTelemetryInactiveGeneration(): Map<string, LocalCacheEntry> {
  return inactiveGeneration;
}

export function getCircuitBreakerCooldownUntil(): number {
  return circuitBreakerCooldownUntil;
}

export function setCircuitBreakerCooldownUntil(until: number): void {
  circuitBreakerCooldownUntil = until;
}

export function getAggregateStatsCacheEntry(): {
  data: TelemetryAggregateStats;
  expiresAt: number;
} | null {
  return aggregateStatsCache;
}

export function setAggregateStatsCacheEntry(
  entry: { data: TelemetryAggregateStats; expiresAt: number } | null
): void {
  aggregateStatsCache = entry;
}

export function clearTelemetryAggregateCache(): void {
  aggregateStatsCache = null;
}

/** Test-only introspection handle for double-buffered rate-limit and aggregate caches. */
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
