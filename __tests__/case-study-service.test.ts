import { describe, it, expect, vi, beforeEach } from "vitest";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import { getScopedRedisKey } from "@/lib/redis";

const { mockRedisGet, mockRedisSet, mockRedisDel, mockRedisConfigured } =
  vi.hoisted(() => ({
    mockRedisGet: vi.fn(),
    mockRedisSet: vi.fn(),
    mockRedisDel: vi.fn(),
    mockRedisConfigured: { value: true },
  }));

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudy: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/redis")>();
  return {
    ...actual,
    isRedisConfigured: () => mockRedisConfigured.value,
    redis: {
      get: mockRedisGet,
      set: mockRedisSet,
      del: mockRedisDel,
    },
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

const SUMMARY_KEYS = ["id", "primary_language", "slug", "tags", "title"];
const HEAVY_COLUMNS = [
  "editorial_content",
  "architectural_narrative",
  "commands_json",
  "playback_json",
];

const dbRow = {
  id: "cs-db-1",
  slug: "db-only-study",
  title: "DB Only Study",
  primary_language: "Rust",
  tags: "rust, systems",
};

describe("CaseStudyService.getPublishedCaseStudies projection (#1113)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisConfigured.value = true;
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue("OK");
    mockRedisDel.mockResolvedValue(1);
  });

  it("selects only the five summary columns and never the narrative or playback JSON", async () => {
    vi.mocked(prisma.caseStudy.findMany).mockResolvedValueOnce([
      dbRow,
    ] as never);

    await CaseStudyService.getPublishedCaseStudies();

    expect(prisma.caseStudy.findMany).toHaveBeenCalledTimes(1);
    const args = vi.mocked(prisma.caseStudy.findMany).mock.calls[0][0]!;
    expect(args.where).toEqual({ published: true });
    expect(args.orderBy).toEqual({ created_at: "asc" });
    expect(Object.keys(args.select ?? {}).sort()).toEqual(SUMMARY_KEYS);
    for (const column of HEAVY_COLUMNS) {
      expect(args.select).not.toHaveProperty(column);
    }
  });

  it("returns database rows first, then fallback summaries for missing slugs, with exactly five string fields each", async () => {
    const overlapping = FALLBACK_CASE_STUDIES[0];
    vi.mocked(prisma.caseStudy.findMany).mockResolvedValueOnce([
      dbRow,
      {
        id: "cs-db-2",
        slug: overlapping.slug,
        title: "Live Title",
        primary_language: "Go",
        tags: "live",
      },
    ] as never);

    const results = await CaseStudyService.getPublishedCaseStudies();

    expect(results[0]).toEqual(dbRow);
    expect(results[1]).toEqual({
      id: "cs-db-2",
      slug: overlapping.slug,
      title: "Live Title",
      primary_language: "Go",
      tags: "live",
    });
    expect(results.filter((s) => s.slug === overlapping.slug)).toHaveLength(1);
    expect(results).toHaveLength(FALLBACK_CASE_STUDIES.length + 1);

    for (const summary of results) {
      expect(Object.keys(summary).sort()).toEqual(SUMMARY_KEYS);
      for (const key of SUMMARY_KEYS) {
        expect(typeof summary[key as keyof typeof summary]).toBe("string");
      }
    }
  });

  it("matches the summaries the full read path would have produced", async () => {
    vi.mocked(prisma.caseStudy.findMany).mockResolvedValueOnce([] as never);
    const results = await CaseStudyService.getPublishedCaseStudies();

    expect(results).toEqual(
      FALLBACK_CASE_STUDIES.map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        primary_language: s.primary_language,
        tags: s.tags,
      }))
    );
  });

  it("caches the merged summaries under the dedicated search-index key", async () => {
    vi.mocked(prisma.caseStudy.findMany).mockResolvedValueOnce([
      dbRow,
    ] as never);

    const results = await CaseStudyService.getPublishedCaseStudies();

    expect(mockRedisGet).toHaveBeenCalledWith(
      getScopedRedisKey("cs:search_index")
    );
    expect(mockRedisSet).toHaveBeenCalledWith(
      getScopedRedisKey("cs:search_index"),
      results,
      { ex: 3600 }
    );
  });

  it("serves a Redis hit without querying Postgres", async () => {
    mockRedisGet.mockResolvedValueOnce([dbRow]);

    const results = await CaseStudyService.getPublishedCaseStudies();

    expect(results).toEqual([dbRow]);
    expect(prisma.caseStudy.findMany).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("falls through to Postgres when the Redis read fails", async () => {
    mockRedisGet.mockRejectedValueOnce(new Error("upstash down"));
    vi.mocked(prisma.caseStudy.findMany).mockResolvedValueOnce([
      dbRow,
    ] as never);

    const results = await CaseStudyService.getPublishedCaseStudies();

    expect(prisma.caseStudy.findMany).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual(dbRow);
  });

  it("skips Redis entirely when Upstash is not configured", async () => {
    mockRedisConfigured.value = false;
    vi.mocked(prisma.caseStudy.findMany).mockResolvedValueOnce([] as never);

    await CaseStudyService.getPublishedCaseStudies();

    expect(mockRedisGet).not.toHaveBeenCalled();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("returns fallback summaries without caching them when the database is unreachable", async () => {
    vi.mocked(prisma.caseStudy.findMany).mockRejectedValueOnce(
      new Error("Neon suspended")
    );

    const results = await CaseStudyService.getPublishedCaseStudies();

    expect(results.map((s) => s.slug)).toEqual(
      FALLBACK_CASE_STUDIES.map((s) => s.slug)
    );
    for (const summary of results) {
      expect(Object.keys(summary).sort()).toEqual(SUMMARY_KEYS);
    }
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("evicts the search-index key alongside the other case study caches", async () => {
    await CaseStudyService.evictCaseStudyCache("cadence-clinical");

    expect(mockRedisDel).toHaveBeenCalledWith(
      getScopedRedisKey("cs:search_index")
    );
    expect(mockRedisDel).toHaveBeenCalledWith(
      getScopedRedisKey("cs:all_published")
    );
  });
});
