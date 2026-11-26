// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { SendRawEmailHandler, type SendRawEmailDeps } from "@/lib/services";

describe("SendRawEmailHandler (Logic Test)", () => {
  it("returns INVALID_INPUT when required fields are blank", async () => {
    const handler = new SendRawEmailHandler();
    const result = await handler.execute({
      to: "",
      subject: "",
      html: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("defers message to outbound queue when recipient eligibility is unknown", async () => {
    const queueExecute = vi.fn(async () => ({
      success: true as const,
      data: { queueId: "deferred-1" },
    }));
    const deps = fromPartial<SendRawEmailDeps>({
      checkEligibilityHandler: {
        execute: async () => ({
          success: true,
          data: { status: "unknown", code: "SUPPRESSION_LOOKUP_FAILED" },
        }),
      },
      queueOutboundEmailHandler: { execute: queueExecute },
      getClient: () => null,
      getApiKey: () => undefined,
      shouldSimulate: () => true,
    });

    const handler = new SendRawEmailHandler(deps);
    const result = await handler.execute({
      to: "reader@example.com",
      subject: "Deferred",
      html: "<p>Hello</p>",
    });

    expect(result).toEqual({
      success: true,
      data: {
        id: "deferred-1",
        queued: true,
        deferred: true,
        queueId: "deferred-1",
      },
    });
    expect(queueExecute).toHaveBeenCalledTimes(1);
  });

  it("returns RECIPIENT_ELIGIBILITY_UNKNOWN when lookup fails and skipQueue is true", async () => {
    const deps = fromPartial<SendRawEmailDeps>({
      checkEligibilityHandler: {
        execute: async () => ({
          success: false,
          error: {
            code: "SUPPRESSION_LOOKUP_FAILED",
            message: "DB offline",
            recoverable: true,
          },
        }),
      },
    });

    const handler = new SendRawEmailHandler(deps);
    const result = await handler.execute({
      to: ["reader@example.com"],
      subject: "Skip Queue",
      html: "<p>Hello</p>",
      skipQueue: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RECIPIENT_ELIGIBILITY_UNKNOWN");
    }
  });

  it("blocks suppressed recipients with RECIPIENT_SUPPRESSED", async () => {
    const deps = fromPartial<SendRawEmailDeps>({
      checkEligibilityHandler: {
        execute: async () => ({
          success: true,
          data: { status: "suppressed", reason: "BOUNCE" },
        }),
      },
      getClient: () => null,
    });

    const handler = new SendRawEmailHandler(deps);
    const result = await handler.execute({
      to: "bounced@example.com",
      subject: "Blocked",
      html: "<p>Blocked</p>",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RECIPIENT_SUPPRESSED");
    }
  });

  it("returns simulated delivery receipt when simulation is enabled", async () => {
    const deps = fromPartial<SendRawEmailDeps>({
      checkEligibilityHandler: {
        execute: async () => ({ success: true, data: { status: "eligible" } }),
      },
      shouldSimulate: () => true,
      idGenerator: () => "sim_msg_test",
    });

    const handler = new SendRawEmailHandler(deps);
    const result = await handler.execute({
      to: "reader@example.com",
      subject: "Simulated",
      html: "<p>Simulated</p>",
    });
    expect(result).toEqual({
      success: true,
      data: { id: "sim_msg_test", simulated: true },
    });
  });

  it("returns TRANSPORT_UNCONFIGURED when client is null in non-simulated mode", async () => {
    const queueExecute = vi.fn(async () => ({
      success: true as const,
      data: { queueId: "q-unconf" },
    }));
    const deps = fromPartial<SendRawEmailDeps>({
      checkEligibilityHandler: {
        execute: async () => ({ success: true, data: { status: "eligible" } }),
      },
      queueOutboundEmailHandler: { execute: queueExecute },
      shouldSimulate: () => false,
      getClient: () => null,
    });

    const handler = new SendRawEmailHandler(deps);
    const queued = await handler.execute({
      to: "reader@example.com",
      subject: "Unconfigured",
      html: "<p>Test</p>",
    });
    expect(queued.success).toBe(false);
    if (!queued.success) {
      expect(queued.error.code).toBe("TRANSPORT_UNCONFIGURED");
    }

    const skipped = await handler.execute({
      to: "reader@example.com",
      subject: "Unconfigured",
      html: "<p>Test</p>",
      skipQueue: true,
    });
    expect(skipped.success).toBe(false);
    if (!skipped.success) {
      expect(skipped.error.code).toBe("TRANSPORT_UNCONFIGURED");
    }
  });

  it("delivers via Resend client and queues retryable API or network failures", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "msg_live_1" }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "429 rate limit exceeded", name: "rate_limit" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Invalid sender domain", name: "validation_error" },
      })
      .mockRejectedValueOnce(new Error("429 rate limit exceeded"))
      .mockRejectedValueOnce(new Error("Permanent malformed payload"));

    const queueExecute = vi
      .fn()
      .mockResolvedValueOnce({
        success: true as const,
        data: { queueId: "q-retry-api" },
      })
      .mockResolvedValueOnce({
        success: false as const,
        error: {
          code: "QUEUE_WRITE_FAILED" as const,
          message: "Queue down",
          recoverable: true,
        },
      });

    const deps = fromPartial<SendRawEmailDeps>({
      checkEligibilityHandler: {
        execute: async () => ({ success: true, data: { status: "eligible" } }),
      },
      queueOutboundEmailHandler: { execute: queueExecute },
      shouldSimulate: () => false,
      getApiKey: () => "re_live",
      getClient: () => ({ emails: { send } }),
    });

    const handler = new SendRawEmailHandler(deps);

    const delivered = await handler.execute({
      to: "reader@example.com",
      subject: "Live",
      html: "<p>Live</p>",
    });
    expect(delivered).toEqual({ success: true, data: { id: "msg_live_1" } });

    const queuedApiErr = await handler.execute({
      to: "reader@example.com",
      subject: "Retryable API",
      html: "<p>Retry</p>",
    });
    expect(queuedApiErr).toEqual({
      success: true,
      data: { id: "q-retry-api", queued: true, queueId: "q-retry-api" },
    });

    const permanentApiErr = await handler.execute({
      to: "reader@example.com",
      subject: "Invalid Domain",
      html: "<p>Invalid</p>",
    });
    expect(permanentApiErr.success).toBe(false);
    if (!permanentApiErr.success) {
      expect(permanentApiErr.error.code).toBe("DELIVERY_FAILED");
    }

    const unqueuedNetworkErr = await handler.execute({
      to: "reader@example.com",
      subject: "Timeout",
      html: "<p>Timeout</p>",
    });
    expect(unqueuedNetworkErr.success).toBe(false);
    if (!unqueuedNetworkErr.success) {
      expect(unqueuedNetworkErr.error.code).toBe("STORAGE_UNAVAILABLE");
    }

    const permanentThrownErr = await handler.execute({
      to: "reader@example.com",
      subject: "Bad Payload",
      html: "<p>Bad</p>",
    });
    expect(permanentThrownErr.success).toBe(false);
    if (!permanentThrownErr.success) {
      expect(permanentThrownErr.error.code).toBe("DELIVERY_FAILED");
    }
  });
});
