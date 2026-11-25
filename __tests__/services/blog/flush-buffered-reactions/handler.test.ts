// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  FlushBlogReactionsHandler,
  type BufferedBlogReactionEvent,
  type FlushBlogReactionsDeps,
} from "@/lib/services";

describe("FlushBlogReactionsHandler (Logic Test)", () => {
  it("writes buffered blog reactions to Postgres, acknowledges queue, and hydrates counts", async () => {
    const event: BufferedBlogReactionEvent = {
      id: "br-1",
      blogPostSlug: "post-1",
      reactionType: "insightful",
      connectionHash: "hash-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const hydrateExecute = vi.fn(async () => ({
      success: true as const,
      data: { counts: { insightful: 1 } },
    }));
    const deps = fromPartial<FlushBlogReactionsDeps>({
      isRedisReady: () => true,
      hydrateHandler: { execute: hydrateExecute },
      redisClient: {
        lrange: async () => fromAny([event]),
        llen: async () => 0,
        hgetall: async () => null,
        srem: async () => 1,
        set: async () => "OK",
        pipeline: () => ({
          lmove: () => undefined,
          expire: () => undefined,
          lrem: () => undefined,
          hincrby: () => undefined,
          del: () => undefined,
          exec: async () => [],
        }),
      },
      db: {
        blogPostReaction: {
          createMany: async () => ({ count: 1 }),
          groupBy: async () => [],
        },
      },
    });

    const handler = new FlushBlogReactionsHandler(deps);
    const result = await handler.execute({ batchSize: 10 });
    expect(result).toEqual({
      success: true,
      data: { processed: 1, inserted: 1 },
    });
    expect(hydrateExecute).toHaveBeenCalledWith({ slug: "post-1" });
  });

  it("returns PERSISTENCE_FAILED when PostgreSQL createMany throws", async () => {
    const event: BufferedBlogReactionEvent = {
      id: "br-2",
      blogPostSlug: "post-1",
      reactionType: "insightful",
      connectionHash: "hash-2",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const deps = fromPartial<FlushBlogReactionsDeps>({
      isRedisReady: () => true,
      redisClient: {
        lrange: async () => fromAny([event]),
        llen: async () => 0,
      },
      db: {
        blogPostReaction: {
          createMany: async () => {
            throw new Error("DB write failure");
          },
          groupBy: async () => [],
        },
      },
    });

    const handler = new FlushBlogReactionsHandler(deps);
    const result = await handler.execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PERSISTENCE_FAILED");
    }
  });
});
