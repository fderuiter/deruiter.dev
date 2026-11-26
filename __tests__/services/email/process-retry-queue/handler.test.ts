// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  ProcessRetryQueueHandler,
  type LeasedQueueRow,
  type ProcessRetryQueueDeps,
} from "@/lib/services";

describe("ProcessRetryQueueHandler (Logic Test)", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  function makeRow(overrides: Partial<LeasedQueueRow> = {}): LeasedQueueRow {
    return fromPartial<LeasedQueueRow>({
      id: "q-1",
      to: "reader@example.com, second@example.com",
      from: "noreply@deruiter.dev",
      replyTo: "reply@deruiter.dev",
      subject: "Queued Email",
      html: "<p>Hello</p>",
      text: "Hello",
      tags: JSON.stringify([{ name: "category", value: "test" }]),
      headers: JSON.stringify({ "X-Test": "1" }),
      attempts: 0,
      status: "PENDING",
      nextRetryAt: now,
      lastError: null,
      dueAt: now,
      ...overrides,
    });
  }

  it("returns INVALID_INPUT for invalid input payload", async () => {
    const handler = new ProcessRetryQueueHandler();
    const result = await handler.execute(fromAny("invalid"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("returns QUEUE_LEASE_FAILED when leasing due rows throws", async () => {
    const deps = fromPartial<ProcessRetryQueueDeps>({
      leaseRows: async () => {
        throw new Error("Lease SQL failed");
      },
    });
    const handler = new ProcessRetryQueueHandler(deps);
    const result = await handler.execute({ now });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("QUEUE_LEASE_FAILED");
    }
  });

  it("returns TRANSPORT_UNCONFIGURED when client is null and simulation is disabled", async () => {
    const deps = fromPartial<ProcessRetryQueueDeps>({
      leaseRows: async () => [makeRow({ attempts: 2 })],
      getApiKey: () => undefined,
      shouldSimulate: () => false,
      getClient: () => null,
    });
    const handler = new ProcessRetryQueueHandler(deps);
    const result = await handler.execute({ queueId: "q-1", now });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TRANSPORT_UNCONFIGURED");
    }
  });

  it("sends leased row in simulated mode and returns merged post-retry entryState", async () => {
    const row = makeRow();
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
          findUnique: async () => ({ status: "DELIVERED", attempts: 0 }),
        },
      },
    });

    const handler = new ProcessRetryQueueHandler(deps);
    const result = await handler.execute({ queueId: "q-1", now });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.processed).toBe(1);
      expect(result.data.succeeded).toBe(1);
      expect(result.data.entryState).toEqual({
        status: "DELIVERED",
        attempts: 0,
      });
    }
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("defers unknown eligibility and marks suppressed recipients FAILED", async () => {
    const update = vi.fn(async () => ({}));
    const rowUnknown = makeRow({ id: "q-unknown", to: "unknown@example.com" });
    const rowSuppressed = makeRow({
      id: "q-suppressed",
      to: "bounced@example.com",
    });
    const deps = fromPartial<ProcessRetryQueueDeps>({
      leaseRows: async () => [rowUnknown, rowSuppressed],
      checkEligibilityHandler: {
        execute: async ({ email }: { email: string }) => {
          if (email === "unknown@example.com") {
            return {
              success: false,
              error: {
                code: "SUPPRESSION_LOOKUP_FAILED",
                message: "DB down",
                recoverable: true,
              },
            };
          }
          return {
            success: true,
            data: { status: "suppressed", reason: "BOUNCE" },
          };
        },
      },
      getApiKey: () => undefined,
      shouldSimulate: () => true,
      db: {
        outboundEmailQueue: {
          update,
          findUnique: async () => null,
        },
      },
    });

    const handler = new ProcessRetryQueueHandler(deps);
    const result = await handler.execute({ now });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deferred).toBe(1);
      expect(result.data.failed).toBe(1);
    }
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("handles Resend provider delivery, retryable API errors, max-attempt exhaustion, and thrown exceptions", async () => {
    const update = vi.fn(async () => ({}));
    const rows = [
      makeRow({ id: "q-ok", to: "ok@example.com", attempts: 0 }),
      makeRow({ id: "q-err-retry", to: "err1@example.com", attempts: 0 }),
      makeRow({ id: "q-err-max", to: "err2@example.com", attempts: 9 }),
      makeRow({ id: "q-throw-retry", to: "throw1@example.com", attempts: 0 }),
      makeRow({ id: "q-throw-max", to: "throw2@example.com", attempts: 9 }),
    ];

    const send = vi.fn(async (payload: { to: string | string[] }) => {
      const to = Array.isArray(payload.to) ? payload.to[0] : payload.to;
      if (to === "ok@example.com") {
        return { data: { id: "msg-ok" }, error: null };
      }
      if (to === "err1@example.com" || to === "err2@example.com") {
        return {
          data: null,
          error: { message: "Temporary provider failure", name: "api_error" },
        };
      }
      throw new Error("Socket hang up");
    });

    const deps = fromPartial<ProcessRetryQueueDeps>({
      leaseRows: async () => rows,
      checkEligibilityHandler: {
        execute: async () => ({ success: true, data: { status: "eligible" } }),
      },
      getApiKey: () => "re_live_key",
      shouldSimulate: () => false,
      getClient: () => ({ emails: { send } }),
      db: {
        outboundEmailQueue: {
          update,
          findUnique: async () => null,
        },
      },
    });

    const handler = new ProcessRetryQueueHandler(deps);
    const result = await handler.execute({ now });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.succeeded).toBe(1);
      expect(result.data.failed).toBe(4);
    }
    expect(update).toHaveBeenCalledTimes(5);
  });

  it("returns QUEUE_UPDATE_FAILED when updating queue row rejects", async () => {
    const deps = fromPartial<ProcessRetryQueueDeps>({
      leaseRows: async () => [makeRow()],
      checkEligibilityHandler: {
        execute: async () => ({ success: true, data: { status: "eligible" } }),
      },
      getApiKey: () => undefined,
      shouldSimulate: () => true,
      db: {
        outboundEmailQueue: {
          update: async () => {
            throw new Error("Update failed");
          },
          findUnique: async () => null,
        },
      },
    });

    const handler = new ProcessRetryQueueHandler(deps);
    const result = await handler.execute({ queueId: "q-1", now });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("QUEUE_UPDATE_FAILED");
    }
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
