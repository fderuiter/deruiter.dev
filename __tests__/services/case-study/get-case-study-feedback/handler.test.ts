// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GetCaseStudyFeedbackHandler } from "@/lib/services";

describe("GetCaseStudyFeedbackHandler (Logic Test)", () => {
  it("parses JSON takeaways and flags whether caller connectionHash submitted", async () => {
    const handler = new GetCaseStudyFeedbackHandler({
      feedback: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "fb-1",
            takeaways: JSON.stringify(["Architecture"]),
            comments: "Helpful",
            createdAt: new Date("2026-02-01T00:00:00Z"),
            connectionHash: "conn-1",
          },
        ]),
      },
    });

    const result = await handler.execute({
      slug: "crf-studio",
      connectionHash: "conn-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasSubmitted).toBe(true);
      expect(result.data.feedback[0]?.takeaways).toEqual(["Architecture"]);
    }
  });

  it("returns STORAGE_UNAVAILABLE when DB read throws", async () => {
    const handler = new GetCaseStudyFeedbackHandler({
      feedback: {
        findMany: vi.fn().mockRejectedValue(new Error("DB offline")),
      },
    });
    const result = await handler.execute({
      slug: "crf-studio",
      connectionHash: "conn-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
