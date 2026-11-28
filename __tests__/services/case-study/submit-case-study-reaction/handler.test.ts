// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { SubmitCaseStudyReactionHandler } from "@/lib/services";

describe("SubmitCaseStudyReactionHandler (Logic Test)", () => {
  it("writes directly to Postgres when Redis is unconfigured and surfaces STORAGE_UNAVAILABLE on DB failure", async () => {
    const okHandler = new SubmitCaseStudyReactionHandler({
      reactions: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        groupBy: vi
          .fn()
          .mockResolvedValue([
            { reactionType: "insightful", _count: { id: 1 } },
          ]),
        findMany: vi.fn().mockResolvedValue([{ reactionType: "insightful" }]),
      },
    });

    const ok = await okHandler.execute({
      caseStudySlug: "crf-studio",
      reactionType: "insightful",
      connectionHash: "conn-1",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.durable).toBe(true);
      expect(ok.data.counts.insightful).toBe(1);
    }

    const outageHandler = new SubmitCaseStudyReactionHandler({
      reactions: {
        createMany: vi.fn().mockRejectedValue(new Error("DB down")),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
    });
    const outage = await outageHandler.execute({
      caseStudySlug: "crf-studio",
      reactionType: "insightful",
      connectionHash: "conn-1",
    });
    expect(outage.success).toBe(false);
    if (!outage.success) {
      expect(outage.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });

  it("returns durable: false when falling back to an injected volatile Map store", async () => {
    const fallbackStore = new Map<string, Set<string>>();
    const fallbackHandler = new SubmitCaseStudyReactionHandler({
      reactions: {
        createMany: vi.fn().mockRejectedValue(new Error("DB down")),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      fallbackStore,
    });

    const result = await fallbackHandler.execute({
      caseStudySlug: "crf-studio",
      reactionType: "thorough",
      connectionHash: "conn-volatile",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.durable).toBe(false);
      expect(result.data.counts.thorough).toBe(1);
      expect(result.data.userReactions).toEqual(["thorough"]);
    }
  });
});
