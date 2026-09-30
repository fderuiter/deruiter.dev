import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const {
  mockLpush,
  mockExpire,
  mockExec,
  mockRpop,
  mockLmove,
  mockLrem,
  mockLrange,
  mockDel,
  mockCreateMany,
  mockQueryRawUnsafe,
} = vi.hoisted(() => ({
  mockLpush: vi.fn(),
  mockExpire: vi.fn(),
  mockExec: vi.fn(),
  mockRpop: vi.fn(),
  mockLmove: vi.fn(),
  mockLrem: vi.fn(),
  mockLrange: vi.fn().mockResolvedValue([]),
  mockDel: vi.fn(),
  mockCreateMany: vi.fn().mockResolvedValue({ count: 2 }),
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      telemetryEvent: {
        createMany: mockCreateMany,
        groupBy: vi.fn(),
        create: vi.fn(),
      },
      $queryRawUnsafe: mockQueryRawUnsafe,
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
        rpop: mockRpop,
        lmove: mockLmove,
        lrem: mockLrem,
      };
    }
    lrange = mockLrange;
    del = mockDel;
  }
  return { Redis: MockRedis };
});

vi.mock("@upstash/ratelimit", () => {
  return {
    Ratelimit: class {
      static slidingWindow = vi.fn();
      limit = vi.fn().mockResolvedValue({
        success: true,
        limit: 100,
        remaining: 99,
        reset: Date.now() + 60000,
      });
    },
  };
});

import { TelemetryService, _testCache } from "@/lib/services/telemetry-service";

describe("Atomic LMOVE Queue, Passive Timer & Lazy DB Health Check Acceptance Criteria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _testCache.reset();
  });

  // Acceptance Criterion 1: Telemetry events transfer atomically between buffer lists
  it("transfers telemetry events atomically using LMOVE without non-atomic pop actions", async () => {
    const mockEvents = [
      {
        id: "evt-101",
        projectSlug: "/studio",
        eventType: "page_view",
        createdAt: new Date(),
      },
      {
        id: "evt-102",
        projectSlug: "/proof",
        eventType: "project_click",
        createdAt: new Date(),
      },
    ];

    mockLrange.mockResolvedValueOnce([]);
    mockExec.mockResolvedValueOnce([...mockEvents, ...Array(48).fill(null)]);
    mockCreateMany.mockResolvedValueOnce({ count: 2 });

    const result = await TelemetryService.syncBufferedEvents(50);

    expect(result).toEqual({
      success: true,
      data: { processed: 2, inserted: 2 },
    });

    // Verify LMOVE was used instead of RPOP
    expect(mockLmove).toHaveBeenCalledWith(
      "telemetry_buffer",
      "telemetry_processing",
      "right",
      "left"
    );
    expect(mockRpop).not.toHaveBeenCalled();

    // Verify only the processed events are acknowledged after DB write success.
    // Clearing the whole key would also discard events an overlapping sync
    // moved into the processing queue after this worker read it.
    expect(mockDel).not.toHaveBeenCalledWith("telemetry_processing");
    expect(mockLrem).toHaveBeenCalledTimes(2);
    expect(mockLrem).toHaveBeenCalledWith(
      "telemetry_processing",
      1,
      mockEvents[0]
    );
    expect(mockLrem).toHaveBeenCalledWith(
      "telemetry_processing",
      1,
      mockEvents[1]
    );
  });

  // Acceptance Criterion 2: Background interval timer workers are completely removed
  it("has zero active background setInterval timers in the telemetry service codebase", () => {
    const filePath = path.resolve(
      process.cwd(),
      "lib/services/telemetry-service.ts"
    );
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("clearInterval");
  });

  // Acceptance Criterion 3: Rate-limiting memory state rotates passively based on active request timestamps
  it("rotates rate-limiting memory state passively on request timestamps without background timers", async () => {
    const ip = "192.0.2.100";
    const req = new NextRequest("http://localhost/api/telemetry", {
      headers: { "x-forwarded-for": ip },
    });

    const now = Date.now();
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    // Initial request populates active generation
    await TelemetryService.isRateLimited(req);
    expect(_testCache.active.size).toBe(1);
    expect(_testCache.inactive.size).toBe(0);

    // Advance clock past SWAP_INTERVAL_MS (5000ms)
    dateSpy.mockReturnValue(now + 6000);

    // Subsequent request triggers passive swap
    await TelemetryService.isRateLimited(req);

    // Memory state swapped passively: previous active generation moved to inactive
    expect(_testCache.inactive.size).toBeGreaterThan(0);

    dateSpy.mockRestore();
  });

  // Acceptance Criterion 4: Initial database queries execute immediately without waiting for pre-flight health checks
  it("verifies DB health check code structure is non-blocking and asynchronous", () => {
    const filePath = path.resolve(process.cwd(), "lib/db.ts");
    const source = fs.readFileSync(filePath, "utf-8");

    // Must trigger health check asynchronously without await
    expect(source).toContain("verifyDatabaseHealthAsync");
    expect(source).not.toContain("await baseClient.$queryRawUnsafe");
    expect(source).toContain("return query(args)");
  });

  // Acceptance Criterion 5: Unhandled database write exceptions leave telemetry event batches in the processing queue
  it("preserves telemetry event batch in processing queue when database write fails", async () => {
    const mockEvents = [
      {
        id: "evt-fail-1",
        projectSlug: "/fail-test",
        eventType: "page_view",
        createdAt: new Date(),
      },
    ];

    mockLrange.mockResolvedValueOnce([]);
    mockExec.mockResolvedValueOnce(mockEvents);

    const dbError = new Error("Database Write Failed / Connection Timeout");
    mockCreateMany.mockRejectedValueOnce(dbError);

    await expect(
      TelemetryService.syncBufferedEvents(10)
    ).resolves.toMatchObject({
      success: false,
      error: { code: "PERSISTENCE_FAILED", details: dbError },
    });

    // Processing queue must NOT be deleted on error
    expect(mockDel).not.toHaveBeenCalledWith("telemetry_processing");
    // Events transferred via LMOVE remain in telemetry_processing for subsequent retry
    expect(mockLmove).toHaveBeenCalledWith(
      "telemetry_buffer",
      "telemetry_processing",
      "right",
      "left"
    );
  });
});
