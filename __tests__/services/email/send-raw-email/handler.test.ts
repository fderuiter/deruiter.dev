// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  SendRawEmailHandler,
  createFailure,
  createSuccess,
  type ResendTransportPort,
} from "@/lib/services";

describe("SendRawEmailHandler (Logic Test)", () => {
  it("simulates delivery in non-configured test mode when recipient is eligible", async () => {
    const handler = new SendRawEmailHandler({
      eligibilityHandler: {
        execute: vi
          .fn()
          .mockResolvedValue(createSuccess({ status: "eligible" })),
      },
      enqueueHandler: {
        execute: vi.fn().mockResolvedValue(createSuccess({ queueId: "q-1" })),
      },
      getApiKey: () => undefined,
    });

    const result = await handler.execute({
      to: ["reader@example.com"],
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.simulated).toBe(true);
    }
  });

  it("returns INVALID_INPUT on schema failure or failed eligibility check", async () => {
    const handler = new SendRawEmailHandler({
      eligibilityHandler: {
        execute: vi
          .fn()
          .mockResolvedValue(createFailure("INVALID_INPUT", "bad email")),
      },
      enqueueHandler: { execute: vi.fn() },
    });

    const invalidPayload = await handler.execute({
      to: "not-an-email",
      subject: "",
      html: "",
    });
    expect(invalidPayload.success).toBe(false);
    if (!invalidPayload.success) {
      expect(invalidPayload.error.code).toBe("INVALID_INPUT");
    }

    const failedEligibility = await handler.execute({
      to: "reader@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
    });
    expect(failedEligibility.success).toBe(false);
    if (!failedEligibility.success) {
      expect(failedEligibility.error.code).toBe("INVALID_INPUT");
    }
  });

  it("returns RECIPIENT_SUPPRESSED when eligibility reports suppressed", async () => {
    const handler = new SendRawEmailHandler({
      eligibilityHandler: {
        execute: vi
          .fn()
          .mockResolvedValue(
            createSuccess({ status: "suppressed", reason: "BOUNCE" })
          ),
      },
      enqueueHandler: { execute: vi.fn() },
    });

    const result = await handler.execute({
      to: "bounced@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RECIPIENT_SUPPRESSED");
    }
  });

  it("queues deferred delivery when eligibility is unknown, or fails when skipQueue is true", async () => {
    const enqueueExecute = vi
      .fn()
      .mockResolvedValueOnce(createSuccess({ queueId: "q-deferred" }))
      .mockResolvedValueOnce(
        createFailure("STORAGE_UNAVAILABLE", "queue down")
      );

    const handler = new SendRawEmailHandler({
      eligibilityHandler: {
        execute: vi.fn().mockResolvedValue(
          createSuccess({
            status: "unknown",
            code: "SUPPRESSION_LOOKUP_FAILED",
          })
        ),
      },
      enqueueHandler: { execute: enqueueExecute },
    });

    const queued = await handler.execute({
      to: "reader@example.com",
      subject: "Deferred",
      html: "<p>Deferred</p>",
    });
    expect(queued.success).toBe(true);
    if (queued.success) {
      expect(queued.data.deferred).toBe(true);
      expect(queued.data.queued).toBe(true);
    }

    const unqueued = await handler.execute({
      to: "reader@example.com",
      subject: "Deferred",
      html: "<p>Deferred</p>",
    });
    expect(unqueued.success).toBe(false);
    if (!unqueued.success) {
      expect(unqueued.error.code).toBe("RECIPIENT_ELIGIBILITY_UNKNOWN");
    }

    const skipped = await handler.execute({
      to: "reader@example.com",
      subject: "Skip",
      html: "<p>Skip</p>",
      skipQueue: true,
    });
    expect(skipped.success).toBe(false);
    if (!skipped.success) {
      expect(skipped.error.code).toBe("RECIPIENT_ELIGIBILITY_UNKNOWN");
    }
  });

  it("handles TRANSPORT_UNCONFIGURED with and without retry queueing", async () => {
    const handler = new SendRawEmailHandler({
      eligibilityHandler: {
        execute: vi
          .fn()
          .mockResolvedValue(createSuccess({ status: "eligible" })),
      },
      enqueueHandler: {
        execute: vi
          .fn()
          .mockResolvedValue(createSuccess({ queueId: "q-unconf" })),
      },
      getApiKey: () => "re_test_live",
      getClient: () => null,
    });

    const queuedRes = await handler.execute({
      to: "reader@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
    });
    expect(queuedRes.success).toBe(false);
    if (!queuedRes.success) {
      expect(queuedRes.error.code).toBe("TRANSPORT_UNCONFIGURED");
    }

    const skipRes = await handler.execute({
      to: "reader@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      skipQueue: true,
    });
    expect(skipRes.success).toBe(false);
    if (!skipRes.success) {
      expect(skipRes.error.code).toBe("TRANSPORT_UNCONFIGURED");
    }
  });

  it("handles Resend live success, retryable API errors, non-retryable errors, and thrown exceptions", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "live-1" }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "429 rate_limit exceeded" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "429 rate_limit exceeded" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "400 Invalid domain" },
      })
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockRejectedValueOnce(new Error("400 Bad Request"));

    const enqueue = vi
      .fn()
      .mockResolvedValueOnce(createSuccess({ queueId: "q-retry-1" }))
      .mockResolvedValueOnce(
        createFailure("STORAGE_UNAVAILABLE", "db unavailable")
      )
      .mockResolvedValueOnce(createSuccess({ queueId: "q-retry-2" }))
      .mockResolvedValueOnce(
        createFailure("STORAGE_UNAVAILABLE", "db unavailable")
      );

    const client = fromPartial<ResendTransportPort>({ emails: { send } });
    const handler = new SendRawEmailHandler({
      eligibilityHandler: {
        execute: vi
          .fn()
          .mockResolvedValue(createSuccess({ status: "eligible" })),
      },
      enqueueHandler: { execute: enqueue },
      getApiKey: () => "re_test_live",
      getClient: () => client,
    });

    const payload = {
      to: "reader@example.com",
      subject: "Live",
      html: "<p>Live</p>",
    };

    const delivered = await handler.execute(payload);
    expect(delivered.success).toBe(true);
    if (delivered.success) {
      expect(delivered.data.id).toBe("live-1");
    }

    const retryQueued = await handler.execute(payload);
    expect(retryQueued.success).toBe(true);
    if (retryQueued.success) {
      expect(retryQueued.data.queued).toBe(true);
    }

    const retryQueueFailed = await handler.execute(payload);
    expect(retryQueueFailed.success).toBe(false);
    if (!retryQueueFailed.success) {
      expect(retryQueueFailed.error.code).toBe("STORAGE_UNAVAILABLE");
    }

    const rejected = await handler.execute(payload);
    expect(rejected.success).toBe(false);
    if (!rejected.success) {
      expect(rejected.error.code).toBe("PROVIDER_REJECTED");
    }

    const thrownQueued = await handler.execute(payload);
    expect(thrownQueued.success).toBe(true);
    if (thrownQueued.success) {
      expect(thrownQueued.data.queued).toBe(true);
    }

    const thrownQueueFailed = await handler.execute(payload);
    expect(thrownQueueFailed.success).toBe(false);
    if (!thrownQueueFailed.success) {
      expect(thrownQueueFailed.error.code).toBe("STORAGE_UNAVAILABLE");
    }

    const thrownRejected = await handler.execute(payload);
    expect(thrownRejected.success).toBe(false);
    if (!thrownRejected.success) {
      expect(thrownRejected.error.code).toBe("PROVIDER_REJECTED");
    }
  });
});
