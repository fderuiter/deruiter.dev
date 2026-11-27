// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GetCaseStudyReactionsHandler } from "@/lib/services";

describe("GetCaseStudyReactionsHandler (Logic Test)", () => {
  it("returns base counts when Redis is unconfigured", async () => {
    const handler = new GetCaseStudyReactionsHandler({
      getBaseCounts: vi.fn().mockResolvedValue({
        insightful: 3,
        mind_blowing: 1,
        actionable: 2,
        thorough: 0,
      }),
    });

    const result = await handler.execute({
      slug: "crf-studio",
      connectionHash: "conn-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(3);
    }
  });

  it("returns INVALID_REACTION_QUERY on empty slug", async () => {
    const handler = new GetCaseStudyReactionsHandler();
    const result = await handler.execute({ slug: "", connectionHash: "c1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_REACTION_QUERY");
    }
  });
});
