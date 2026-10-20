// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getRedisKeyPrefix, getScopedRedisKey } from "@/lib/redis";
import { TelemetryService, _testCache } from "@/lib/services/telemetry-service";
import { NextRequest } from "next/server";
import { runUpstashVerification } from "../scripts/verify-upstash";
import { POST as contactPost } from "../app/api/contact/route";
import { POST as newsletterPost } from "../app/api/newsletter/route";
import { resetSubmissionAttemptRateLimit } from "../lib/moderation";

const { mockRatelimitLimit, mockLpush, mockExpire, mockExec } = vi.hoisted(
  () => ({
    mockRatelimitLimit: vi.fn(),
    mockLpush: vi.fn(),
    mockExpire: vi.fn(),
    mockExec: vi.fn().mockResolvedValue([1]),
  })
);

vi.mock("@/lib/db", () => ({
  prisma: {
    telemetryEvent: {
      create: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

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

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow = vi.fn();
    limit = mockRatelimitLimit;
  },
}));

describe("Upstash Redis Isolation and Bounded Outage Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _testCache.reset();
    mockRatelimitLimit.mockReset().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    });
  });

  describe("1. Key Namespace & Environment Isolation", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("uses empty prefix by default in standard test/production environments", () => {
      delete process.env.UPSTASH_REDIS_KEY_PREFIX;
      delete process.env.VERCEL_ENV;
      expect(getRedisKeyPrefix()).toBe("");
      expect(getScopedRedisKey("telemetry_buffer")).toBe("telemetry_buffer");
      expect(getScopedRedisKey("telemetry_processing")).toBe(
        "telemetry_processing"
      );
      expect(getScopedRedisKey("@upstash/ratelimit")).toBe(
        "@upstash/ratelimit"
      );
    });

    it("automatically isolates keys with 'preview:' prefix when running in VERCEL_ENV=preview", () => {
      delete process.env.UPSTASH_REDIS_KEY_PREFIX;
      process.env.VERCEL_ENV = "preview";
      expect(getRedisKeyPrefix()).toBe("preview:");
      expect(getScopedRedisKey("telemetry_buffer")).toBe(
        "preview:telemetry_buffer"
      );
      expect(getScopedRedisKey("telemetry_processing")).toBe(
        "preview:telemetry_processing"
      );
      expect(getScopedRedisKey("@upstash/ratelimit")).toBe(
        "preview:@upstash/ratelimit"
      );
    });

    it("prioritizes explicit UPSTASH_REDIS_KEY_PREFIX over environment default", () => {
      process.env.VERCEL_ENV = "preview";
      process.env.UPSTASH_REDIS_KEY_PREFIX = "custom-scope:";
      expect(getRedisKeyPrefix()).toBe("custom-scope:");
      expect(getScopedRedisKey("telemetry_buffer")).toBe(
        "custom-scope:telemetry_buffer"
      );
      expect(getScopedRedisKey("@upstash/ratelimit")).toBe(
        "custom-scope:@upstash/ratelimit"
      );
    });

    it("preserves empty prefix for production to protect existing queues from breaking", () => {
      delete process.env.UPSTASH_REDIS_KEY_PREFIX;
      process.env.VERCEL_ENV = "production";
      expect(getRedisKeyPrefix()).toBe("");
      expect(getScopedRedisKey("telemetry_buffer")).toBe("telemetry_buffer");
    });
  });

  describe("2. Request Deadline Timeout & Circuit Breaker", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("activates 30-second circuit breaker when upstream rate limiter exceeds deadline", async () => {
      let markCalled: () => void;
      const calledPromise = new Promise<void>((resolve) => {
        markCalled = resolve;
      });

      // Simulate an upstream call that hangs beyond the 1500ms deadline
      mockRatelimitLimit.mockImplementation(() => {
        markCalled();
        return new Promise(() => {
          // Never resolves
        });
      });

      const req = new NextRequest("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "x-forwarded-for": "192.168.1.50" },
      });

      const promise = TelemetryService.isRateLimited(req);

      // Wait until crypto hashing finishes and mockRatelimitLimit is entered
      await calledPromise;

      // Fast-forward past the 1500ms request deadline
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      // Fail-open to local fallback: request allowed, but circuit breaker active
      expect(result.limited).toBe(false);
      expect(result.headers).toBeDefined();
      expect(result.headers?.["X-RateLimit-Limit"]).toBe("100");
      expect(result.headers?.["X-RateLimit-Remaining"]).toBe("99");
      expect(_testCache.circuitBreakerCooldownUntil).toBeGreaterThan(
        Date.now()
      );
    });

    it("enforces local limit when client exceeds threshold during circuit breaker window", async () => {
      // Force active circuit breaker
      const now = Date.now();
      mockRatelimitLimit.mockRejectedValue(new Error("Upstream Outage"));

      const req = new NextRequest("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.99" },
      });

      // Trigger circuit breaker
      await TelemetryService.isRateLimited(req);
      expect(_testCache.circuitBreakerCooldownUntil).toBe(now + 30000);

      // Now send 100 requests locally
      for (let i = 0; i < 99; i++) {
        const res = await TelemetryService.isRateLimited(req);
        expect(res.limited).toBe(false);
      }

      // 101st request should be limited locally
      const blockedRes = await TelemetryService.isRateLimited(req);
      expect(blockedRes.limited).toBe(true);
      expect(blockedRes.headers?.["X-RateLimit-Remaining"]).toBe("0");
    });

    it("recovers to remote rate limiting once 30-second cooldown expires", async () => {
      mockRatelimitLimit.mockRejectedValueOnce(new Error("Transient Error"));

      const req = new NextRequest("http://localhost:3000/api/telemetry", {
        method: "POST",
        headers: { "x-forwarded-for": "172.16.0.1" },
      });

      // First call fails, trips circuit breaker
      await TelemetryService.isRateLimited(req);
      expect(mockRatelimitLimit).toHaveBeenCalledTimes(1);

      // Subsequent call within cooldown does not hit remote
      await TelemetryService.isRateLimited(req);
      expect(mockRatelimitLimit).toHaveBeenCalledTimes(1);

      // Advance past 30-second cooldown
      await vi.advanceTimersByTimeAsync(31000);

      mockRatelimitLimit.mockResolvedValueOnce({
        success: true,
        limit: 100,
        remaining: 95,
        reset: Date.now() + 60000,
      });

      // Call after cooldown should probe remote again
      const recoveryResult = await TelemetryService.isRateLimited(req);
      expect(mockRatelimitLimit).toHaveBeenCalledTimes(2);
      expect(recoveryResult.limited).toBe(false);
      expect(recoveryResult.headers?.["X-RateLimit-Remaining"]).toBe("95");
    });
  });

  describe("3. Upstash Verification Runner Logic", () => {
    it("reports degraded_fallback status safely when live credentials are not present", async () => {
      const { success, data } = await runUpstashVerification({ strict: false });

      expect(success).toBe(true);
      expect(data.status).toBe("degraded_fallback");
      expect(data.quotas.commandLimitDaily).toBe(10000);
      expect(data.policies.circuitBreakerCooldownMs).toBe(30000);
      expect(data.policies.requestDeadlineTimeoutMs).toBe(1500);
    });

    it("fails with error when strict mode is requested but credentials are unset", async () => {
      const { success, data } = await runUpstashVerification({ strict: true });

      expect(success).toBe(false);
      expect(data.error).toContain("Strict mode enabled");
    });
  });

  describe("4. Consuming Endpoints Bounded Rate Limit Headers", () => {
    it("returns Retry-After and X-RateLimit headers on /api/contact 429", async () => {
      resetSubmissionAttemptRateLimit();

      const makeReq = () =>
        new NextRequest("http://localhost:3000/api/contact", {
          method: "POST",
          headers: {
            "x-forwarded-for": "203.0.113.195",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name: "Tester",
            email: "tester@example.com",
            subject: "Collaboration Inquiry",
            message: "Hello this is a valid constructive message for the team.",
            _clientTimestamp: Date.now() - 5000,
          }),
        });

      // Exhaust 5 allowed attempts
      for (let i = 0; i < 5; i++) {
        await contactPost(makeReq());
      }

      // 6th attempt hits 429
      const res = await contactPost(makeReq());
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("600");
      expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("returns Retry-After and X-RateLimit headers on /api/newsletter 429", async () => {
      resetSubmissionAttemptRateLimit();

      const makeReq = () =>
        new NextRequest("http://localhost:3000/api/newsletter", {
          method: "POST",
          headers: {
            "x-forwarded-for": "203.0.113.196",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            email: "subscriber@example.com",
            _clientTimestamp: Date.now() - 5000,
          }),
        });

      // Exhaust 5 allowed attempts
      for (let i = 0; i < 5; i++) {
        await newsletterPost(makeReq());
      }

      // 6th attempt hits 429
      const res = await newsletterPost(makeReq());
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("600");
      expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    });
  });
});
