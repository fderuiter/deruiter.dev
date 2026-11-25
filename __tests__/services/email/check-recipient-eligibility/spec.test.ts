// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CheckRecipientEligibilityErrorCode,
  CheckRecipientEligibilityInputSchema,
} from "@/lib/services";

describe("CheckRecipientEligibility Spec (Contract Test)", () => {
  it("accepts non-empty email string", () => {
    expect(
      CheckRecipientEligibilityInputSchema.safeParse({
        email: "user@example.com",
      }).success
    ).toBe(true);
  });

  it("rejects empty email with INVALID_INPUT", () => {
    expect(
      CheckRecipientEligibilityInputSchema.safeParse({ email: "" }).success
    ).toBe(false);
    expect(CheckRecipientEligibilityErrorCode.options).toContain(
      "INVALID_INPUT"
    );
  });
});
