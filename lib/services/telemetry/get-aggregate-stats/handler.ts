import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  AGGREGATE_STATS_TTL_MS,
  AggregateStatsSchema,
  TELEMETRY_AGGREGATE_KEY,
  cloneAggregateStats,
  getAggregateStatsCacheState,
  setAggregateStatsCacheState,
} from "../shared";
import {
  GetTelemetryAggregateStatsInputSchema,
  type GetTelemetryAggregateStatsInput,
  type GetTelemetryAggregateStatsResult,
  type GetTelemetryAggregateStatsSpec,
} from "./spec";

export interface TelemetryAggregateRedisReaderLike {
  get<T = unknown>(key: string): Promise<T | null>;
}

export interface GetTelemetryAggregateStatsDeps {
  redisClient?: TelemetryAggregateRedisReaderLike;
  clock?: () => number;
}

/**
 * Handler for reading precomputed view and click aggregates from Upstash Redis with a 10s local cache.
 * Never queries PostgreSQL on public visitor requests (ADR 0043 §3).
 */
export class GetTelemetryAggregateStatsHandler implements GetTelemetryAggregateStatsSpec {
  private readonly redisClient: TelemetryAggregateRedisReaderLike;
  private readonly clock: () => number;

  constructor(deps: GetTelemetryAggregateStatsDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.clock = deps.clock ?? Date.now;
  }

  async execute(
    input: GetTelemetryAggregateStatsInput = {}
  ): Promise<GetTelemetryAggregateStatsResult> {
    const parsedInput = GetTelemetryAggregateStatsInputSchema.safeParse(input);
    if (!parsedInput.success) {
      return createFailure(
        "INVALID_INPUT",
        "Invalid aggregate telemetry read input",
        { recoverable: false, details: parsedInput.error }
      );
    }

    if (env.PLAYWRIGHT_TEST === "true") {
      return createSuccess({
        "synthetic-probe-runner": { views: 5, clicks: 2 },
        simulator: { views: 10, clicks: 4 },
        neuro: { views: 8, clicks: 3 },
      });
    }

    const now = this.clock();
    const cached = getAggregateStatsCacheState();
    if (cached && now < cached.expiresAt) {
      return createSuccess(cloneAggregateStats(cached.data));
    }

    try {
      const stored = await this.redisClient.get<unknown>(
        getScopedRedisKey(TELEMETRY_AGGREGATE_KEY)
      );
      const parsed = AggregateStatsSchema.safeParse(stored ?? {});
      if (!parsed.success) {
        logger.warn(
          "Ignoring a malformed telemetry aggregate in Redis; serving the empty aggregate."
        );
      }
      const formattedStats = parsed.success ? parsed.data : {};

      setAggregateStatsCacheState({
        data: formattedStats,
        expiresAt: now + AGGREGATE_STATS_TTL_MS,
      });

      return createSuccess(cloneAggregateStats(formattedStats));
    } catch (error) {
      return createFailure(
        "QUEUE_UNAVAILABLE",
        "Failed to compile aggregate portfolio telemetry",
        { recoverable: true, details: error }
      );
    }
  }
}
