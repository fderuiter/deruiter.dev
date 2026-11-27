// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  ExtractClientIpErrorCode,
  ExtractClientIpInputSchema,
} from "@/lib/services";

describe("ExtractClientIpInputSchema (Contract Test)", () => {
  it("accepts empty object or request headers", () => {
    expect(ExtractClientIpInputSchema.safeParse({}).success).toBe(true);
    expect(
      ExtractClientIpInputSchema.safeParse({
        request: new Headers({ "x-forwarded-for": "203.0.113.10" }),
      }).success
    ).toBe(true);
  });

  it("rejects non-object payloads and exposes typed error codes", () => {
    expect(ExtractClientIpInputSchema.safeParse(fromAny(null)).success).toBe(
      false
    );
    expect(ExtractClientIpErrorCode.options).toContain("INVALID_INPUT");
  });
});
