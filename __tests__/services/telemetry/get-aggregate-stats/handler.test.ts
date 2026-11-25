// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GetTelemetryAggregateStatsHandler,
  _testCache,
  type GetTelemetryAggregateStatsInput,
  type TelemetryAggregateRedisReaderLike,
} from "@/lib/services";

describe("GetTelemetryAggregateStatsHandler (Logic Test)", () => {
  beforeEach(() => {
    _testCache.clearAggregateStatsCache();
  });

  it("reads precomputed telemetry stats from Redis without touching Postgres", async () => {
    const redisClient = fromPartial<TelemetryAggregateRedisReaderLike>({
      get: (async () => ({
        simulator: { views: 12, clicks: 4 },
      })) as TelemetryAggregateRedisReaderLike["get"],
    });

    const handler = new GetTelemetryAggregateStatsHandler({
      redisClient,
      clock: () => 50_000,
    });
    const result = await handler.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.simulator).toEqual({ views: 12, clicks: 4 });
    }
  });

  it("returns INVALID_INPUT on invalid input payload", async () => {
    const handler = new GetTelemetryAggregateStatsHandler();
    const result = await handler.execute(
      fromPartial<GetTelemetryAggregateStatsInput>("bad" as never)
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
