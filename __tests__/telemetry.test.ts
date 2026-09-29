/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// Use vi.hoisted to declare the mock function before any imports or mocks are executed
const {
  mockRatelimitLimit,
  mockLpush,
  mockExpire,
  mockExec,
  mockTelemetryTransaction,
  mockRawGroupBy,
  mockRollupGroupBy,
} = vi.hoisted(() => {
  return {
    mockRatelimitLimit: vi.fn(),
    mockLpush: vi.fn(),
    mockExpire: vi.fn(),
    mockExec: vi.fn().mockResolvedValue([1]),
    mockTelemetryTransaction: vi.fn(),
    mockRawGroupBy: vi.fn(),
    mockRollupGroupBy: vi.fn(),
  };
});

// Mock the dependencies
vi.mock("@/lib/db", () => {
  return {
    prisma: {
      telemetryEvent: {
        create: vi.fn(),
        groupBy: mockRawGroupBy,
      },
      telemetryDailyRollup: { groupBy: mockRollupGroupBy },
      $transaction: mockTelemetryTransaction,
    },
  };
});

const mockTelemetryTransactionClient = {
  telemetryEvent: { groupBy: mockRawGroupBy },
  telemetryDailyRollup: { groupBy: mockRollupGroupBy },
};

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

// Import endpoints AFTER setting up the hoisted variables and mocks
import { POST, GET } from "@/app/api/telemetry/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { _testCache } from "@/lib/services/telemetry-service";

describe("Telemetry API Route - Route Error Telemetry", () => {
  beforeEach(() => {
    _testCache.reset();
    vi.clearAllMocks();
    mockRawGroupBy.mockReset().mockResolvedValue([]);
    mockRollupGroupBy.mockReset().mockResolvedValue([]);
    mockTelemetryTransaction
      .mockReset()
      .mockImplementation(
        async (
          callback: (
            transaction: typeof mockTelemetryTransactionClient
          ) => unknown
        ) => callback(mockTelemetryTransactionClient)
      );
    // Default rate limit behavior to success for existing tests
    mockRatelimitLimit.mockReset().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    });
  });

  it("should accept 'route_error' event type and save it in the memory queue", async () => {
    const payload = {
      projectSlug: "/non-existent-page-link",
      eventType: "route_error",
    };

    // Construct the NextRequest
    const req = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.event.projectSlug).toBe("/non-existent-page-link");
    expect(data.event.eventType).toBe("route_error");

    expect(prisma.telemetryEvent.create).not.toHaveBeenCalled();
    expect(mockLpush).toHaveBeenCalledWith(
      "telemetry_buffer",
      expect.objectContaining({
        projectSlug: "/non-existent-page-link",
        eventType: "route_error",
      })
    );
    expect(mockExpire).toHaveBeenCalledWith("telemetry_buffer", 172800);
  });

  it("should accept candidate simulator event types and persist them in the memory buffer", async () => {
    const simulatorEventTypes = [
      "simulator_option_select",
      "simulator_milestone_reached",
      "simulator_schedule_click",
      "simulator_report_copy",
    ];

    for (const eventType of simulatorEventTypes) {
      const payload = {
        projectSlug: "simulator",
        eventType,
      };

      const req = new NextRequest("http://localhost:3000/api/telemetry", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const response = await POST(req);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.event.projectSlug).toBe("simulator");
      expect(data.event.eventType).toBe(eventType);

      expect(mockLpush).toHaveBeenCalledWith(
        "telemetry_buffer",
        expect.objectContaining({
          projectSlug: "simulator",
          eventType,
        })
      );
    }
  });

  it("should reject invalid event types with 400 status", async () => {
    const payload = {
      projectSlug: "/some-path",
      eventType: "invalid_event_type",
    };

    const req = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain("Missing or invalid eventType");
    expect(prisma.telemetryEvent.create).not.toHaveBeenCalled();
  });

  it("should reject client with 429 when rate limit is exceeded", async () => {
    mockRatelimitLimit.mockResolvedValue({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    });

    const payload = {
      projectSlug: "/dashboard",
      eventType: "page_view",
    };

    const req = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: {
        "x-forwarded-for": "10.0.0.1",
      },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);

    const data = await res.json();
    expect(data.error).toContain("Too many requests");

    // Standard headers check
    expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("X-RateLimit-Reset")).toBeDefined();
  });

  it("should cache active, valid clients locally to bypass remote rate limiter checks", async () => {
    // Configure the rate limiter mock to return success
    const mockResetTime = Date.now() + 10000;
    mockRatelimitLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: mockResetTime,
      pending: Promise.resolve(),
    });

    const payload = {
      projectSlug: "/dashboard",
      eventType: "page_view",
    };

    // Mock database write success
    vi.mocked(prisma.telemetryEvent.create).mockResolvedValue({
      id: "uuid-1",
      projectSlug: "/dashboard",
      eventType: "page_view",
      createdAt: new Date(),
    });

    // First request
    const req1 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: {
        "x-forwarded-for": "192.168.1.1",
      },
      body: JSON.stringify(payload),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(201);
    expect(mockRatelimitLimit).toHaveBeenCalledTimes(1);

    // Second request from the same IP (should hit local cache and bypass remote check)
    const req2 = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: {
        "x-forwarded-for": "192.168.1.1",
      },
      body: JSON.stringify(payload),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(201);
    // The rate limiter limit mock should NOT have been called a second time!
    expect(mockRatelimitLimit).toHaveBeenCalledTimes(1);
  });

  it("should return consolidated stats on GET request", async () => {
    const mockGroupByRes = [
      { projectSlug: "/dashboard", eventType: "page_view", _count: { id: 12 } },
      {
        projectSlug: "/dashboard",
        eventType: "project_click",
        _count: { id: 7 },
      },
      { projectSlug: "/about", eventType: "page_view", _count: { id: 4 } },
    ];
    mockRawGroupBy.mockResolvedValue(mockGroupByRes);
    mockRollupGroupBy.mockResolvedValue([
      {
        projectSlug: "/dashboard",
        eventType: "page_view",
        _sum: { count: 3 },
      },
      {
        projectSlug: "/about",
        eventType: "project_click",
        _sum: { count: 2 },
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data["/dashboard"]).toEqual({ views: 15, clicks: 7 });
    expect(data["/about"]).toEqual({ views: 4, clicks: 2 });
    expect(mockTelemetryTransaction).toHaveBeenCalledTimes(1);
    expect(mockRawGroupBy).toHaveBeenCalledTimes(1);
    expect(mockRollupGroupBy).toHaveBeenCalledTimes(1);
  });

  it("should fail gracefully on GET request if database query fails", async () => {
    mockRollupGroupBy.mockRejectedValue(
      new Error("Database connection timed out")
    );

    const res = await GET();
    expect(res.status).toBe(500);

    const data = await res.json();
    expect(data.error).toContain("Failed to compile aggregate");
  });

  it("should mask / hash IP addresses anonymously to prevent plain-text PII storage", async () => {
    mockRatelimitLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    });

    const payload = {
      projectSlug: "/dashboard",
      eventType: "page_view",
    };

    const rawIp = "198.51.100.42";
    const hashedIp = crypto.createHash("sha256").update(rawIp).digest("hex");

    const req = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: {
        "x-forwarded-for": rawIp,
      },
      body: JSON.stringify(payload),
    });

    await POST(req);

    // Verify the rate limiter was called with the hashed IP, not the raw IP
    expect(mockRatelimitLimit).toHaveBeenCalledWith(hashedIp);
    expect(mockRatelimitLimit).not.toHaveBeenCalledWith(rawIp);
  });

  it("should fallback gracefully to secondary Redis buffering on primary database connection failure", async () => {
    mockRatelimitLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    });

    const payload = {
      projectSlug: "/dashboard",
      eventType: "page_view",
    };

    // Simulate database write failure
    vi.mocked(prisma.telemetryEvent.create).mockRejectedValue(
      new Error("Database connection lost")
    );

    const req = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: {
        "x-forwarded-for": "10.0.0.5",
      },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.event.projectSlug).toBe("/dashboard");
    expect(data.event.eventType).toBe("page_view");
  });

  it("should fall back to x-real-ip if x-forwarded-for is missing", async () => {
    mockRatelimitLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
      pending: Promise.resolve(),
    });

    const payload = {
      projectSlug: "/dashboard",
      eventType: "page_view",
    };

    const rawIp = "198.51.100.99";
    const hashedIp = crypto.createHash("sha256").update(rawIp).digest("hex");

    const req = new NextRequest("http://localhost:3000/api/telemetry", {
      method: "POST",
      headers: {
        "x-real-ip": rawIp,
      },
      body: JSON.stringify(payload),
    });

    await POST(req);

    // Verify rate limit check was called with hashed x-real-ip
    expect(mockRatelimitLimit).toHaveBeenCalledWith(hashedIp);
  });
});
