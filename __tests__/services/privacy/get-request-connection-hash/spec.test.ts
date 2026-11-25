// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GetRequestConnectionHashInputSchema } from "@/lib/services";

describe("GetRequestConnectionHashInputSchema (Contract Test)", () => {
  it("accepts optional request headers container", () => {
    expect(
      GetRequestConnectionHashInputSchema.safeParse({
        requestOrHeaders: { "user-agent": "Mozilla/5.0" },
      }).success
    ).toBe(true);
  });

  it("rejects primitive payloads", () => {
    expect(GetRequestConnectionHashInputSchema.safeParse("bad").success).toBe(
      false
    );
  });
});
