// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  FALLBACK_CASE_STUDIES,
  type CaseStudyData,
} from "@/lib/case-studies-data";
import {
  GetCaseStudyBySlugHandler,
  type CaseStudyDbRowLike,
  type GetCaseStudyBySlugDeps,
} from "@/lib/services";

describe("GetCaseStudyBySlugHandler (Logic Test)", () => {
  it("returns INVALID_INPUT when slug is not a string", async () => {
    const handler = new GetCaseStudyBySlugHandler();
    const result = await handler.execute(fromAny({ slug: 123 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("returns cached case study with hydrated Date fields on Redis hit", async () => {
    const cached = fromPartial<CaseStudyData>({
      id: "cs-cached",
      slug: "cached-study",
      title: "Cached Study",
      published: true,
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-02T00:00:00Z"),
    });
    const deps = fromPartial<GetCaseStudyBySlugDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () => fromAny(cached),
        set: async () => "OK",
      },
    });

    const handler = new GetCaseStudyBySlugHandler(deps);
    const result = await handler.execute({ slug: "cached-study" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.slug).toBe("cached-study");
      expect(result.data?.created_at).toBeInstanceOf(Date);
    }
  });

  it("returns published case study from database and writes to Redis when cache misses", async () => {
    const setSpy = vi.fn(async () => "OK");
    const row = fromPartial<CaseStudyDbRowLike>({
      id: "cs-1",
      slug: "custom-study",
      title: "Custom Case Study",
      primary_language: "TypeScript",
      editorial_content: "<p>Editorial</p>",
      architectural_narrative: "<p>Architecture</p>",
      tags: "ts,arch",
      github_url: null,
      published: true,
      simulated_telemetry: false,
      hero_image_url: null,
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-02T00:00:00Z"),
    });
    const deps = fromPartial<GetCaseStudyBySlugDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () => null,
        set: setSpy,
      },
      db: {
        caseStudy: {
          findUnique: async () => row,
        },
      },
    });

    const handler = new GetCaseStudyBySlugHandler(deps);
    const result = await handler.execute({ slug: "custom-study" });
    expect(result.success).toBe(true);
    expect(setSpy).toHaveBeenCalledTimes(1);
    if (result.success) {
      expect(result.data?.slug).toBe("custom-study");
    }
  });

  it("tolerates Redis read/write errors and resolves static fallback when DB misses", async () => {
    const fallbackSlug = FALLBACK_CASE_STUDIES[0]!.slug;
    const deps = fromPartial<GetCaseStudyBySlugDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () => {
          throw new Error("Redis unavailable");
        },
        set: async () => {
          throw new Error("Redis write failed");
        },
      },
      db: {
        caseStudy: {
          findUnique: async () => null,
        },
      },
    });

    const handler = new GetCaseStudyBySlugHandler(deps);
    const result = await handler.execute({ slug: fallbackSlug });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.slug).toBe(fallbackSlug);
    }
  });

  it("returns STORAGE_UNAVAILABLE when DB fails and allowFallbackOnError is false", async () => {
    const deps = fromPartial<GetCaseStudyBySlugDeps>({
      isRedisReady: () => false,
      db: {
        caseStudy: {
          findUnique: async () => {
            throw new Error("Connection refused");
          },
        },
      },
    });

    const handler = new GetCaseStudyBySlugHandler(deps);
    const result = await handler.execute({
      slug: "custom-study",
      allowFallbackOnError: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });

  it("falls back to static case studies when DB throws and allowFallbackOnError is true", async () => {
    const fallbackSlug = FALLBACK_CASE_STUDIES[0]!.slug;
    const deps = fromPartial<GetCaseStudyBySlugDeps>({
      isRedisReady: () => false,
      db: {
        caseStudy: {
          findUnique: async () => {
            throw new Error("Connection refused");
          },
        },
      },
    });

    const handler = new GetCaseStudyBySlugHandler(deps);
    const hit = await handler.execute({ slug: fallbackSlug });
    expect(hit.success).toBe(true);
    if (hit.success) {
      expect(hit.data?.slug).toBe(fallbackSlug);
    }

    const miss = await handler.execute({ slug: "non-existent-slug" });
    expect(miss.success).toBe(true);
    if (miss.success) {
      expect(miss.data).toBeNull();
    }
  });
});
