// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GetCaseStudyBySlugHandler,
  type CaseStudyDbRowLike,
  type GetCaseStudyBySlugDeps,
} from "@/lib/services";

describe("GetCaseStudyBySlugHandler (Logic Test)", () => {
  it("returns published case study from database when Redis cache misses", async () => {
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
      isRedisReady: () => false,
      db: {
        caseStudy: {
          findUnique: async () => row,
        },
      },
    });

    const handler = new GetCaseStudyBySlugHandler(deps);
    const result = await handler.execute({ slug: "custom-study" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.slug).toBe("custom-study");
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
});
