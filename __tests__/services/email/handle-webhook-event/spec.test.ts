// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  HandleEmailWebhookEventErrorCode,
  HandleEmailWebhookEventInputSchema,
} from "@/lib/services";

describe("HandleEmailWebhookEvent Spec (Contract Test)", () => {
  it("accepts valid Resend bounce webhook event", () => {
    const parsed = HandleEmailWebhookEventInputSchema.safeParse({
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
    expect(parsed.success).toBe(true);
  });

  it("rejects malformed webhook event and defines STORAGE_UNAVAILABLE", () => {
    expect(
      HandleEmailWebhookEventInputSchema.safeParse(fromAny({ event: null }))
        .success
    ).toBe(false);
    expect(HandleEmailWebhookEventErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
