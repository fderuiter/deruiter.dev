// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  FlushCaseStudyReactionsHandler,
  type BufferedReactionEvent,
  type FlushCaseStudyReactionsDeps,
} from "@/lib/services";

describe("FlushCaseStudyReactionsHandler (Logic Test)", () => {
  it("persists buffered reaction events to PostgreSQL and acknowledges Redis queue", async () => {
    const event: BufferedReactionEvent = {
      id: "evt-1",
      caseStudySlug: "crf",
      reactionType: "insightful",
      connectionHash: "hash-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const createMany = vi.fn(async () => ({ count: 1 }));
    const exec = vi.fn(async () => []);
    const deps = fromPartial<FlushCaseStudyReactionsDeps>({
      isRedisReady: () => true,
      redisClient: {
        lrange: async () => fromAny([event]),
        llen: async () => 0,
        hgetall: async () => null,
        hdel: async () => 0,
        del: async () => 1,
        srem: async () => 1,
        pipeline: () => ({
          lmove: () => undefined,
          expire: () => undefined,
          lrem: () => undefined,
          hincrby: () => undefined,
          del: () => undefined,
          exec,
        }),
      },
      db: {
        caseStudyReaction: {
          createMany,
        },
      },
    });

    const handler = new FlushCaseStudyReactionsHandler(deps);
    const result = await handler.execute({ batchSize: 10 });

    expect(result).toEqual({
      success: true,
      data: { processed: 1, inserted: 1 },
    });
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("returns PERSISTENCE_FAILED when PostgreSQL createMany throws", async () => {
    const event: BufferedReactionEvent = {
      id: "evt-2",
      caseStudySlug: "crf",
      reactionType: "insightful",
      connectionHash: "hash-2",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const deps = fromPartial<FlushCaseStudyReactionsDeps>({
      isRedisReady: () => true,
      redisClient: {
        lrange: async () => fromAny([event]),
        llen: async () => 0,
      },
      db: {
        caseStudyReaction: {
          createMany: async () => {
            throw new Error("DB unavailable");
          },
        },
      },
    });

    const handler = new FlushCaseStudyReactionsHandler(deps);
    const result = await handler.execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PERSISTENCE_FAILED");
    }
  });
});
