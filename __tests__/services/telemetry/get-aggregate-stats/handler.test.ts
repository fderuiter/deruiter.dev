// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  GetTelemetryAggregateStatsHandler,
  clearTelemetryAggregateCache,
} from "@/lib/services";

describe("GetTelemetryAggregateStatsHandler (Logic Test)", () => {
  it("reads and validates telemetry aggregate stats from Redis", async () => {
    clearTelemetryAggregateCache();
    const handler = new GetTelemetryAggregateStatsHandler({
      isPlaywrightTest: () => false,
      redis: {
        get: vi
          .fn()
          .mockResolvedValue({ "crf-studio": { views: 12, clicks: 5 } }),
      },
    });

    const result = await handler.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data["crf-studio"]).toEqual({ views: 12, clicks: 5 });
    }
  });

  it("returns STORAGE_UNAVAILABLE when Redis read throws", async () => {
    clearTelemetryAggregateCache();
    const handler = new GetTelemetryAggregateStatsHandler({
      isPlaywrightTest: () => false,
      redis: {
        get: vi.fn().mockRejectedValue(new Error("Redis ECONNREFUSED")),
      },
    });

    const result = await handler.execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
      expect(result.error.recoverable).toBe(true);
    }
  });
});
