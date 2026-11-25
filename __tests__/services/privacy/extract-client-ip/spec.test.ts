// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ExtractClientIpInputSchema } from "@/lib/services";

describe("ExtractClientIpInputSchema (Contract Test)", () => {
  it("accepts headers record or empty input", () => {
    expect(
      ExtractClientIpInputSchema.safeParse({
        requestOrHeaders: { "x-forwarded-for": "203.0.113.10" },
      }).success
    ).toBe(true);
    expect(ExtractClientIpInputSchema.safeParse({}).success).toBe(true);
  });

  it("rejects non-object root input", () => {
    expect(ExtractClientIpInputSchema.safeParse(null).success).toBe(false);
  });
});
