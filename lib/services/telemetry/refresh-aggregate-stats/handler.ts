import { getScopedRedisKey, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "../../service-result";
import {
  ComputeTelemetryAggregateStatsHandler,
  type ComputeTelemetryAggregatePrismaPort,
} from "../compute-aggregate-stats/handler";
import type { ComputeTelemetryAggregateStatsSpec } from "../compute-aggregate-stats/spec";
import {
  clearTelemetryAggregateCache,
  TELEMETRY_AGGREGATE_KEY,
} from "../shared";
import type {
  RefreshTelemetryAggregateStatsInput,
  RefreshTelemetryAggregateStatsResult,
  RefreshTelemetryAggregateStatsSpec,
} from "./spec";

export interface RefreshTelemetryAggregateRedisPort {
  set(key: string, value: unknown): Promise<unknown>;
}

export interface RefreshTelemetryAggregateStatsDeps {
  computeHandler?: ComputeTelemetryAggregateStatsSpec;
  prisma?: ComputeTelemetryAggregatePrismaPort;
  redis?: RefreshTelemetryAggregateRedisPort;
}

export class RefreshTelemetryAggregateStatsHandler implements RefreshTelemetryAggregateStatsSpec {
  private readonly computeHandler: ComputeTelemetryAggregateStatsSpec;
  private readonly redisClient: RefreshTelemetryAggregateRedisPort;

  constructor(deps?: RefreshTelemetryAggregateStatsDeps) {
    this.computeHandler =
      deps?.computeHandler ??
      new ComputeTelemetryAggregateStatsHandler({ prisma: deps?.prisma });
    this.redisClient = deps?.redis ?? redis;
  }

  async execute(
    _input?: RefreshTelemetryAggregateStatsInput
  ): Promise<RefreshTelemetryAggregateStatsResult> {
    try {
      const computed = await this.computeHandler.execute();
      if (!computed.success) {
        return createFailure(
          "AGGREGATE_FAILED",
          "Failed to refresh the telemetry aggregate in Redis",
          {
            recoverable: true,
            details: computed.error.details ?? computed.error.message,
          }
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
