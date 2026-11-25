// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  UpdateCaseStudyImageHandler,
  type RawCaseStudyRecord,
} from "@/lib/services";

describe("UpdateCaseStudyImageHandler (Logic Test)", () => {
  it("updates existing case study hero_image_url and evicts cache", async () => {
    const existing = fromPartial<RawCaseStudyRecord>({
      id: "cs-1",
      slug: "crf-studio",
      title: "CRF Studio",
      primary_language: "TypeScript",
      editorial_content: "E",
      architectural_narrative: "A",
      tags: "ts",
      github_url: "https://github.com/fderuiter/crf",
      published: true,
      simulated_telemetry: false,
      hero_image_url: null,
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-01T00:00:00Z"),
    });
    const updated = {
      ...existing,
      hero_image_url: "/api/media/projects/crf-studio/hero.png",
    };
    const evictCache = vi.fn().mockResolvedValue({});

    const handler = new UpdateCaseStudyImageHandler({
      caseStudies: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(updated),
        create: vi.fn(),
      },
      evictCache,
    });

    const result = await handler.execute({
      slug: "crf-studio",
      heroImageUrl: "/api/media/projects/crf-studio/hero.png",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hero_image_url).toBe(
        "/api/media/projects/crf-studio/hero.png"
      );
    }
    expect(evictCache).toHaveBeenCalledWith("crf-studio");
  });

  it("returns CASE_STUDY_NOT_FOUND for unknown non-fallback slug", async () => {
    const handler = new UpdateCaseStudyImageHandler({
      caseStudies: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        create: vi.fn(),
      },
    });
    const result = await handler.execute({
      slug: "unknown-nonexistent-slug",
      heroImageUrl: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CASE_STUDY_NOT_FOUND");
    }
  });
});
