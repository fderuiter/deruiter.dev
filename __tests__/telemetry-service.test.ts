import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { mockTransaction, mockRawGroupBy, mockRollupGroupBy } = vi.hoisted(
  () => ({
    mockTransaction: vi.fn(),
    mockRawGroupBy: vi.fn(),
    mockRollupGroupBy: vi.fn(),
  })
);

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mockTransaction,
  },
}));

const transactionClient = {
  telemetryEvent: { groupBy: mockRawGroupBy },
  telemetryDailyRollup: { groupBy: mockRollupGroupBy },
};

let getAggregateStats: typeof import("@/lib/services/telemetry-service").TelemetryService.getAggregateStats;
let TelemetryService: typeof import("@/lib/services/telemetry-service").TelemetryService;
let _testCache: typeof import("@/lib/services/telemetry-service")._testCache;

describe("TelemetryService.getAggregateStats", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("PLAYWRIGHT_TEST", "");

    const mod = await import("@/lib/services/telemetry-service");
    TelemetryService = mod.TelemetryService;
    getAggregateStats = mod.TelemetryService.getAggregateStats;
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

  it("returns cached statistics when called within 10 seconds without executing new database queries", async () => {
    mockRawGroupBy.mockResolvedValue([
      { projectSlug: "/dashboard", eventType: "page_view", _count: { id: 10 } },
    ]);

    const stats1 = await getAggregateStats();
    expect(stats1).toEqual({ "/dashboard": { views: 10, clicks: 0 } });
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    mockRawGroupBy.mockResolvedValue([
      { projectSlug: "/dashboard", eventType: "page_view", _count: { id: 99 } },
    ]);

    const stats2 = await getAggregateStats();
    expect(stats2).toEqual({ "/dashboard": { views: 10, clicks: 0 } });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("re-queries the database after the 10-second cache TTL expires", async () => {
    vi.useFakeTimers();
    try {
      mockRawGroupBy.mockResolvedValue([
        {
          projectSlug: "/dashboard",
          eventType: "page_view",
          _count: { id: 10 },
        },
      ]);

      const stats1 = await getAggregateStats();
      expect(stats1).toEqual({ "/dashboard": { views: 10, clicks: 0 } });
      expect(mockTransaction).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(10001);

      mockRawGroupBy.mockResolvedValue([
        {
          projectSlug: "/dashboard",
          eventType: "page_view",
          _count: { id: 25 },
        },
      ]);

      const stats2 = await getAggregateStats();
      expect(stats2).toEqual({ "/dashboard": { views: 25, clicks: 0 } });
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-queries the database when the cache is cleared via test utility", async () => {
    mockRawGroupBy.mockResolvedValue([
      { projectSlug: "/dashboard", eventType: "page_view", _count: { id: 5 } },
    ]);

    await getAggregateStats();
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    TelemetryService.clearAggregateCache();

    mockRawGroupBy.mockResolvedValue([
      { projectSlug: "/dashboard", eventType: "page_view", _count: { id: 15 } },
    ]);

    const refreshedStats = await getAggregateStats();
    expect(refreshedStats).toEqual({ "/dashboard": { views: 15, clicks: 0 } });
    expect(mockTransaction).toHaveBeenCalledTimes(2);
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

    await expect(getAggregateStats()).resolves.toEqual({
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

    await expect(getAggregateStats()).resolves.toEqual({
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

    await expect(getAggregateStats()).resolves.toEqual({
      "/dashboard": { views: 2, clicks: 3 },
    });
  });

  it("uses two grouped queries in one RepeatableRead transaction", async () => {
    await getAggregateStats();

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

      await expect(getAggregateStats()).rejects.toThrow(failure.message);
    }
  );
});
