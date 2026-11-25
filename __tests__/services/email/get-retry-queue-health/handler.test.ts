// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GetEmailRetryQueueHealthHandler,
  type GetEmailRetryQueueHealthDeps,
} from "@/lib/services";

describe("GetEmailRetryQueueHealthHandler (Logic Test)", () => {
  it("computes queue depth, oldestPendingAgeMs, and failure breakdowns", async () => {
    const now = new Date("2026-01-01T00:10:00.000Z");
    const createdAt = new Date("2026-01-01T00:05:00.000Z");
    let callIdx = 0;
    const counts = [4, 2, 1, 1];
    const deps = fromPartial<GetEmailRetryQueueHealthDeps>({
      db: {
        outboundEmailQueue: {
          count: async () => counts[callIdx++] ?? 0,
          findFirst: async () => ({ createdAt }),
        },
      },
    });

    const handler = new GetEmailRetryQueueHealthHandler(deps);
    const result = await handler.execute({ now });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.depth).toBe(4);
      expect(result.data.oldestPendingAgeMs).toBe(5 * 60 * 1000);
    }
  });

  it("returns STORAGE_UNAVAILABLE when database count throws", async () => {
    const deps = fromPartial<GetEmailRetryQueueHealthDeps>({
      db: {
        outboundEmailQueue: {
          count: async () => {
            throw new Error("DB offline");
          },
          findFirst: async () => null,
        },
      },
    });

    const handler = new GetEmailRetryQueueHealthHandler(deps);
    const result = await handler.execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
