import { getScopedRedisKey, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { ComputeTelemetryAggregateStatsHandler } from "../compute-aggregate-stats/handler";
import type { ComputeTelemetryAggregateStatsSpec } from "../compute-aggregate-stats/spec";
import {
  TELEMETRY_AGGREGATE_KEY,
  clearTelemetryAggregateCache,
  type TelemetryAggregateStats,
} from "../shared";
import {
  RefreshTelemetryAggregateStatsInputSchema,
  type RefreshTelemetryAggregateStatsInput,
  type RefreshTelemetryAggregateStatsResult,
  type RefreshTelemetryAggregateStatsSpec,
} from "./spec";

export interface TelemetryAggregateRedisWriterLike {
  set(key: string, value: TelemetryAggregateStats): Promise<unknown>;
}

export interface RefreshTelemetryAggregateStatsDeps {
  computeHandler?: ComputeTelemetryAggregateStatsSpec;
  redisClient?: TelemetryAggregateRedisWriterLike;
}

/**
 * Handler for computing aggregate statistics from PostgreSQL and writing them to Redis during daily maintenance.
 */
export class RefreshTelemetryAggregateStatsHandler implements RefreshTelemetryAggregateStatsSpec {
  private readonly computeHandler: ComputeTelemetryAggregateStatsSpec;
  private readonly redisClient: TelemetryAggregateRedisWriterLike;

  constructor(deps: RefreshTelemetryAggregateStatsDeps = {}) {
    this.computeHandler =
      deps.computeHandler ?? new ComputeTelemetryAggregateStatsHandler();
    this.redisClient = deps.redisClient ?? redis;
  }

  async execute(
    input: RefreshTelemetryAggregateStatsInput = {}
  ): Promise<RefreshTelemetryAggregateStatsResult> {
    const parsed = RefreshTelemetryAggregateStatsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid aggregate refresh input", {
        recoverable: false,
        details: parsed.error,
      });
    }

    try {
      const computed = await this.computeHandler.execute();
      if (!computed.success) {
        return createFailure(
          "AGGREGATE_FAILED",
          "Failed to refresh the telemetry aggregate in Redis",
          { recoverable: true, details: computed.error.details }
        );
      }

      await this.redisClient.set(
        getScopedRedisKey(TELEMETRY_AGGREGATE_KEY),
        computed.data
      );
      clearTelemetryAggregateCache();
      return createSuccess({ projects: Object.keys(computed.data).length });
    } catch (error) {
      return createFailure(
        "AGGREGATE_FAILED",
        "Failed to refresh the telemetry aggregate in Redis",
        { recoverable: true, details: error }
      );
    }
  }
}
