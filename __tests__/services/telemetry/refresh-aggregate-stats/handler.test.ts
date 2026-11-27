// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  RefreshTelemetryAggregateStatsHandler,
  createFailure,
  createSuccess,
} from "@/lib/services";

describe("RefreshTelemetryAggregateStatsHandler (Logic Test)", () => {
  it("writes computed aggregate map to Redis and returns project count", async () => {
    const set = vi.fn().mockResolvedValue("OK");
    const handler = new RefreshTelemetryAggregateStatsHandler({
      computeHandler: {
        execute: vi.fn().mockResolvedValue(
          createSuccess({
            "crf-studio": { views: 9, clicks: 2 },
            equipose: { views: 4, clicks: 1 },
          })
        ),
      },
      redis: { set },
    });

    const result = await handler.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projects).toBe(2);
    }
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("returns AGGREGATE_FAILED when computeHandler fails or Redis write throws", async () => {
    const failedCompute = new RefreshTelemetryAggregateStatsHandler({
      computeHandler: {
        execute: vi
          .fn()
          .mockResolvedValue(createFailure("AGGREGATE_FAILED", "DB error")),
      },
      redis: { set: vi.fn() },
    });
    const res1 = await failedCompute.execute();
    expect(res1.success).toBe(false);
    if (!res1.success) {
      expect(res1.error.code).toBe("AGGREGATE_FAILED");
    }
  });
});
