// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  ListPublishedCaseStudiesHandler,
  type RawCaseStudyRecord,
} from "@/lib/services";

describe("ListPublishedCaseStudiesHandler (Logic Test)", () => {
  it("merges published DB records with static fallback case studies", async () => {
    const dbRecord = fromPartial<RawCaseStudyRecord>({
      id: "db-1",
      slug: "db-only-study",
      title: "DB Only Study",
      primary_language: "TypeScript",
      editorial_content: "Editorial",
      architectural_narrative: "Narrative",
      tags: "ts",
      github_url: "https://github.com/fderuiter/db-only",
      published: true,
      simulated_telemetry: false,
      hero_image_url: null,
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-01T00:00:00Z"),
    });
    const handler = new ListPublishedCaseStudiesHandler({
      caseStudies: { findMany: vi.fn().mockResolvedValue([dbRecord]) },
    });

    const result = await handler.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.some((s) => s.slug === "db-only-study")).toBe(true);
    }
  });

  it("degrades to static fallbacks when DB query throws", async () => {
    const handler = new ListPublishedCaseStudiesHandler({
      caseStudies: {
        findMany: vi.fn().mockRejectedValue(new Error("DB error")),
      },
    });
    const result = await handler.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBeGreaterThan(0);
    }
  });
});
