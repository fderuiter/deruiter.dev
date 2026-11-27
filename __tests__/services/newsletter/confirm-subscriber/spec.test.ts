// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ConfirmSubscriberErrorCode,
  ConfirmSubscriberInputSchema,
} from "@/lib/services";

describe("ConfirmSubscriberInputSchema (Contract Test)", () => {
  it("accepts valid confirmation token", () => {
    const parsed = ConfirmSubscriberInputSchema.safeParse({
      token: "valid-confirmation-token-12345",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects short confirmation tokens", () => {
    const parsed = ConfirmSubscriberInputSchema.safeParse({
      token: "short",
    });
    expect(parsed.success).toBe(false);
    expect(ConfirmSubscriberErrorCode.options).toEqual([
      "INVALID_TOKEN",
      "STORAGE_UNAVAILABLE",
    ]);
  });
});
