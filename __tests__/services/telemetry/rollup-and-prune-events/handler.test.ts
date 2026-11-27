// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  RollupAndPruneTelemetryHandler,
  type RollupAndPrunePrismaPort,
} from "@/lib/services";

describe("RollupAndPruneTelemetryHandler (Logic Test)", () => {
  it("executes rollup upsert and raw prune within a transaction", async () => {
    const executeRaw = vi
      .fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(18);
    const prismaPort: RollupAndPrunePrismaPort = {
      $transaction: async (fn) => fn({ $executeRaw: executeRaw }),
    };

    const handler = new RollupAndPruneTelemetryHandler({ prisma: prismaPort });
    const result = await handler.execute({
      before: new Date("2026-01-15T00:00:00Z"),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        rollupsUpserted: 3,
        rawEventsDeleted: 18,
      });
    }
  });

  it("returns RETENTION_FAILED on invalid date or transaction failure", async () => {
    const handler = new RollupAndPruneTelemetryHandler({
      prisma: {
        $transaction: vi.fn().mockRejectedValue(new Error("SQL timeout")),
      },
    });

    const invalid = await handler.execute(fromAny({ before: "bad" }));
    expect(invalid.success).toBe(false);

    const failed = await handler.execute({ before: new Date() });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error.code).toBe("RETENTION_FAILED");
    }
  });
});
