// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CheckTelemetryRateLimitInputSchema } from "@/lib/services";

describe("CheckTelemetryRateLimitInputSchema (Contract Test)", () => {
  it("accepts request headers container", () => {
    expect(
      CheckTelemetryRateLimitInputSchema.safeParse({
        request: new Headers({ "x-forwarded-for": "10.0.0.1" }),
      }).success
    ).toBe(true);
  });

  it("rejects primitive root input", () => {
    expect(CheckTelemetryRateLimitInputSchema.safeParse(null).success).toBe(
      false
    );
  });
});
