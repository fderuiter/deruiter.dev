// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  HandleEmailWebhookEventHandler,
  type HandleEmailWebhookEventDeps,
} from "@/lib/services";

describe("HandleEmailWebhookEventHandler (Logic Test)", () => {
  it("records BOUNCE suppression for email.bounced webhook events", async () => {
    const recordExecute = vi.fn(async () => ({
      success: true as const,
      data: { email: "bounced@example.com", reason: "BOUNCE" as const },
    }));
    const deps = fromPartial<HandleEmailWebhookEventDeps>({
      recordSuppressionHandler: { execute: recordExecute },
    });

    const handler = new HandleEmailWebhookEventHandler(deps);
    const result = await handler.execute({
      event: {
        type: "email.bounced",
        created_at: "2026-01-01T00:00:00Z",
        data: {
          email_id: "em-1",
          from: "noreply@deruiter.dev",
          to: ["bounced@example.com"],
          subject: "Hello",
        },
      },
    });

    expect(result).toEqual({
      success: true,
      data: { suppressed: true, reason: "BOUNCE" },
    });
    expect(recordExecute).toHaveBeenCalledWith({
      email: "bounced@example.com",
      reason: "BOUNCE",
    });
  });

  it("propagates STORAGE_UNAVAILABLE when suppression write fails", async () => {
    const deps = fromPartial<HandleEmailWebhookEventDeps>({
      recordSuppressionHandler: {
        execute: async () => ({
          success: false,
          error: {
            code: "STORAGE_UNAVAILABLE",
            message: "DB offline",
            recoverable: true,
          },
        }),
      },
    });

    const handler = new HandleEmailWebhookEventHandler(deps);
    const result = await handler.execute({
      event: {
        type: "email.complained",
        created_at: "2026-01-01T00:00:00Z",
        data: {
          email_id: "em-2",
          from: "noreply@deruiter.dev",
          to: ["complained@example.com"],
          subject: "Hello",
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
