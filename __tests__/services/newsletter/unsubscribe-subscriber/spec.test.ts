// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  UnsubscribeSubscriberErrorCode,
  UnsubscribeSubscriberInputSchema,
} from "@/lib/services";

describe("UnsubscribeSubscriberInputSchema (Contract Test)", () => {
  it("accepts valid unsubscribe token", () => {
    const parsed = UnsubscribeSubscriberInputSchema.safeParse({
      token: "unsubscribe-token-12345",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects short unsubscribe token", () => {
    const parsed = UnsubscribeSubscriberInputSchema.safeParse({
      token: "tiny",
    });
    expect(parsed.success).toBe(false);
    expect(UnsubscribeSubscriberErrorCode.options).toEqual([
      "INVALID_TOKEN",
      "STORAGE_UNAVAILABLE",
    ]);
  });
});
