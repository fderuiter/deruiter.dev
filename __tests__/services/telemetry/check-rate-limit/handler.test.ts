// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  BufferEnqueueTimeoutError,
  CheckTelemetryRateLimitHandler,
  _testCache,
  clearTelemetryAggregateCache,
  cloneAggregateStats,
  setAggregateStatsCacheState,
  type RateLimiterLike,
} from "@/lib/services";

describe("CheckTelemetryRateLimitHandler (Logic Test)", () => {
  beforeEach(() => {
    _testCache.reset();
  });

  it("returns rate-limit decision and standard rate-limit headers when limited", async () => {
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

  it("caches allowed upstream decisions locally and activates 30s circuit breaker on upstream failure", async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        limit: 20,
        remaining: 19,
        reset: 1_700_000_060_000,
      })
      .mockRejectedValueOnce(new Error("Upstash timeout"));

    const now = 1_700_000_000_000;
    const handler = new CheckTelemetryRateLimitHandler({
      getRateLimiter: () => ({ limit }),
      clock: () => now,
    });

    const firstAllowed = await handler.execute({
      request: new Headers({ "x-forwarded-for": "203.0.113.10" }),
    });
    expect(firstAllowed.success).toBe(true);

    const cachedAllowed = await handler.execute({
      request: new Headers({ "x-forwarded-for": "203.0.113.10" }),
    });
    expect(cachedAllowed.success).toBe(true);
    expect(limit).toHaveBeenCalledTimes(1);

    const fallbackDecision = await handler.execute({
      request: new Headers({ "x-forwarded-for": "203.0.113.25" }),
    });
    expect(fallbackDecision.success).toBe(true);
    expect(_testCache.circuitBreakerCooldownUntil).toBeGreaterThan(now);

    const circuitActiveDecision = await handler.execute({
      request: new Headers({ "x-forwarded-for": "203.0.113.25" }),
    });
    expect(circuitActiveDecision.success).toBe(true);
  });

  it("returns RATE_LIMIT_CHECK_FAILED when IP hashing throws unexpectedly", async () => {
    const handler = new CheckTelemetryRateLimitHandler({
      hashIp: async () => {
        throw new Error("Crypto subtle failure");
      },
    });
    const result = await handler.execute({
      request: new Headers({ "x-forwarded-for": "203.0.113.50" }),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RATE_LIMIT_CHECK_FAILED");
    }
  });

  it("exercises shared telemetry cache helpers and BufferEnqueueTimeoutError", () => {
    vi.useFakeTimers();
    try {
      _testCache.reset();
      _testCache.active.set("k-swap", { count: 1, expiresAt: 50_000 });
      vi.advanceTimersByTime(6_000);
      const limiter = new CheckTelemetryRateLimitHandler({
        getRateLimiter: () => ({
          limit: async () => ({
            success: true,
            limit: 10,
            remaining: 9,
            reset: Date.now() + 10_000,
          }),
        }),
      });
      void limiter;

      const err = new BufferEnqueueTimeoutError(2000);
      expect(err.name).toBe("BufferEnqueueTimeoutError");

      const cloned = cloneAggregateStats({ crf: { views: 3, clicks: 1 } });
      expect(cloned.crf).toEqual({ views: 3, clicks: 1 });

      setAggregateStatsCacheState({ data: cloned, expiresAt: 10_000 });
      expect(_testCache.aggregateStats?.data.crf).toEqual({
        views: 3,
        clicks: 1,
      });
      clearTelemetryAggregateCache();
      expect(_testCache.aggregateStats).toBeNull();

      _testCache.active.set("k1", { count: 1, expiresAt: 5000 });
      _testCache.swap();
      expect(_testCache.inactive.has("k1")).toBe(true);
      _testCache.clearAggregateStatsCache();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rotates and clears telemetry generations across single and double swap intervals", async () => {
    vi.useFakeTimers();
    try {
      _testCache.reset();
      _testCache.active.set("gen-entry", {
        count: 1,
        expiresAt: Date.now() + 60_000,
      });

      const handler = new CheckTelemetryRateLimitHandler({
        getRateLimiter: () => ({
          limit: async () => ({
            success: true,
            limit: 20,
            remaining: 19,
            reset: Date.now() + 60_000,
          }),
        }),
      });

      vi.advanceTimersByTime(6_000);
      await handler.execute({
        request: new Headers({ "x-forwarded-for": "198.51.100.1" }),
      });
      expect(_testCache.inactive.has("gen-entry")).toBe(true);

      vi.advanceTimersByTime(12_000);
      await handler.execute({
        request: new Headers({ "x-forwarded-for": "198.51.100.2" }),
      });
      expect(_testCache.inactive.has("gen-entry")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns INVALID_INPUT on malformed root payload", async () => {
    const handler = new CheckTelemetryRateLimitHandler();
    const result = await handler.execute(fromAny(null));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
