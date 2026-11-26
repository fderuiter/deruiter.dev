// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  GetCaseStudyReactionsHandler,
  type GetCaseStudyReactionsDeps,
} from "@/lib/services";

describe("GetCaseStudyReactionsHandler (Logic Test)", () => {
  it("merges cached base counts with buffered Redis increments and user reactions", async () => {
    const deps = fromPartial<GetCaseStudyReactionsDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () =>
          fromAny({
            insightful: 4,
            mind_blowing: 0,
            actionable: 1,
            thorough: 2,
          }),
        set: async () => "OK",
        hgetall: async () => fromAny({ insightful: 2 }),
        smembers: async () => ["insightful"],
      },
    });

    const handler = new GetCaseStudyReactionsHandler(deps);
    const result = await handler.execute({
      slug: "crf",
      connectionHash: "hash-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(6);
      expect(result.data.userReactions).toEqual(["insightful"]);
    }
  });

  it("reads base counts without Redis buffer when Redis is unconfigured", async () => {
    const deps = fromPartial<GetCaseStudyReactionsDeps>({
      isRedisReady: () => false,
      db: {
        caseStudyReaction: {
          groupBy: async () => [
            { reactionType: "insightful", _count: { id: 2 } },
          ],
          findMany: async () => [],
        },
      },
    });

    const handler = new GetCaseStudyReactionsHandler(deps);
    const result = await handler.execute({
      slug: "crf",
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(2);
      expect(result.data.userReactions).toEqual([]);
    }
  });

  it("falls back to PostgreSQL groupBy and findMany when Redis buffer read fails", async () => {
    const deps = fromPartial<GetCaseStudyReactionsDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () => fromAny({ insightful: 1 }),
        set: async () => "OK",
        hgetall: async () => {
          throw new Error("Redis buffer failure");
        },
        smembers: async () => [],
      },
      db: {
        caseStudyReaction: {
          groupBy: async () => [
            { reactionType: "insightful", _count: { id: 5 } },
          ],
          findMany: async () => [{ reactionType: "insightful" }],
        },
      },
    });

    const handler = new GetCaseStudyReactionsHandler(deps);
    const result = await handler.execute({
      slug: "crf",
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(5);
      expect(result.data.userReactions).toEqual(["insightful"]);
    }
  });

  it("returns default zero counts when both Redis and PostgreSQL fail", async () => {
    const deps = fromPartial<GetCaseStudyReactionsDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () => fromAny({ insightful: 1 }),
        set: async () => "OK",
        hgetall: async () => {
          throw new Error("Redis down");
        },
        smembers: async () => [],
      },
      db: {
        caseStudyReaction: {
          groupBy: async () => {
            throw new Error("DB down");
          },
          findMany: async () => [],
        },
      },
    });

    const handler = new GetCaseStudyReactionsHandler(deps);
    const result = await handler.execute({
      slug: "crf",
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(0);
      expect(result.data.userReactions).toEqual([]);
    }
  });

  it("returns INVALID_INPUT when slug is empty", async () => {
    const handler = new GetCaseStudyReactionsHandler();
    const result = await handler.execute({
      slug: "",
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
