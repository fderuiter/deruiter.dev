// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SubscribeNewsletterInputSchema } from "@/lib/services";

describe("SubscribeNewsletterInputSchema (Contract Test)", () => {
  it("accepts valid email addresses", () => {
    expect(
      SubscribeNewsletterInputSchema.safeParse({ email: "reader@example.com" })
        .success
    ).toBe(true);
  });

  it("rejects malformed email addresses", () => {
    expect(
      SubscribeNewsletterInputSchema.safeParse({ email: "not-an-email" })
        .success
    ).toBe(false);
  });
});
