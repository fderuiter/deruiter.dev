// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  SubmitCaseStudyReactionHandler,
  type SubmitCaseStudyReactionDeps,
} from "@/lib/services";

describe("SubmitCaseStudyReactionHandler (Logic Test)", () => {
  it("returns INVALID_INPUT when caseStudySlug is blank", async () => {
    const handler = new SubmitCaseStudyReactionHandler();
    const result = await handler.execute({
      caseStudySlug: "",
      reactionType: "insightful",
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("persists directly to PostgreSQL when Redis is unconfigured", async () => {
    const deps = fromPartial<SubmitCaseStudyReactionDeps>({
      isRedisReady: () => false,
      db: {
        caseStudyReaction: {
          createMany: async () => ({ count: 1 }),
          groupBy: async () => [
            { reactionType: "insightful", _count: { id: 3 } },
          ],
          findMany: async () => [{ reactionType: "insightful" }],
        },
      },
    });

    const handler = new SubmitCaseStudyReactionHandler(deps);
    const result = await handler.execute({
      caseStudySlug: "crf",
      reactionType: "insightful",
      connectionHash: "hash-1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(3);
      expect(result.data.userReactions).toEqual(["insightful"]);
    }
  });

  it("buffers new reaction via Redis pipeline and merges base + buffered counts", async () => {
    const exec = vi.fn(async () => []);
    const deps = fromPartial<SubmitCaseStudyReactionDeps>({
      isRedisReady: () => true,
      idGenerator: () => "evt-cs-1",
      redisClient: {
        sismember: async () => 0,
        pipeline: () => ({
          sadd: vi.fn(),
          expire: vi.fn(),
          hincrby: vi.fn(),
          rpush: vi.fn(),
          exec,
        }),
        smembers: async () => [],
        get: async () => fromAny({ insightful: 2 }),
        set: async () => "OK",
        hgetall: async () => fromAny({ insightful: "3" }),
      },
    });

    const handler = new SubmitCaseStudyReactionHandler(deps);
    const result = await handler.execute({
      caseStudySlug: "crf",
      reactionType: "insightful",
      connectionHash: "hash-1",
    });

    expect(result.success).toBe(true);
    expect(exec).toHaveBeenCalledTimes(1);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(5);
      expect(result.data.userReactions).toEqual(["insightful"]);
    }
  });

  it("skips pipeline write when Redis sismember detects existing reaction", async () => {
    const pipeline = vi.fn();
    const deps = fromPartial<SubmitCaseStudyReactionDeps>({
      isRedisReady: () => true,
      redisClient: {
        sismember: async () => 1,
        pipeline,
        smembers: async () => ["insightful"],
        get: async () => fromAny({ insightful: 4 }),
        set: async () => "OK",
        hgetall: async () => fromAny({ insightful: 1 }),
      },
    });

    const handler = new SubmitCaseStudyReactionHandler(deps);
    const result = await handler.execute({
      caseStudySlug: "crf",
      reactionType: "insightful",
      connectionHash: "hash-1",
    });

    expect(result.success).toBe(true);
    expect(pipeline).not.toHaveBeenCalled();
    if (result.success) {
      expect(result.data.counts.insightful).toBe(5);
      expect(result.data.userReactions).toEqual(["insightful"]);
    }
  });

  it("falls back to direct PostgreSQL persistence when Redis throws", async () => {
    const deps = fromPartial<SubmitCaseStudyReactionDeps>({
      isRedisReady: () => true,
      redisClient: {
        sismember: async () => {
          throw new Error("Redis offline");
        },
      },
      db: {
        caseStudyReaction: {
          createMany: async () => ({ count: 1 }),
          groupBy: async () => [
            { reactionType: "insightful", _count: { id: 2 } },
          ],
          findMany: async () => [{ reactionType: "insightful" }],
        },
      },
    });

    const handler = new SubmitCaseStudyReactionHandler(deps);
    const result = await handler.execute({
      caseStudySlug: "crf",
      reactionType: "insightful",
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts.insightful).toBe(2);
    }
  });

  it("returns STORAGE_UNAVAILABLE when both Redis and PostgreSQL fail", async () => {
    const deps = fromPartial<SubmitCaseStudyReactionDeps>({
      isRedisReady: () => false,
      db: {
        caseStudyReaction: {
          createMany: async () => {
            throw new Error("Postgres connection lost");
          },
          groupBy: async () => [],
          findMany: async () => [],
        },
      },
    });

    const handler = new SubmitCaseStudyReactionHandler(deps);
    const result = await handler.execute({
      caseStudySlug: "crf",
      reactionType: "insightful",
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
