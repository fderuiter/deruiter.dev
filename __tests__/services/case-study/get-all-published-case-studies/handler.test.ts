// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  GetAllPublishedCaseStudiesHandler,
  type CaseStudyDbRowLike,
  type GetAllPublishedCaseStudiesDeps,
} from "@/lib/services";

describe("GetAllPublishedCaseStudiesHandler (Logic Test)", () => {
  it("merges database published case studies with static fallback studies", async () => {
    const row = fromPartial<CaseStudyDbRowLike>({
      id: "cs-db-1",
      slug: "db-only-study",
      title: "DB Only Study",
      primary_language: "Rust",
      editorial_content: "<p>Editorial</p>",
      architectural_narrative: "<p>Narrative</p>",
      tags: "rust,systems",
      github_url: null,
      published: true,
      simulated_telemetry: false,
      hero_image_url: null,
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-02T00:00:00Z"),
    });
    const deps = fromPartial<GetAllPublishedCaseStudiesDeps>({
      isRedisReady: () => false,
      db: {
        caseStudy: {
          findMany: async () => [row],
        },
      },
    });

    const handler = new GetAllPublishedCaseStudiesHandler(deps);
    const result = await handler.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.some((s) => s.slug === "db-only-study")).toBe(true);
    }
  });

  it("returns INVALID_INPUT when given invalid non-object input", async () => {
    const handler = new GetAllPublishedCaseStudiesHandler();
    const result = await handler.execute(fromAny("bad-input"));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
