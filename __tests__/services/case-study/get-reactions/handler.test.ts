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
