// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

// Hoist mock functions
const { mockRatelimitLimit, mockLpush, mockExpire, mockExec } = vi.hoisted(
  () => {
    return {
      mockRatelimitLimit: vi.fn(),
      mockLpush: vi.fn(),
      mockExpire: vi.fn(),
      mockExec: vi.fn().mockResolvedValue([1]),
    };
  }
);

// Mock dependencies
vi.mock("@/lib/db", () => {
  return {
    prisma: {
      telemetryEvent: {
        create: vi.fn(),
        groupBy: vi.fn(),
      },
    },
  };
});

vi.mock("@upstash/redis", () => {
  class MockRedis {
    pipeline() {
      return {
        lpush: mockLpush,
        expire: mockExpire,
        exec: mockExec,
      };
    }
  }
  return { Redis: MockRedis };
});

vi.mock("@upstash/ratelimit", () => {
  return {
    Ratelimit: class {
      static slidingWindow = vi.fn();
      limit = mockRatelimitLimit;
    },
  };
});

// Import endpoint and _testCache
import { POST } from "@/app/api/telemetry/route";
import { _testCache } from "@/lib/services/telemetry-service";
import { NextRequest } from "next/server";

describe("Generational Double-Buffered Cache for Telemetry Rate Limiter", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    _testCache.reset();

    // Default mock rate check to success
    mockRatelimitLimit.mockReset().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize with two separate empty generational maps", () => {
    expect(_testCache.active).toBeInstanceOf(Map);
    expect(_testCache.inactive).toBeInstanceOf(Map);
    expect(_testCache.active.size).toBe(0);
    expect(_testCache.inactive.size).toBe(0);
  });

  it("should write new rate limit statuses exclusively to the active map", async () => {
    const payload = {
      projectSlug: "/test-project",
      eventType: "page_view",
    };

    const req = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "1.1.1.1" },
      body: JSON.stringify(payload),
    });

    const ipHash = crypto.createHash("sha256").update("1.1.1.1").digest("hex");

    await POST(req);

    // Active map must contain the rate-limit state
    expect(_testCache.active.has(ipHash)).toBe(true);
    // Inactive map must remain empty
    expect(_testCache.inactive.has(ipHash)).toBe(false);
  });

  it("should check and retrieve cached entries from both active and inactive maps", async () => {
    const payload = {
      projectSlug: "/test-project",
      eventType: "page_view",
    };

    const ipHash = crypto.createHash("sha256").update("2.2.2.2").digest("hex");

    // Manually seed the inactive generation
    _testCache.inactive.set(ipHash, {
      count: 10,
      expiresAt: Date.now() + 10000,
    });

    // Make request (should hit inactive cache and increment)
    const req = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "2.2.2.2" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    // The remote rate limiter should NOT be called because of cache hit in inactive map
    expect(mockRatelimitLimit).not.toHaveBeenCalled();

    // Verify lookup successfully found and updated the entry
    const entry = _testCache.inactive.get(ipHash);
    expect(entry).toBeDefined();
    expect(entry?.count).toBe(11);
  });

  it("should swap active and inactive maps every 5 seconds to clear the oldest records in constant time", async () => {
    const payload = {
      projectSlug: "/test-project",
      eventType: "page_view",
    };

    // Make first request to seed active cache
    const req1 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "3.3.3.3" },
      body: JSON.stringify(payload),
    });
    await POST(req1);

    const ipHash = crypto.createHash("sha256").update("3.3.3.3").digest("hex");
    expect(_testCache.active.has(ipHash)).toBe(true);
    expect(_testCache.inactive.has(ipHash)).toBe(false);

    // Advance time by 5 seconds to trigger swap
    await vi.advanceTimersByTimeAsync(5000);

    // Make dummy request from another IP to trigger passive check
    const reqDummy = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "9.9.9.9" },
      body: JSON.stringify(payload),
    });
    await POST(reqDummy);

    // After swap: active becomes inactive, and old inactive is cleared (which was empty anyway)
    expect(_testCache.active.has(ipHash)).toBe(false);
    expect(_testCache.inactive.has(ipHash)).toBe(true);

    // Advance time by another 5 seconds to trigger second swap
    await vi.advanceTimersByTimeAsync(5000);

    // Make second dummy request from another IP to trigger second passive check
    const reqDummy2 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "9.9.9.9" },
      body: JSON.stringify(payload),
    });
    await POST(reqDummy2);

    // After two swaps, the original entry is completely cleared out and discarded
    expect(_testCache.active.has(ipHash)).toBe(false);
    expect(_testCache.inactive.has(ipHash)).toBe(false);
  });

  it("should guarantee any entry lifespan is strictly limited to at most double the swap window (10 seconds)", async () => {
    const payload = {
      projectSlug: "/test-project",
      eventType: "page_view",
    };

    const ipHash = crypto.createHash("sha256").update("4.4.4.4").digest("hex");

    // First request
    const req1 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "4.4.4.4" },
      body: JSON.stringify(payload),
    });
    await POST(req1);
    expect(_testCache.active.has(ipHash)).toBe(true);

    // Advance 4.9 seconds (just before next swap)
    await vi.advanceTimersByTimeAsync(4900);
    expect(_testCache.active.has(ipHash)).toBe(true);

    // Next request: should hit active cache and increment count in-place
    const req2 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "4.4.4.4" },
      body: JSON.stringify(payload),
    });
    await POST(req2);
    expect(_testCache.active.get(ipHash)?.count).toBe(2);

    // Advance 0.2 seconds to cross the 5s swap threshold (total 5.1 seconds elapsed)
    await vi.advanceTimersByTimeAsync(200);

    // Make dummy request to trigger passive swap
    const reqDummy = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "9.9.9.9" },
      body: JSON.stringify(payload),
    });
    await POST(reqDummy);

    // The entry should now be in the inactive generation
    expect(_testCache.active.has(ipHash)).toBe(false);
    expect(_testCache.inactive.has(ipHash)).toBe(true);

    // Advance another 5.0 seconds to cross the next 5s swap interval boundary relative to the last swap
    await vi.advanceTimersByTimeAsync(5000);

    // Make second dummy request to trigger second passive check
    const reqDummy2 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "9.9.9.9" },
      body: JSON.stringify(payload),
    });
    await POST(reqDummy2);

    // Entry is completely gone! It can never live beyond 10 seconds total.
    expect(_testCache.active.has(ipHash)).toBe(false);
    expect(_testCache.inactive.has(ipHash)).toBe(false);
  });

  it("should immediately invalidate and clear rate-limit bypass across both maps when a user is blocked", async () => {
    const payload = {
      projectSlug: "/test-project",
      eventType: "page_view",
    };

    const ipHash = crypto.createHash("sha256").update("5.5.5.5").digest("hex");

    // Setup: put the user in both active and inactive cache generations (simulating edge case)
    // We seed count = 100 (which is MAX_REQUESTS_PER_WINDOW) to force falling through to SDK rate limiting
    _testCache.active.set(ipHash, { count: 100, expiresAt: Date.now() + 5000 });
    _testCache.inactive.set(ipHash, {
      count: 100,
      expiresAt: Date.now() + 5000,
    });

    // Mock rate limiter returning block (success: false)
    mockRatelimitLimit.mockResolvedValue({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    });

    // Make request (forces a check because count is updated or limit exceeded)
    const req = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "5.5.5.5" },
      body: JSON.stringify(payload),
    });

    // We configure the mock to fail/block, so bypass cache must be invalidated
    const res = await POST(req);
    expect(res.status).toBe(429);

    // Validate both active and inactive caches were cleared for this IP address
    expect(_testCache.active.has(ipHash)).toBe(false);
    expect(_testCache.inactive.has(ipHash)).toBe(false);
  });
});
