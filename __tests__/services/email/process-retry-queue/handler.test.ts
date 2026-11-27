// @vitest-environment node
import crypto from "crypto";
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  MAX_RETRY_ATTEMPTS,
  ProcessRetryQueueHandler,
  createFailure,
  createSuccess,
  getResendClient,
  getRetryDelayMs,
  isRetryableEmailError,
  parseQueuedHeaders,
  parseQueuedTags,
  resetResendClient,
  shouldSimulateEmailDelivery,
  verifySvixSignature,
  type LeasedQueueRow,
  type ProcessRetryQueuePrismaPort,
  type ResendTransportPort,
} from "@/lib/services";

function makeRow(overrides: Partial<LeasedQueueRow> = {}): LeasedQueueRow {
  return {
    id: "q-1",
    to: "reader@example.com",
    from: "noreply@deruiter.dev",
    replyTo: null,
    subject: "Hello",
    html: "<p>Hello</p>",
    text: "Hello",
    tags: JSON.stringify([{ name: "category", value: "newsletter" }]),
    headers: { "X-Custom": "1" },
    attempts: 1,
    status: "RETRYING",
    nextRetryAt: new Date("2026-03-01T00:00:00Z"),
    lastError: null,
    dueAt: new Date("2026-03-01T00:00:00Z"),
    ...overrides,
  };
}

describe("ProcessRetryQueueHandler & Email Shared Helpers (Logic Test)", () => {
  it("delivers leased queue rows in simulated mode and tracks targeted entryState", async () => {
    const row = makeRow();
    const db = fromPartial<ProcessRetryQueuePrismaPort>({
      $queryRaw: vi.fn().mockResolvedValue([row]),
      outboundEmailQueue: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn(),
      },
    });
    const handler = new ProcessRetryQueueHandler({
      prisma: db,
      eligibilityHandler: {
        execute: vi
          .fn()
          .mockResolvedValue(createSuccess({ status: "eligible" })),
      },
      getApiKey: () => undefined,
    });

    const result = await handler.execute({ queueId: "q-1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.succeeded).toBe(1);
      expect(result.data.entryState?.status).toBe("DELIVERED");
    }
  });

  it("handles real Resend client delivery, provider errors, and thrown exceptions across retry thresholds", async () => {
    const rows: LeasedQueueRow[] = [
      makeRow({ id: "q-ok", to: "a@example.com, b@example.com" }),
      makeRow({ id: "q-err-retry", attempts: 1 }),
      makeRow({ id: "q-err-final", attempts: MAX_RETRY_ATTEMPTS - 1 }),
      makeRow({ id: "q-throw-retry", attempts: 1 }),
      makeRow({ id: "q-throw-final", attempts: MAX_RETRY_ATTEMPTS - 1 }),
      makeRow({ id: "q-suppressed", attempts: 0 }),
      makeRow({ id: "q-unknown", attempts: 0 }),
    ];

    const send = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "msg-1" }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "429 Too Many Requests" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "503 Service Unavailable" },
      })
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockRejectedValueOnce("non-error throw");

    const eligibilityExecute = vi
      .fn()
      .mockResolvedValueOnce(createSuccess({ status: "eligible" }))
      .mockResolvedValueOnce(createSuccess({ status: "eligible" }))
      .mockResolvedValueOnce(createSuccess({ status: "eligible" }))
      .mockResolvedValueOnce(createSuccess({ status: "eligible" }))
      .mockResolvedValueOnce(createSuccess({ status: "eligible" }))
      .mockResolvedValueOnce(
        createSuccess({ status: "suppressed", reason: "BOUNCE" })
      )
      .mockResolvedValueOnce(createFailure("INVALID_INPUT", "lookup failed"));

    const update = vi.fn().mockResolvedValue({});
    const db = fromPartial<ProcessRetryQueuePrismaPort>({
      $queryRaw: vi.fn().mockResolvedValue(rows),
      outboundEmailQueue: { update, findUnique: vi.fn() },
    });

    const client = fromPartial<ResendTransportPort>({
      emails: { send },
    });

    const handler = new ProcessRetryQueueHandler({
      prisma: db,
      eligibilityHandler: { execute: eligibilityExecute },
      getApiKey: () => "re_test_live_123",
      getClient: () => client,
    });

    const result = await handler.execute({ queueId: "q-err-final" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.processed).toBe(7);
      expect(result.data.succeeded).toBe(1);
      expect(result.data.failed).toBe(5);
      expect(result.data.deferred).toBe(1);
      expect(result.data.entryState).toEqual({
        status: "FAILED",
        attempts: MAX_RETRY_ATTEMPTS,
      });
    }
    expect(update).toHaveBeenCalledTimes(7);
  });

  it("returns TRANSPORT_UNCONFIGURED when live transport has no client", async () => {
    const db = fromPartial<ProcessRetryQueuePrismaPort>({
      $queryRaw: vi.fn().mockResolvedValue([makeRow()]),
    });
    const handler = new ProcessRetryQueueHandler({
      prisma: db,
      getApiKey: () => "re_test_live_123",
      getClient: () => null,
    });

    const result = await handler.execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TRANSPORT_UNCONFIGURED");
    }
  });

  it("inspects findUnique when targetedQueueId was not leased, and surfaces QUEUE_STATE_READ_FAILED on error", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ status: "RETRYING", attempts: 2 })
      .mockRejectedValueOnce(new Error("read failed"));

    const db = fromPartial<ProcessRetryQueuePrismaPort>({
      $queryRaw: vi.fn().mockResolvedValue([]),
      outboundEmailQueue: { update: vi.fn(), findUnique },
    });

    const handler = new ProcessRetryQueueHandler({
      prisma: db,
      getApiKey: () => undefined,
    });

    const ok = await handler.execute({ queueId: "q-unleased" });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.entryState).toEqual({ status: "RETRYING", attempts: 2 });
    }

    const fail = await handler.execute({ queueId: "q-unleased" });
    expect(fail.success).toBe(false);
    if (!fail.success) {
      expect(fail.error.code).toBe("QUEUE_STATE_READ_FAILED");
    }
  });

  it("returns QUEUE_UPDATE_FAILED when updating a leased row throws", async () => {
    const db = fromPartial<ProcessRetryQueuePrismaPort>({
      $queryRaw: vi.fn().mockResolvedValue([makeRow()]),
      outboundEmailQueue: {
        update: vi.fn().mockRejectedValue(new Error("write failed")),
        findUnique: vi.fn(),
      },
    });
    const handler = new ProcessRetryQueueHandler({
      prisma: db,
      eligibilityHandler: {
        execute: vi
          .fn()
          .mockResolvedValue(createSuccess({ status: "eligible" })),
      },
      getApiKey: () => undefined,
    });

    const result = await handler.execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("QUEUE_UPDATE_FAILED");
    }
  });

  it("returns QUEUE_LEASE_FAILED when leasing query throws", async () => {
    const db = fromPartial<ProcessRetryQueuePrismaPort>({
      $queryRaw: vi.fn().mockRejectedValue(new Error("DB lock timeout")),
    });
    const handler = new ProcessRetryQueueHandler({ prisma: db });
    const result = await handler.execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("QUEUE_LEASE_FAILED");
    }
  });

  it("validates shared email helpers (Svix signatures, tags, headers, retry classification, backoff)", () => {
    expect(parseQueuedTags('[{"name":"env","value":"prod"}]')).toEqual([
      { name: "env", value: "prod" },
    ]);
    expect(parseQueuedTags("{bad-json")).toBeUndefined();
    expect(parseQueuedTags("not-an-array")).toBeUndefined();
    expect(parseQueuedTags([{ bad: 1 }])).toBeUndefined();

    expect(parseQueuedHeaders({ "X-Id": "abc", ignored: 123 })).toEqual({
      "X-Id": "abc",
    });
    expect(parseQueuedHeaders({ ignored: 123 })).toBeUndefined();
    expect(parseQueuedHeaders(null)).toBeUndefined();
    expect(parseQueuedHeaders(["array"])).toBeUndefined();

    expect(isRetryableEmailError("429 Too Many Requests")).toBe(true);
    expect(isRetryableEmailError("fetch failed: ECONNRESET")).toBe(true);
    expect(isRetryableEmailError("504 Gateway Timeout")).toBe(true);
    expect(isRetryableEmailError("400 Invalid From Address")).toBe(false);

    const delay = getRetryDelayMs("queue-1", 2);
    expect(delay).toBeGreaterThan(0);

    expect(shouldSimulateEmailDelivery(undefined)).toBe(true);
    expect(shouldSimulateEmailDelivery("re_test_abc")).toBe(false);

    resetResendClient();
    expect(getResendClient()).toBeNull();

    const rawSecret = Buffer.from("super-secret-webhook-key").toString(
      "base64"
    );
    const secret = `whsec_${rawSecret}`;
    const payload = JSON.stringify({ type: "email.bounced" });
    const svixId = "msg_123";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const expectedSig = crypto
      .createHmac("sha256", Buffer.from(rawSecret, "base64"))
      .update(`${svixId}.${svixTimestamp}.${payload}`)
      .digest("base64");

    expect(
      verifySvixSignature({
        payload,
        svixId,
        svixTimestamp,
        svixSignature: `v0,ignored v1,${expectedSig}`,
        secret,
      })
    ).toBe(true);

    expect(
      verifySvixSignature({
        payload,
        svixId: null,
        svixTimestamp,
        svixSignature: `v1,${expectedSig}`,
        secret,
      })
    ).toBe(false);

    expect(
      verifySvixSignature({
        payload,
        svixId,
        svixTimestamp,
        svixSignature: `v1,${expectedSig}`,
        secret: "   ",
      })
    ).toBe(false);

    expect(
      verifySvixSignature({
        payload,
        svixId,
        svixTimestamp: "100",
        svixSignature: `v1,${expectedSig}`,
        secret,
      })
    ).toBe(false);

    expect(
      verifySvixSignature({
        payload,
        svixId,
        svixTimestamp,
        svixSignature: "v1,invalidsig",
        secret: rawSecret,
      })
    ).toBe(false);
  });
});
