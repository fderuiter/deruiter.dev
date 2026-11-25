// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  SubmitCaseStudyFeedbackHandler,
  type FeedbackDbRowLike,
  type SubmitCaseStudyFeedbackDeps,
} from "@/lib/services";

describe("SubmitCaseStudyFeedbackHandler (Logic Test)", () => {
  it("persists feedback directly to PostgreSQL and replays idempotent operationKey", async () => {
    const savedRow: FeedbackDbRowLike = {
      id: "fb-1",
      caseStudySlug: "crf",
      comments: "Helpful metrics",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const deps = fromPartial<SubmitCaseStudyFeedbackDeps>({
      now: () => Date.parse("2026-01-01T01:00:00.000Z"),
      db: {
        caseStudyFeedback: {
          findFirst: async ({ where }: { where: { operationKey?: string } }) =>
            where.operationKey === "op-replay" ? savedRow : null,
          create: async () => savedRow,
        },
      },
    });

    const handler = new SubmitCaseStudyFeedbackHandler(deps);
    const replayResult = await handler.execute({
      caseStudySlug: "crf",
      takeaways: ["latency"],
      comments: "Helpful metrics",
      connectionHash: "hash-1",
      operationKey: "op-replay",
    });

    expect(replayResult.success).toBe(true);
    if (replayResult.success) {
      expect(replayResult.data.replayed).toBe(true);
      expect(replayResult.data.feedback.id).toBe("fb-1");
    }
  });

  it("returns STORAGE_UNAVAILABLE instead of ephemeral memory fallback when DB throws", async () => {
    const deps = fromPartial<SubmitCaseStudyFeedbackDeps>({
      db: {
        caseStudyFeedback: {
          findFirst: async () => {
            throw new Error("Database unreachable");
          },
          create: async () => {
            throw new Error("Database unreachable");
          },
        },
      },
    });

    const handler = new SubmitCaseStudyFeedbackHandler(deps);
    const result = await handler.execute({
      caseStudySlug: "crf",
      takeaways: ["latency"],
      comments: "Offline test",
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
      expect(result.error.recoverable).toBe(true);
    }
  });
});
