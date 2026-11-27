// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ListCaseStudySummariesHandler } from "@/lib/services";

describe("ListCaseStudySummariesHandler (Logic Test)", () => {
  it("merges DB summaries with static fallback summaries", async () => {
    const handler = new ListCaseStudySummariesHandler({
      caseStudies: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "db-1",
            slug: "db-study",
            title: "DB Study",
            primary_language: "Rust",
            tags: "rust, systems",
          },
        ]),
      },
    });

    const result = await handler.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.some((s) => s.slug === "db-study")).toBe(true);
    }
  });

  it("falls back to static summaries when DB throws", async () => {
    const handler = new ListCaseStudySummariesHandler({
      caseStudies: {
        findMany: vi.fn().mockRejectedValue(new Error("DB offline")),
      },
    });
    const result = await handler.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBeGreaterThan(0);
    }
  });
});
