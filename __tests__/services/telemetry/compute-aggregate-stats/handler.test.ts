// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  ComputeTelemetryAggregateStatsHandler,
  type ComputeTelemetryAggregateStatsDbLike,
  type TelemetryAggregateDbTransaction,
} from "@/lib/services";

describe("ComputeTelemetryAggregateStatsHandler (Logic Test)", () => {
  it("sums raw events and daily rollups in a single RepeatableRead transaction", async () => {
    const tx = fromPartial<TelemetryAggregateDbTransaction>({
      telemetryEvent: {
        groupBy: async () => [
          { projectSlug: "crf", eventType: "page_view", _count: { id: 3 } },
          { projectSlug: "crf", eventType: "project_click", _count: { id: 1 } },
        ],
      },
      telemetryDailyRollup: {
        groupBy: async () => [
          { projectSlug: "crf", eventType: "page_view", _sum: { count: 7 } },
        ],
      },
    });
    const db = fromPartial<ComputeTelemetryAggregateStatsDbLike>({
      $transaction: async <T>(
        fn: (tx: TelemetryAggregateDbTransaction) => Promise<T>
      ) => fn(tx),
    });

    const handler = new ComputeTelemetryAggregateStatsHandler({ db });
    const result = await handler.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.crf).toEqual({ views: 10, clicks: 1 });
    }
  });

  it("returns AGGREGATE_FAILED when transaction throws", async () => {
    const db = fromPartial<ComputeTelemetryAggregateStatsDbLike>({
      $transaction: async () => {
        throw new Error("Postgres connection timeout");
      },
    });

    const handler = new ComputeTelemetryAggregateStatsHandler({ db });
    const result = await handler.execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("AGGREGATE_FAILED");
    }
  });
});
