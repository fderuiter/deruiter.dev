// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  GetPublishedCaseStudiesHandler,
  type CaseStudySearchSummary,
  type GetPublishedCaseStudiesDeps,
} from "@/lib/services";

describe("GetPublishedCaseStudiesHandler (Logic Test)", () => {
  it("returns cached search summaries on Redis hit without querying DB", async () => {
    const cached: CaseStudySearchSummary[] = [
      {
        id: "cached-1",
        slug: "cached-study",
        title: "Cached Study",
        primary_language: "Rust",
        tags: "rust",
      },
    ];
    const findMany = vi.fn(async () => []);
    const deps = fromPartial<GetPublishedCaseStudiesDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () => fromAny(cached),
        set: async () => "OK",
      },
      db: {
        caseStudy: { findMany },
      },
    });

    const handler = new GetPublishedCaseStudiesHandler(deps);
    const result = await handler.execute();
    expect(result.success).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
    if (result.success) {
      expect(result.data).toEqual(cached);
    }
  });

  it("returns lightweight search summaries merged with static fallbacks and populates Redis", async () => {
    const setSpy = vi.fn(async () => "OK");
    const deps = fromPartial<GetPublishedCaseStudiesDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () => {
          throw new Error("Redis miss");
        },
        set: setSpy,
      },
      db: {
        caseStudy: {
          findMany: async () => [
            {
              id: "search-1",
              slug: "search-study",
              title: "Search Study",
              primary_language: "Go",
              tags: "go,search",
            },
          ],
        },
      },
    });

    const handler = new GetPublishedCaseStudiesHandler(deps);
    const result = await handler.execute();
    expect(result.success).toBe(true);
    expect(setSpy).toHaveBeenCalledTimes(1);
    if (result.success) {
      expect(result.data.some((s) => s.slug === "search-study")).toBe(true);
    }
  });

  it("returns static fallbacks when database query fails", async () => {
    const deps = fromPartial<GetPublishedCaseStudiesDeps>({
      isRedisReady: () => false,
      db: {
        caseStudy: {
          findMany: async () => {
            throw new Error("DB connection failed");
          },
        },
      },
    });

    const handler = new GetPublishedCaseStudiesHandler(deps);
    const result = await handler.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBeGreaterThan(0);
    }
  });

  it("returns INVALID_INPUT for invalid input payload", async () => {
    const handler = new GetPublishedCaseStudiesHandler();
    const result = await handler.execute(fromAny("invalid"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
