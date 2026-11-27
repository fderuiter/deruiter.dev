// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GetRetryQueueHealthHandler } from "@/lib/services";

describe("GetRetryQueueHealthHandler (Logic Test)", () => {
  it("computes queue depth and oldest pending age", async () => {
    const count = vi
      .fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    const findFirst = vi.fn().mockResolvedValue({
      createdAt: new Date("2026-03-01T00:00:00Z"),
    });

    const handler = new GetRetryQueueHealthHandler({
      prisma: { outboundEmailQueue: { count, findFirst } },
    });

    const result = await handler.execute({
      now: new Date("2026-03-01T00:01:00Z"),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.depth).toBe(3);
      expect(result.data.oldestPendingAgeMs).toBe(60_000);
      expect(result.data.terminalFailures).toBe(1);
    }
  });

  it("returns STORAGE_UNAVAILABLE when queue health query throws", async () => {
    const handler = new GetRetryQueueHealthHandler({
      prisma: {
        outboundEmailQueue: {
          count: vi.fn().mockRejectedValue(new Error("DB error")),
          findFirst: vi.fn(),
        },
      },
    });
    const result = await handler.execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
