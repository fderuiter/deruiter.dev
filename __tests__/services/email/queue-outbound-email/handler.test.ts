// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  QueueOutboundEmailHandler,
  type QueueOutboundEmailDeps,
} from "@/lib/services";

describe("QueueOutboundEmailHandler (Logic Test)", () => {
  it("persists queue entry and schedules QStash retry", async () => {
    const scheduleRetry = vi.fn(async () => true);
    const deps = fromPartial<QueueOutboundEmailDeps>({
      scheduleRetry,
      db: {
        outboundEmailQueue: {
          create: async () => ({ id: "q-99" }),
        },
      },
    });

    const handler = new QueueOutboundEmailHandler(deps);
    const result = await handler.execute({
      options: {
        to: "user@example.com",
        subject: "Retry me",
        html: "<p>Body</p>",
      },
      errorReason: "Rate limit",
    });

    expect(result).toEqual({ success: true, data: { queueId: "q-99" } });
    expect(scheduleRetry).toHaveBeenCalledWith("q-99", 1);
  });

  it("returns STORAGE_UNAVAILABLE when queue table write fails", async () => {
    const deps = fromPartial<QueueOutboundEmailDeps>({
      db: {
        outboundEmailQueue: {
          create: async () => {
            throw new Error("DB error");
          },
        },
      },
    });

    const handler = new QueueOutboundEmailHandler(deps);
    const result = await handler.execute({
      options: {
        to: "user@example.com",
        subject: "Retry me",
        html: "<p>Body</p>",
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
