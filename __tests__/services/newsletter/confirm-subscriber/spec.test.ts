// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ConfirmSubscriberInputSchema } from "@/lib/services";

describe("ConfirmSubscriberInputSchema (Contract Test)", () => {
  it("accepts non-empty confirmation token", () => {
    expect(
      ConfirmSubscriberInputSchema.safeParse({ token: "tok_abc123" }).success
    ).toBe(true);
  });

  it("rejects empty confirmation token", () => {
    expect(ConfirmSubscriberInputSchema.safeParse({ token: "" }).success).toBe(
      false
    );
  });
});
