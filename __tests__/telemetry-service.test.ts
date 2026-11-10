// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTransaction,
  mockRawGroupBy,
  mockRollupGroupBy,
  mockRedisGet,
  mockRedisSet,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockRawGroupBy: vi.fn(),
  mockRollupGroupBy: vi.fn(),
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: { get: mockRedisGet, set: mockRedisSet },
  getScopedRedisKey: (key: string) => key,
}));

const transactionClient = {
  telemetryEvent: { groupBy: mockRawGroupBy },
  telemetryDailyRollup: { groupBy: mockRollupGroupBy },
};

let computeAggregateStats: typeof import("@/lib/services/telemetry-service").TelemetryService.computeAggregateStats;
let TelemetryService: typeof import("@/lib/services/telemetry-service").TelemetryService;
let _testCache: typeof import("@/lib/services/telemetry-service")._testCache;

describe("TelemetryService.computeAggregateStats", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("PLAYWRIGHT_TEST", "");

    const mod = await import("@/lib/services/telemetry-service");
    TelemetryService = mod.TelemetryService;
    computeAggregateStats = mod.TelemetryService.computeAggregateStats;
    _testCache = mod._testCache;
    _testCache.reset();

    vi.clearAllMocks();
    mockRawGroupBy.mockResolvedValue([]);
    mockRollupGroupBy.mockResolvedValue([]);
    mockTransaction.mockImplementation(
      async (callback: (transaction: typeof transactionClient) => unknown) =>
        callback(transactionClient)
    );
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("adds raw and daily rollup counts for matching slugs and event types", async () => {
    mockRawGroupBy.mockResolvedValue([
      { projectSlug: "/dashboard", eventType: "page_view", _count: { id: 12 } },
      {
        projectSlug: "/dashboard",
        eventType: "project_click",
        _count: { id: 7 },
      },
    ]);
    mockRollupGroupBy.mockResolvedValue([
      {
        projectSlug: "/dashboard",
        eventType: "page_view",
        _sum: { count: 3 },
      },
      {
        projectSlug: "/dashboard",
        eventType: "project_click",
        _sum: { count: 2 },
      },
    ]);

    await expect(computeAggregateStats()).resolves.toEqual({
      "/dashboard": { views: 15, clicks: 9 },
    });
  });

  it("keeps raw-only counts and includes slugs represented only in rollups", async () => {
    mockRawGroupBy.mockResolvedValue([
      { projectSlug: "/live", eventType: "page_view", _count: { id: 4 } },
    ]);
    mockRollupGroupBy.mockResolvedValue([
      {
        projectSlug: "/archived",
        eventType: "project_click",
        _sum: { count: 6 },
      },
    ]);

    await expect(computeAggregateStats()).resolves.toEqual({
      "/live": { views: 4, clicks: 0 },
      "/archived": { views: 0, clicks: 6 },
    });
  });

  it("ignores unsupported event types even if an aggregate returns them", async () => {
    mockRawGroupBy.mockResolvedValue([
      {
        projectSlug: "/dashboard",
        eventType: "route_error",
        _count: { id: 9 },
      },
      { projectSlug: "/dashboard", eventType: "page_view", _count: { id: 2 } },
    ]);
    mockRollupGroupBy.mockResolvedValue([
      {
        projectSlug: "/dashboard",
        eventType: "simulator_option_select",
        _sum: { count: 11 },
      },
      {
        projectSlug: "/dashboard",
        eventType: "project_click",
        _sum: { count: 3 },
      },
    ]);

    await expect(computeAggregateStats()).resolves.toEqual({
      "/dashboard": { views: 2, clicks: 3 },
    });
  });

  it("uses two grouped queries in one RepeatableRead transaction", async () => {
    await computeAggregateStats();

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction.mock.calls[0]?.[1]).toEqual({
      isolationLevel: "RepeatableRead",
    });
    expect(mockRawGroupBy).toHaveBeenCalledTimes(1);
    expect(mockRawGroupBy).toHaveBeenCalledWith({
      by: ["projectSlug", "eventType"],
      where: { eventType: { in: ["page_view", "project_click"] } },
      _count: { id: true },
    });
    expect(mockRollupGroupBy).toHaveBeenCalledTimes(1);
    expect(mockRollupGroupBy).toHaveBeenCalledWith({
      by: ["projectSlug", "eventType"],
      where: { eventType: { in: ["page_view", "project_click"] } },
      _sum: { count: true },
    });
  });

  it.each(["raw events", "daily rollups"] as const)(
    "rejects when the %s aggregate fails",
    async (aggregate) => {
      const failure = new Error(`${aggregate} query failed`);
      if (aggregate === "raw events") {
        mockRawGroupBy.mockRejectedValue(failure);
      } else {
        mockRollupGroupBy.mockRejectedValue(failure);
      }

      await expect(computeAggregateStats()).rejects.toThrow(failure.message);
    }
  );
});

describe("TelemetryService.getAggregateStats reads only Redis (#3201)", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("PLAYWRIGHT_TEST", "");
    const mod = await import("@/lib/services/telemetry-service");
    TelemetryService = mod.TelemetryService;
    _testCache = mod._testCache;
    _testCache.reset();
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue("OK");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("returns the stored aggregate without touching the database", async () => {
    mockRedisGet.mockResolvedValue({ "/dashboard": { views: 3, clicks: 1 } });

    await expect(TelemetryService.getAggregateStats()).resolves.toEqual({
      "/dashboard": { views: 3, clicks: 1 },
    });
    expect(mockRedisGet).toHaveBeenCalledWith("telemetry:aggregate");
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockRawGroupBy).not.toHaveBeenCalled();
  });

  it("returns the empty aggregate when the key is missing", async () => {
    await expect(TelemetryService.getAggregateStats()).resolves.toEqual({});
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns the empty aggregate when the stored value is malformed", async () => {
    mockRedisGet.mockResolvedValue({ "/dashboard": { views: "lots" } });

    await expect(TelemetryService.getAggregateStats()).resolves.toEqual({});
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("holds the Redis copy in memory for 10 seconds", async () => {
    vi.useFakeTimers();
    try {
      mockRedisGet.mockResolvedValue({ "/a": { views: 1, clicks: 0 } });
      await TelemetryService.getAggregateStats();
      await TelemetryService.getAggregateStats();
      expect(mockRedisGet).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(10_001);
      await TelemetryService.getAggregateStats();
      expect(mockRedisGet).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects when Redis cannot be read", async () => {
    mockRedisGet.mockRejectedValue(new Error("Redis down"));

    await expect(TelemetryService.getAggregateStats()).rejects.toThrow(
      "Redis down"
    );
  });
});

describe("TelemetryService.refreshAggregateStats (#3201)", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("PLAYWRIGHT_TEST", "");
    const mod = await import("@/lib/services/telemetry-service");
    TelemetryService = mod.TelemetryService;
    _testCache = mod._testCache;
    _testCache.reset();
    vi.clearAllMocks();
    mockRedisSet.mockResolvedValue("OK");
    mockRawGroupBy.mockResolvedValue([
      { projectSlug: "/dashboard", eventType: "page_view", _count: { id: 4 } },
    ]);
    mockRollupGroupBy.mockResolvedValue([
      {
        projectSlug: "/dashboard",
        eventType: "project_click",
        _sum: { count: 2 },
      },
    ]);
    mockTransaction.mockImplementation(
      async (callback: (transaction: typeof transactionClient) => unknown) =>
        callback(transactionClient)
    );
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("computes the aggregate once and writes it to the Redis key", async () => {
    const result = await TelemetryService.refreshAggregateStats();

    expect(result).toEqual({ success: true, data: { projects: 1 } });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockRedisSet).toHaveBeenCalledWith("telemetry:aggregate", {
      "/dashboard": { views: 4, clicks: 2 },
    });
  });

  it("reports AGGREGATE_FAILED and writes nothing when the query fails", async () => {
    mockRawGroupBy.mockRejectedValue(new Error("Neon asleep"));

    const result = await TelemetryService.refreshAggregateStats();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("AGGREGATE_FAILED");
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("reports AGGREGATE_FAILED when the Redis write fails", async () => {
    mockRedisSet.mockRejectedValue(new Error("Redis down"));

    const result = await TelemetryService.refreshAggregateStats();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("AGGREGATE_FAILED");
  });
});
