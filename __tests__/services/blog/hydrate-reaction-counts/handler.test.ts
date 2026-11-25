// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  HydrateBlogReactionCountsHandler,
  type HydrateBlogReactionCountsDeps,
} from "@/lib/services";

describe("HydrateBlogReactionCountsHandler (Logic Test)", () => {
  it("aggregates PostgreSQL reaction counts and writes snapshot to Redis", async () => {
    const set = vi.fn(async () => "OK");
    const deps = fromPartial<HydrateBlogReactionCountsDeps>({
      isRedisReady: () => true,
      redisClient: { set },
      db: {
        blogPostReaction: {
          groupBy: async () => [
            { reactionType: "insightful", _count: { id: 9 } },
          ],
        },
      },
    });

    const handler = new HydrateBlogReactionCountsHandler(deps);
    const result = await handler.execute({ slug: "post-1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(9);
    }
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("returns INVALID_INPUT when slug is empty", async () => {
    const handler = new HydrateBlogReactionCountsHandler();
    const result = await handler.execute({ slug: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
