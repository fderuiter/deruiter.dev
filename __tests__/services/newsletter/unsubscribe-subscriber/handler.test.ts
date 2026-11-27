// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  UnsubscribeSubscriberHandler,
  type UnsubscribeDeliveryPort,
  type UnsubscribeQueuePort,
  type UnsubscribeSubscriberPort,
} from "@/lib/services";

describe("UnsubscribeSubscriberHandler (Logic Test)", () => {
  it("marks subscriber unsubscribed and cancels pending queued deliveries", async () => {
    const subscribers = fromPartial<UnsubscribeSubscriberPort>({
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: "sub-1", status: "CONFIRMED" }),
      update: vi.fn().mockResolvedValue({}),
    });
    const deliveries = fromPartial<UnsubscribeDeliveryPort>({
      findMany: vi.fn().mockResolvedValue([{ queueId: "q-1" }]),
    });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const queue = fromPartial<UnsubscribeQueuePort>({ updateMany });

    const handler = new UnsubscribeSubscriberHandler({
      subscribers,
      deliveries,
      queue,
    });
    const result = await handler.execute({ token: "unsubscribe-token-12345" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outcome).toBe("unsubscribed");
    }
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it("returns INVALID_TOKEN or STORAGE_UNAVAILABLE without throwing", async () => {
    const missingHandler = new UnsubscribeSubscriberHandler({
      subscribers: fromPartial<UnsubscribeSubscriberPort>({
        findUnique: vi.fn().mockResolvedValue(null),
      }),
    });
    const missing = await missingHandler.execute({
      token: "unknown-token-12345",
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.code).toBe("INVALID_TOKEN");
    }

    const dbFailHandler = new UnsubscribeSubscriberHandler({
      subscribers: fromPartial<UnsubscribeSubscriberPort>({
        findUnique: vi.fn().mockRejectedValue(new Error("DB offline")),
      }),
    });
    const dbFail = await dbFailHandler.execute({
      token: "unsubscribe-token-12345",
    });
    expect(dbFail.success).toBe(false);
    if (!dbFail.success) {
      expect(dbFail.error.code).toBe("STORAGE_UNAVAILABLE");
      expect(dbFail.error.recoverable).toBe(true);
    }
  });
});
