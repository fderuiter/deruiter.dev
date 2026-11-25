// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  RollupAndPruneTelemetryEventsHandler,
  type TelemetryRetentionDbLike,
  type TelemetryRetentionTxLike,
} from "@/lib/services";

describe("RollupAndPruneTelemetryEventsHandler (Logic Test)", () => {
  it("rolls up daily counts and deletes pruned events atomically", async () => {
    let callIdx = 0;
    const tx = fromPartial<TelemetryRetentionTxLike>({
      $executeRaw: async () => {
        callIdx += 1;
        return callIdx === 1 ? 3 : 15;
      },
    });
    const db = fromPartial<TelemetryRetentionDbLike>({
      $transaction: async <T>(
        fn: (tx: TelemetryRetentionTxLike) => Promise<T>
      ) => fn(tx),
    });

    const handler = new RollupAndPruneTelemetryEventsHandler({ db });
    const result = await handler.execute({
      before: new Date("2026-10-01T00:00:00Z"),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ rollupsUpserted: 3, rawEventsDeleted: 15 });
    }
  });

  it("returns RETENTION_FAILED when retention transaction throws", async () => {
    const db = fromPartial<TelemetryRetentionDbLike>({
      $transaction: async () => {
        throw new Error("Lock timeout");
      },
    });
    const handler = new RollupAndPruneTelemetryEventsHandler({ db });
    const result = await handler.execute({
      before: new Date("2026-10-01T00:00:00Z"),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RETENTION_FAILED");
    }
  });
});
