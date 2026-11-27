// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GetBlogReactionsHandler } from "@/lib/services";

describe("GetBlogReactionsHandler (Logic Test)", () => {
  it("returns base reaction counts for a blog post", async () => {
    const handler = new GetBlogReactionsHandler({
      getBaseCounts: vi.fn().mockResolvedValue({
        insightful: 5,
        mind_blowing: 2,
        actionable: 1,
        thorough: 0,
      }),
    });

    const result = await handler.execute({
      slug: "post-1",
      connectionHash: "conn-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(5);
    }
  });

  it("returns INVALID_REACTION_QUERY on empty slug", async () => {
    const handler = new GetBlogReactionsHandler();
    const result = await handler.execute({ slug: "", connectionHash: "c1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_REACTION_QUERY");
    }
  });
});
