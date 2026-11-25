// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { SendRawEmailHandler, type SendRawEmailDeps } from "@/lib/services";

describe("SendRawEmailHandler (Logic Test)", () => {
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
});
