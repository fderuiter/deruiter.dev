// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  CheckTelemetryRateLimitErrorCode,
  CheckTelemetryRateLimitInputSchema,
} from "@/lib/services";

describe("CheckTelemetryRateLimitInputSchema (Contract Test)", () => {
  it("accepts request headers object", () => {
    const parsed = CheckTelemetryRateLimitInputSchema.safeParse({
      request: new Headers({ "x-forwarded-for": "203.0.113.1" }),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-object payloads", () => {
    const parsed = CheckTelemetryRateLimitInputSchema.safeParse(fromAny(null));
    expect(parsed.success).toBe(false);
    expect(CheckTelemetryRateLimitErrorCode.options).toContain("INVALID_INPUT");
  });
});
