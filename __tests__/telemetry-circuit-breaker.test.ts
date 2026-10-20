// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

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

import { POST } from "@/app/api/telemetry/route";
import { _testCache } from "@/lib/services/telemetry-service";
import { NextRequest } from "next/server";

describe("Telemetry Rate Limiting Circuit Breaker Cooldown Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    _testCache.reset();

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

  it("triggers a 30-second local circuit breaker state upon upstream rate limit exception", async () => {
    mockRatelimitLimit.mockRejectedValueOnce(
      new Error("Upstream Upstash Redis Rate Limiter Failure")
    );

    const payload = {
      projectSlug: "/dashboard",
      eventType: "page_view",
    };

    const req = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "10.10.10.1" },
      body: JSON.stringify(payload),
    });

    const now = Date.now();
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(_testCache.circuitBreakerCooldownUntil).toBe(now + 30000);

    // Verify rate limit headers exist
    expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("99");
    expect(res.headers.get("X-RateLimit-Reset")).toBeDefined();
  });

  it("bypasses remote rate limit calls and uses local generational memory during 30-second cooldown window", async () => {
    // 1. First request triggers upstream exception and activates circuit breaker
    mockRatelimitLimit.mockRejectedValueOnce(
      new Error("Upstream Rate Limiter Outage")
    );

    const payload = {
      projectSlug: "/dashboard",
      eventType: "page_view",
    };

    const ip = "10.10.10.2";
    const req1 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(payload),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(201);
    expect(res1.headers.get("X-RateLimit-Remaining")).toBe("99");
    expect(mockRatelimitLimit).toHaveBeenCalledTimes(1);

    // Reset mock call count to isolate subsequent requests
    mockRatelimitLimit.mockClear();

    // Send 5 subsequent requests 1 second apart (within circuit breaker & generational window)
    for (let i = 2; i <= 6; i++) {
      await vi.advanceTimersByTimeAsync(1000);

      const req = new NextRequest("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);

      // Verify header calculates remaining correctly from local fallback count
      expect(res.headers.get("X-RateLimit-Remaining")).toBe(String(100 - i));
    }

    // Absolutely ZERO remote rate limit calls should have been made during the cooldown
    expect(mockRatelimitLimit).not.toHaveBeenCalled();
  });

  it("updates local request counts inside active generational memory buffer during fallback mode", async () => {
    mockRatelimitLimit.mockRejectedValueOnce(new Error("Network Partition"));

    const payload = {
      projectSlug: "/simulator",
      eventType: "simulator_option_select",
    };

    const ip = "10.10.10.3";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

    const req1 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(payload),
    });

    await POST(req1);

    const entry1 = _testCache.active.get(ipHash);
    expect(entry1).toBeDefined();
    expect(entry1?.count).toBe(1);

    // Second request within fallback mode
    const req2 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(payload),
    });

    await POST(req2);

    const entry2 = _testCache.active.get(ipHash);
    expect(entry2?.count).toBe(2);
  });

  it("attaches valid rate limit headers derived from local fallback data during circuit breaker activation", async () => {
    mockRatelimitLimit.mockRejectedValueOnce(new Error("Service Unavailable"));

    const payload = {
      projectSlug: "/proof",
      eventType: "page_view",
    };

    const req = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "10.10.10.4" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("99");
    expect(Number(res.headers.get("X-RateLimit-Reset"))).toBeGreaterThan(0);
  });

  it("automatically resumes remote rate limit evaluation after 30-second cooldown expires", async () => {
    // 1. Trigger circuit breaker
    mockRatelimitLimit.mockRejectedValueOnce(new Error("Upstream Timeout"));

    const payload = {
      projectSlug: "/work",
      eventType: "page_view",
    };

    const req1 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "10.10.10.5" },
      body: JSON.stringify(payload),
    });

    await POST(req1);
    expect(mockRatelimitLimit).toHaveBeenCalledTimes(1);

    // 2. Advance time past the 30-second cooldown (30001 ms)
    await vi.advanceTimersByTimeAsync(30001);

    // Prepare mock for successful remote check on resumption
    mockRatelimitLimit.mockResolvedValueOnce({
      success: true,
      limit: 100,
      remaining: 95,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    });

    // 3. Make request after cooldown expiration
    const req2 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": "10.10.10.5" },
      body: JSON.stringify(payload),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(201);

    // Verify remote rate limit check WAS executed after 30 seconds elapsed
    expect(mockRatelimitLimit).toHaveBeenCalledTimes(2);
  });

  it("enforces local rate limits and returns 429 when client exceeds request threshold during fallback mode", async () => {
    mockRatelimitLimit.mockRejectedValue(
      new Error("Persistent Remote Service Outage")
    );

    const payload = {
      projectSlug: "/flood-test",
      eventType: "page_view",
    };

    const ip = "10.10.10.6";

    // Send 100 allowed requests
    for (let i = 1; i <= 100; i++) {
      const req = new NextRequest("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify(payload),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(res.headers.get("X-RateLimit-Remaining")).toBe(String(100 - i));
    }

    // Request 101 should exceed MAX_REQUESTS_PER_WINDOW and return 429
    const reqExceeded = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(payload),
    });

    const resExceeded = await POST(reqExceeded);
    expect(resExceeded.status).toBe(429);
    expect(resExceeded.headers.get("X-RateLimit-Remaining")).toBe("0");

    const data = await resExceeded.json();
    expect(data.error).toContain("Too many requests");
  });
});
