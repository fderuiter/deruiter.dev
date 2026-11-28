// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { SubmitCaseStudyFeedbackHandler } from "@/lib/services";

describe("SubmitCaseStudyFeedbackHandler (Logic Test)", () => {
  it("persists feedback entry and returns STORAGE_UNAVAILABLE instead of fake success on DB outage", async () => {
    const okHandler = new SubmitCaseStudyFeedbackHandler({
      feedback: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "fb-1",
          caseStudySlug: "crf-studio",
          comments: "Nice",
          createdAt: new Date("2026-03-01T00:00:00Z"),
        }),
      },
    });
    const ok = await okHandler.execute({
      caseStudySlug: "crf-studio",
      takeaways: ["Testing"],
      comments: "Nice",
      connectionHash: "conn-1",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.durable).toBe(true);
    }

    const outageHandler = new SubmitCaseStudyFeedbackHandler({
      feedback: {
        findFirst: vi.fn().mockRejectedValue(new Error("Postgres unreachable")),
        create: vi.fn(),
      },
    });
    const outage = await outageHandler.execute({
      caseStudySlug: "crf-studio",
      takeaways: ["Testing"],
      comments: "Nice",
      connectionHash: "conn-1",
    });
    expect(outage.success).toBe(false);
    if (!outage.success) {
      expect(outage.error.code).toBe("STORAGE_UNAVAILABLE");
      expect(outage.error.recoverable).toBe(true);
    }
  });

  it("returns durable: false when falling back to an injected volatile Map store", async () => {
    const fallbackStore = new Map();
    const fallbackHandler = new SubmitCaseStudyFeedbackHandler({
      feedback: {
        findFirst: vi.fn().mockRejectedValue(new Error("Postgres unreachable")),
        create: vi.fn(),
      },
      fallbackStore,
    });

    const first = await fallbackHandler.execute({
      caseStudySlug: "crf-studio",
      takeaways: ["Testing"],
      comments: "Saved in volatile fallback",
      connectionHash: "conn-volatile",
      operationKey: "fb_key_1",
    });
    expect(first.success).toBe(true);
    if (first.success) {
      expect(first.data.durable).toBe(false);
      expect(first.data.replayed).toBe(false);
    }

    const replay = await fallbackHandler.execute({
      caseStudySlug: "crf-studio",
      takeaways: ["Testing"],
      comments: "Saved in volatile fallback",
      connectionHash: "conn-volatile",
      operationKey: "fb_key_1",
    });
    expect(replay.success).toBe(true);
    if (replay.success) {
      expect(replay.data.durable).toBe(false);
      expect(replay.data.replayed).toBe(true);
    }
  });
});
