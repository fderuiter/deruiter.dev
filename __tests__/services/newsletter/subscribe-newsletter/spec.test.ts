// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  SubscribeNewsletterErrorCode,
  SubscribeNewsletterInputSchema,
} from "@/lib/services";

describe("SubscribeNewsletterInputSchema (Contract Test)", () => {
  it("accepts valid email address", () => {
    const parsed = SubscribeNewsletterInputSchema.safeParse({
      email: "reader@example.com",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects malformed email address", () => {
    const parsed = SubscribeNewsletterInputSchema.safeParse({
      email: "not-an-email",
    });
    expect(parsed.success).toBe(false);
    expect(SubscribeNewsletterErrorCode.options).toContain(
      "INVALID_NEWSLETTER_INPUT"
    );
  });
});
