// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  GetBlogReactionsHandler,
  type GetBlogReactionsDeps,
} from "@/lib/services";

describe("GetBlogReactionsHandler (Logic Test)", () => {
  it("reads Zero-Wake Redis base counts, buffered increments, and user set", async () => {
    const deps = fromPartial<GetBlogReactionsDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () => fromAny({ insightful: 5 }),
        hgetall: async () => fromAny({ insightful: 2 }),
        smembers: async () => ["insightful"],
      },
    });

    const handler = new GetBlogReactionsHandler(deps);
    const result = await handler.execute({
      slug: "post-1",
      connectionHash: "hash-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(7);
      expect(result.data.userReactions).toEqual(["insightful"]);
    }
  });

  it("returns zeroed counts without waking PostgreSQL when Redis is disabled", async () => {
    const handler = new GetBlogReactionsHandler({
      isRedisReady: () => false,
    });
    const result = await handler.execute({
      slug: "post-1",
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(0);
      expect(result.data.userReactions).toEqual([]);
    }
  });
});
