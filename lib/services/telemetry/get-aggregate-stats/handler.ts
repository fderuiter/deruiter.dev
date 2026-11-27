import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "../../service-result";
import {
  AGGREGATE_STATS_TTL_MS,
  cloneAggregateStats,
  getAggregateStatsCacheEntry,
  setAggregateStatsCacheEntry,
  TELEMETRY_AGGREGATE_KEY,
  TelemetryAggregateStatsSchema,
} from "../shared";
import type {
  GetTelemetryAggregateStatsInput,
  GetTelemetryAggregateStatsResult,
  GetTelemetryAggregateStatsSpec,
} from "./spec";

export interface GetTelemetryAggregateStatsRedisPort {
  get<T = unknown>(key: string): Promise<T | null>;
}

export interface GetTelemetryAggregateStatsDeps {
  redis?: GetTelemetryAggregateStatsRedisPort;
  isPlaywrightTest?: () => boolean;
}

export class GetTelemetryAggregateStatsHandler implements GetTelemetryAggregateStatsSpec {
  private readonly redisClient: GetTelemetryAggregateStatsRedisPort;
  private readonly isPlaywrightFn: () => boolean;

  constructor(deps?: GetTelemetryAggregateStatsDeps) {
    this.redisClient = deps?.redis ?? redis;
    this.isPlaywrightFn =
      deps?.isPlaywrightTest ?? (() => env.PLAYWRIGHT_TEST === "true");
  }

  async execute(
    _input?: GetTelemetryAggregateStatsInput
  ): Promise<GetTelemetryAggregateStatsResult> {
    if (this.isPlaywrightFn()) {
      return createSuccess({
        "synthetic-probe-runner": { views: 5, clicks: 2 },
        simulator: { views: 10, clicks: 4 },
        neuro: { views: 8, clicks: 3 },
      });
    }

    const now = Date.now();
    const cached = getAggregateStatsCacheEntry();
    if (cached && now < cached.expiresAt) {
      return createSuccess(cloneAggregateStats(cached.data));
    }

    try {
      const stored = await this.redisClient.get<unknown>(
        getScopedRedisKey(TELEMETRY_AGGREGATE_KEY)
      );
      const parsed = TelemetryAggregateStatsSchema.safeParse(stored ?? {});
      if (!parsed.success) {
        logger.warn(
          "Ignoring a malformed telemetry aggregate in Redis; serving the empty aggregate."
        );
      }
      const formattedStats = parsed.success ? parsed.data : {};

      setAggregateStatsCacheEntry({
        data: formattedStats,
        expiresAt: now + AGGREGATE_STATS_TTL_MS,
      });

      return createSuccess(cloneAggregateStats(formattedStats));
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to read telemetry aggregate stats from Redis",
        { recoverable: true, details: error }
      );
    }
  }
}
