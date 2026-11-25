// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  UpdateCaseStudyImageHandler,
  type CaseStudyDbRowLike,
  type UpdateCaseStudyImageDeps,
} from "@/lib/services";

describe("UpdateCaseStudyImageHandler (Logic Test)", () => {
  it("updates existing case study hero_image_url and evicts cache", async () => {
    const row = fromPartial<CaseStudyDbRowLike>({
      id: "cs-1",
      slug: "existing-slug",
      title: "Existing",
      primary_language: "TypeScript",
      editorial_content: "<p>A</p>",
      architectural_narrative: "<p>B</p>",
      tags: "ts",
      github_url: null,
      published: true,
      simulated_telemetry: false,
      hero_image_url: "/api/media/new.webp",
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-02T00:00:00Z"),
    });
    const evictExecute = vi.fn(async () => ({
      success: true as const,
      data: { evicted: true },
    }));
    const deps = fromPartial<UpdateCaseStudyImageDeps>({
      evictCacheHandler: { execute: evictExecute },
      db: {
        caseStudy: {
          findUnique: async () => row,
          update: async () => row,
          create: async () => row,
        },
      },
    });

    const handler = new UpdateCaseStudyImageHandler(deps);
    const result = await handler.execute({
      slug: "existing-slug",
      heroImageUrl: "/api/media/new.webp",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hero_image_url).toBe("/api/media/new.webp");
    }
    expect(evictExecute).toHaveBeenCalledWith({ slug: "existing-slug" });
  });

  it("returns CASE_STUDY_NOT_FOUND for unknown slug absent from DB and fallback list", async () => {
    const deps = fromPartial<UpdateCaseStudyImageDeps>({
      db: {
        caseStudy: {
          findUnique: async () => null,
          update: async () => {
            throw new Error("unused");
          },
          create: async () => {
            throw new Error("unused");
          },
        },
      },
    });

    const handler = new UpdateCaseStudyImageHandler(deps);
    const result = await handler.execute({
      slug: "nonexistent-case-study-xyz",
      heroImageUrl: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CASE_STUDY_NOT_FOUND");
    }
  });
});
