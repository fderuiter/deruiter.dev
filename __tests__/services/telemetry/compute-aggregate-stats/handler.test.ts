// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  ComputeTelemetryAggregateStatsHandler,
  type ComputeTelemetryAggregatePrismaPort,
  type TelemetryAggregateTxPort,
} from "@/lib/services";

describe("ComputeTelemetryAggregateStatsHandler (Logic Test)", () => {
  it("merges raw telemetry events and daily rollups by project slug", async () => {
    const tx: TelemetryAggregateTxPort = {
      telemetryEvent: {
        groupBy: vi.fn().mockResolvedValue([
          {
            projectSlug: "crf-studio",
            eventType: "page_view",
            _count: { id: 4 },
          },
        ]),
      },
      telemetryDailyRollup: {
        groupBy: vi.fn().mockResolvedValue([
          {
            projectSlug: "crf-studio",
            eventType: "page_view",
            _sum: { count: 6 },
          },
          {
            projectSlug: "crf-studio",
            eventType: "project_click",
            _sum: { count: 3 },
          },
        ]),
      },
    };
    const prismaPort: ComputeTelemetryAggregatePrismaPort = {
      $transaction: async (fn) => fn(tx),
    };

    const handler = new ComputeTelemetryAggregateStatsHandler({
      prisma: prismaPort,
    });
    const result = await handler.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data["crf-studio"]).toEqual({ views: 10, clicks: 3 });
    }
  });

  it("returns AGGREGATE_FAILED when transaction rejects", async () => {
    const prismaPort: ComputeTelemetryAggregatePrismaPort = {
      $transaction: vi.fn().mockRejectedValue(new Error("DB deadlock")),
    };
    const handler = new ComputeTelemetryAggregateStatsHandler({
      prisma: prismaPort,
    });
    const result = await handler.execute();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("AGGREGATE_FAILED");
      expect(result.error.recoverable).toBe(true);
    }
  });
});
