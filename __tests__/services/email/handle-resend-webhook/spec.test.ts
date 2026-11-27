// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  HandleResendWebhookErrorCode,
  HandleResendWebhookInputSchema,
} from "@/lib/services";

describe("HandleResendWebhookInputSchema (Contract Test)", () => {
  it("accepts valid Resend bounce webhook event", () => {
    const parsed = HandleResendWebhookInputSchema.safeParse({
      event: {
        type: "email.bounced",
        data: { to: ["bounced@example.com"] },
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unsupported Resend event type", () => {
    const parsed = HandleResendWebhookInputSchema.safeParse({
      event: {
        type: fromAny("email.unknown"),
        data: {},
      },
    });
    expect(parsed.success).toBe(false);
    expect(HandleResendWebhookErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
