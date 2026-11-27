// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CheckRecipientEligibilityErrorCode,
  CheckRecipientEligibilityInputSchema,
} from "@/lib/services";

describe("CheckRecipientEligibilityInputSchema (Contract Test)", () => {
  it("accepts single recipient string or non-empty recipient list", () => {
    expect(
      CheckRecipientEligibilityInputSchema.safeParse({
        recipients: "user@example.com",
      }).success
    ).toBe(true);
    expect(
      CheckRecipientEligibilityInputSchema.safeParse({
        recipients: ["a@example.com", "b@example.com"],
      }).success
    ).toBe(true);
  });

  it("rejects empty recipients", () => {
    expect(
      CheckRecipientEligibilityInputSchema.safeParse({ recipients: [] }).success
    ).toBe(false);
    expect(CheckRecipientEligibilityErrorCode.options).toContain(
      "INVALID_INPUT"
    );
  });
});
