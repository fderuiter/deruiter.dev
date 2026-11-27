// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  HandleResendWebhookHandler,
  createFailure,
  createSuccess,
} from "@/lib/services";

describe("HandleResendWebhookHandler (Logic Test)", () => {
  it("records BOUNCE suppression for email.bounced events", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue(
        createSuccess({ email: "bounced@example.com", reason: "BOUNCE" })
      );
    const handler = new HandleResendWebhookHandler({
      recordSuppressionHandler: { execute },
    });

    const result = await handler.execute({
      event: {
        type: "email.bounced",
        data: { to: ["bounced@example.com"] },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ suppressed: true, reason: "BOUNCE" });
    }
    expect(execute).toHaveBeenCalledWith({
      email: "bounced@example.com",
      reason: "BOUNCE",
    });
  });

  it("returns STORAGE_UNAVAILABLE when suppression recording fails", async () => {
    const handler = new HandleResendWebhookHandler({
      recordSuppressionHandler: {
        execute: vi
          .fn()
          .mockResolvedValue(createFailure("STORAGE_UNAVAILABLE", "DB error")),
      },
    });

    const result = await handler.execute({
      event: {
        type: "email.complained",
        data: { to: ["spam@example.com"] },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
