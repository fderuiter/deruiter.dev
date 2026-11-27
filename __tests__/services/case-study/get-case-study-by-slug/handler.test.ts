// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  GetCaseStudyBySlugHandler,
  type RawCaseStudyRecord,
} from "@/lib/services";

describe("GetCaseStudyBySlugHandler (Logic Test)", () => {
  it("returns mapped published case study from repository", async () => {
    const record = fromPartial<RawCaseStudyRecord>({
      id: "cs-1",
      slug: "custom-study",
      title: "Custom Study",
      primary_language: "TypeScript",
      editorial_content: "Editorial",
      architectural_narrative: "Narrative",
      tags: "ts",
      github_url: "https://github.com/fderuiter/custom-study",
      published: true,
      simulated_telemetry: false,
      hero_image_url: null,
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-01T00:00:00Z"),
    });
    const handler = new GetCaseStudyBySlugHandler({
      caseStudies: { findUnique: vi.fn().mockResolvedValue(record) },
    });

    const result = await handler.execute({ slug: "custom-study" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.slug).toBe("custom-study");
    }
  });

  it("returns INVALID_CASE_STUDY_SLUG on blank slug", async () => {
    const handler = new GetCaseStudyBySlugHandler({
      caseStudies: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const result = await handler.execute({ slug: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_CASE_STUDY_SLUG");
    }
  });
});
