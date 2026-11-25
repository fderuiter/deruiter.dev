// @vitest-environment node
import { describe, expect, it } from "vitest";
import { UnsubscribeSubscriberInputSchema } from "@/lib/services";

describe("UnsubscribeSubscriberInputSchema (Contract Test)", () => {
  it("accepts non-empty unsubscribe token", () => {
    expect(
      UnsubscribeSubscriberInputSchema.safeParse({ token: "unsub_123" }).success
    ).toBe(true);
  });

  it("rejects empty unsubscribe token", () => {
    expect(
      UnsubscribeSubscriberInputSchema.safeParse({ token: "" }).success
    ).toBe(false);
  });
});
