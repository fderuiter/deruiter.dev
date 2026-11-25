// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  ProcessRetryQueueHandler,
  type LeasedQueueRow,
  type ProcessRetryQueueDeps,
} from "@/lib/services";

describe("ProcessRetryQueueHandler (Logic Test)", () => {
  it("sends leased row in simulated mode and returns merged post-retry entryState", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const row = fromPartial<LeasedQueueRow>({
      id: "q-1",
      to: "reader@example.com",
      from: "noreply@deruiter.dev",
      replyTo: null,
      subject: "Queued Email",
      html: "<p>Hello</p>",
      text: null,
      tags: null,
      attempts: 0,
      status: "PENDING",
      nextRetryAt: now,
      lastError: null,
      dueAt: now,
    });
    const update = vi.fn(async () => ({}));
    const deps = fromPartial<ProcessRetryQueueDeps>({
      leaseRows: async () => [row],
      checkEligibilityHandler: {
        execute: async () => ({ success: true, data: { status: "eligible" } }),
      },
      getApiKey: () => undefined,
      shouldSimulate: () => true,
      db: {
        outboundEmailQueue: {
          update,
          findUnique: async () => ({ status: "SENT", attempts: 0 }),
        },
      },
    });

    const handler = new ProcessRetryQueueHandler(deps);
    const result = await handler.execute({ queueId: "q-1", now });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.processed).toBe(1);
      expect(result.data.succeeded).toBe(1);
      expect(result.data.entryState).toEqual({ status: "SENT", attempts: 0 });
    }
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("returns QUEUE_STATE_READ_FAILED when post-retry findUnique rejects for queueId", async () => {
    const deps = fromPartial<ProcessRetryQueueDeps>({
      leaseRows: async () => [],
      getApiKey: () => undefined,
      shouldSimulate: () => true,
      db: {
        outboundEmailQueue: {
          update: async () => ({}),
          findUnique: async () => {
            throw new Error("DB state read failed");
          },
        },
      },
    });

    const handler = new ProcessRetryQueueHandler(deps);
    const result = await handler.execute({ queueId: "q-outage" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("QUEUE_STATE_READ_FAILED");
    }
  });
});
