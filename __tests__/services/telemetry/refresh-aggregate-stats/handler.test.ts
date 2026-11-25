// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  RefreshTelemetryAggregateStatsHandler,
  createFailure,
  createSuccess,
  type ComputeTelemetryAggregateStatsSpec,
  type TelemetryAggregateRedisWriterLike,
} from "@/lib/services";

describe("RefreshTelemetryAggregateStatsHandler (Logic Test)", () => {
  it("writes computed aggregate snapshot to Redis and reports project count", async () => {
    const computeHandler = fromPartial<ComputeTelemetryAggregateStatsSpec>({
      execute: async () =>
        createSuccess({
          crf: { views: 10, clicks: 2 },
          neuro: { views: 5, clicks: 1 },
        }),
    });
    const redisClient = fromPartial<TelemetryAggregateRedisWriterLike>({
      set: async () => "OK",
    });

    const handler = new RefreshTelemetryAggregateStatsHandler({
      computeHandler,
      redisClient,
    });
    const result = await handler.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projects).toBe(2);
    }
  });

  it("propagates failure when computeHandler or Redis set fails", async () => {
    const computeHandler = fromPartial<ComputeTelemetryAggregateStatsSpec>({
      execute: async () =>
        createFailure("AGGREGATE_FAILED", "DB compute failed"),
    });
    const handler = new RefreshTelemetryAggregateStatsHandler({
      computeHandler,
    });
    const result = await handler.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("AGGREGATE_FAILED");
    }
  });
});
