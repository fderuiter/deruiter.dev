// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  SubmitCaseStudyReactionHandler,
  type SubmitCaseStudyReactionDeps,
} from "@/lib/services";

describe("SubmitCaseStudyReactionHandler (Logic Test)", () => {
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
