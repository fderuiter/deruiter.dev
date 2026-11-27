// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CheckTelemetryRateLimitHandler,
  MAX_REQUESTS_PER_WINDOW,
  _testCache,
  checkAndSwapTelemetryPassive,
  clearTelemetryAggregateCache,
  cloneAggregateStats,
  getAggregateStatsCacheEntry,
  getCircuitBreakerCooldownUntil,
  getTelemetryRateLimiter,
  setAggregateStatsCacheEntry,
  setCircuitBreakerCooldownUntil,
} from "@/lib/services";

describe("CheckTelemetryRateLimitHandler & Telemetry Shared Cache (Logic Test)", () => {
  beforeEach(() => {
    _testCache.reset();
  });

  it("allows within-budget requests, serves subsequent hits from active/inactive local generations, and evicts when upstream rejects", async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        limit: MAX_REQUESTS_PER_WINDOW,
        remaining: MAX_REQUESTS_PER_WINDOW - 1,
        reset: Date.now() + 60_000,
      })
      .mockResolvedValueOnce({
        success: false,
        limit: MAX_REQUESTS_PER_WINDOW,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

    const handler = new CheckTelemetryRateLimitHandler({
      getRateLimiter: () => ({ limit }),
      hashIp: async () => "hash-fixed-1",
    });

    const req = { request: new Headers({ "x-real-ip": "203.0.113.77" }) };
    const first = await handler.execute(req);
    expect(first.success).toBe(true);
    if (first.success) {
      expect(first.data.limited).toBe(false);
    }
    expect(limit).toHaveBeenCalledTimes(1);

    // Second call uses local active generation cache without hitting upstream
    const second = await handler.execute(req);
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.data.limited).toBe(false);
    }
    expect(limit).toHaveBeenCalledTimes(1);

    // Swap into inactive generation and verify inactive cache lookup
    _testCache.swap();
    const third = await handler.execute(req);
    expect(third.success).toBe(true);
    expect(limit).toHaveBeenCalledTimes(1);

    // Force count to threshold so next call hits upstream and triggers rejection eviction
    const entry = _testCache.inactive.get("hash-fixed-1");
    if (entry) {
      entry.count = MAX_REQUESTS_PER_WINDOW;
    }
    const fourth = await handler.execute(req);
    expect(fourth.success).toBe(true);
    if (fourth.success) {
      expect(fourth.data.limited).toBe(true);
    }
    expect(limit).toHaveBeenCalledTimes(2);
  });

  it("activates 30s circuit breaker when upstream throws and enforces local fallback budget while circuit is open", async () => {
    const limit = vi.fn().mockRejectedValue(new Error("Upstash unreachable"));
    const handler = new CheckTelemetryRateLimitHandler({
      getRateLimiter: () => ({ limit }),
      hashIp: async () => "hash-circuit-1",
    });

    const req = { request: new Headers({ "x-real-ip": "203.0.113.88" }) };
    const fallbackFirst = await handler.execute(req);
    expect(fallbackFirst.success).toBe(true);
    if (fallbackFirst.success) {
      expect(fallbackFirst.data.limited).toBe(false);
    }
    expect(getCircuitBreakerCooldownUntil()).toBeGreaterThan(Date.now());

    // Subsequent call while circuit is open increments local entry without calling upstream
    const cached = _testCache.active.get("hash-circuit-1");
    if (cached) {
      cached.count = MAX_REQUESTS_PER_WINDOW;
    }
    const overBudget = await handler.execute(req);
    expect(overBudget.success).toBe(true);
    if (overBudget.success) {
      expect(overBudget.data.limited).toBe(true);
    }
    expect(limit).toHaveBeenCalledTimes(1);

    // Uncached IP while circuit is open initializes local entry
    const handlerNewIp = new CheckTelemetryRateLimitHandler({
      getRateLimiter: () => ({ limit }),
      hashIp: async () => "hash-circuit-2",
    });
    const uncachedCircuit = await handlerNewIp.execute(req);
    expect(uncachedCircuit.success).toBe(true);
    if (uncachedCircuit.success) {
      expect(uncachedCircuit.data.limited).toBe(false);
    }
  });

  it("returns INVALID_INPUT on malformed payload or hash failure without throwing", async () => {
    const handler = new CheckTelemetryRateLimitHandler({
      hashIp: async () => {
        throw new Error("crypto failure");
      },
    });
    const malformed = await handler.execute(fromAny(null));
    expect(malformed.success).toBe(false);
    if (!malformed.success) {
      expect(malformed.error.code).toBe("INVALID_INPUT");
    }

    const hashErr = await handler.execute({
      request: new Headers({ "x-real-ip": "203.0.113.99" }),
    });
    expect(hashErr.success).toBe(false);
    if (!hashErr.success) {
      expect(hashErr.error.code).toBe("INVALID_INPUT");
    }
  });

  it("exercises shared telemetry cache helpers and passive swap windows", () => {
    const cloned = cloneAggregateStats({
      "crf-studio": { views: 10, clicks: 3 },
    });
    expect(cloned["crf-studio"]).toEqual({ views: 10, clicks: 3 });

    setAggregateStatsCacheEntry({
      data: cloned,
      expiresAt: Date.now() + 5_000,
    });
    expect(getAggregateStatsCacheEntry()?.data).toEqual(cloned);
    expect(_testCache.aggregateStats?.data).toEqual(cloned);
    _testCache.clearAggregateCache();
    expect(getAggregateStatsCacheEntry()).toBeNull();

    setAggregateStatsCacheEntry({
      data: cloned,
      expiresAt: Date.now() + 5_000,
    });
    _testCache.clearAggregateStatsCache();
    expect(getAggregateStatsCacheEntry()).toBeNull();
    clearTelemetryAggregateCache();

    setCircuitBreakerCooldownUntil(12345);
    expect(_testCache.circuitBreakerCooldownUntil).toBe(12345);
    setCircuitBreakerCooldownUntil(0);

    expect(getTelemetryRateLimiter()).toBeDefined();

    vi.useFakeTimers();
    try {
      _testCache.reset();
      _testCache.active.set("k1", {
        count: 1,
        expiresAt: Date.now() + 60_000,
      });
      vi.advanceTimersByTime(6_000);
      checkAndSwapTelemetryPassive();
      expect(_testCache.inactive.has("k1")).toBe(true);

      vi.advanceTimersByTime(12_000);
      checkAndSwapTelemetryPassive();
      expect(_testCache.active.size).toBe(0);
      expect(_testCache.inactive.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
