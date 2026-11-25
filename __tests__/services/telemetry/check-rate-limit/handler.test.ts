// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  CheckTelemetryRateLimitHandler,
  _testCache,
  type CheckTelemetryRateLimitInput,
  type RateLimiterLike,
} from "@/lib/services";

describe("CheckTelemetryRateLimitHandler (Logic Test)", () => {
  beforeEach(() => {
    _testCache.clearAggregateCache();
  });

  it("returns rate-limit decision and standard rate-limit headers", async () => {
    const limiter = fromPartial<RateLimiterLike>({
      limit: async () => ({
        success: false,
        limit: 10,
        remaining: 0,
        reset: 1_700_000_060_000,
      }),
    });
    const handler = new CheckTelemetryRateLimitHandler({
      getRateLimiter: () => limiter,
      clock: () => 1_700_000_000_000,
    });

    const result = await handler.execute({
      request: new Headers({ "x-forwarded-for": "203.0.113.99" }),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limited).toBe(true);
      expect(result.data.headers?.["X-RateLimit-Remaining"]).toBe("0");
    }
  });

  it("returns INVALID_INPUT on malformed root payload", async () => {
    const handler = new CheckTelemetryRateLimitHandler();
    const result = await handler.execute(
      fromPartial<CheckTelemetryRateLimitInput>(null as never)
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
