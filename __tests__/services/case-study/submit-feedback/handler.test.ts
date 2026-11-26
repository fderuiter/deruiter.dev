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

  it("returns INVALID_INPUT for invalid payload", async () => {
    const handler = new SubmitCaseStudyFeedbackHandler();
    const result = await handler.execute({
      caseStudySlug: "",
      takeaways: [],
      comments: "",
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("creates new feedback, enforces 1-hour RATE_LIMITED window, and handles P2002 replay race", async () => {
    const savedRow: FeedbackDbRowLike = {
      id: "fb-created",
      caseStudySlug: "crf",
      comments: "Fresh feedback",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const createHandler = new SubmitCaseStudyFeedbackHandler(
      fromPartial<SubmitCaseStudyFeedbackDeps>({
        now: () => Date.parse("2026-01-01T01:00:00.000Z"),
        db: {
          caseStudyFeedback: {
            findFirst: async () => null,
            create: async () => savedRow,
          },
        },
      })
    );
    const createdRes = await createHandler.execute({
      caseStudySlug: "crf",
      takeaways: ["latency"],
      comments: "Fresh feedback",
      connectionHash: "hash-1",
    });
    expect(createdRes.success).toBe(true);
    if (createdRes.success) {
      expect(createdRes.data.replayed).toBe(false);
    }

    const rateLimitedHandler = new SubmitCaseStudyFeedbackHandler(
      fromPartial<SubmitCaseStudyFeedbackDeps>({
        now: () => Date.parse("2026-01-01T01:00:00.000Z"),
        db: {
          caseStudyFeedback: {
            findFirst: async () => savedRow,
            create: async () => savedRow,
          },
        },
      })
    );
    const rateLimitedRes = await rateLimitedHandler.execute({
      caseStudySlug: "crf",
      takeaways: ["latency"],
      comments: "Duplicate",
      connectionHash: "hash-1",
    });
    expect(rateLimitedRes.success).toBe(false);
    if (!rateLimitedRes.success) {
      expect(rateLimitedRes.error.code).toBe("RATE_LIMITED");
    }

    let findFirstCalls = 0;
    const raceHandler = new SubmitCaseStudyFeedbackHandler(
      fromPartial<SubmitCaseStudyFeedbackDeps>({
        now: () => Date.parse("2026-01-01T01:00:00.000Z"),
        db: {
          caseStudyFeedback: {
            findFirst: async () => {
              findFirstCalls++;
              return findFirstCalls >= 3 ? savedRow : null;
            },
            create: async () => {
              throw Object.assign(new Error("Unique constraint failed"), {
                code: "P2002",
              });
            },
          },
        },
      })
    );
    const raceRes = await raceHandler.execute({
      caseStudySlug: "crf",
      takeaways: ["latency"],
      comments: "Race winner",
      connectionHash: "hash-1",
      operationKey: "op-race",
    });
    expect(raceRes.success).toBe(true);
    if (raceRes.success) {
      expect(raceRes.data.replayed).toBe(true);
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
