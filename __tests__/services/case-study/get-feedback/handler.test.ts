// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GetCaseStudyFeedbackHandler,
  type GetCaseStudyFeedbackDeps,
} from "@/lib/services";

describe("GetCaseStudyFeedbackHandler (Logic Test)", () => {
  it("returns INVALID_INPUT when caseStudySlug is blank", async () => {
    const handler = new GetCaseStudyFeedbackHandler();
    const result = await handler.execute({
      caseStudySlug: "",
      connectionHash: "hash-match",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("parses takeaways JSON, defaults empty takeaways to [], and marks hasSubmitted when connectionHash matches", async () => {
    const deps = fromPartial<GetCaseStudyFeedbackDeps>({
      db: {
        caseStudyFeedback: {
          findMany: async () => [
            {
              id: "fb-1",
              takeaways: JSON.stringify(["clean-architecture"]),
              comments: "Solid trade-offs",
              createdAt: new Date("2026-01-01T00:00:00Z"),
              connectionHash: "hash-match",
            },
            {
              id: "fb-2",
              takeaways: "",
              comments: "No tags",
              createdAt: new Date("2026-01-02T00:00:00Z"),
              connectionHash: "other-hash",
            },
          ],
        },
      },
    });

    const handler = new GetCaseStudyFeedbackHandler(deps);
    const result = await handler.execute({
      caseStudySlug: "crf",
      connectionHash: "hash-match",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hasSubmitted).toBe(true);
      expect(result.data.totalFeedback).toBe(2);
      expect(result.data.feedback[0]?.takeaways).toEqual([
        "clean-architecture",
      ]);
      expect(result.data.feedback[1]?.takeaways).toEqual([]);
    }
  });

  it("returns STORAGE_UNAVAILABLE when database query rejects", async () => {
    const deps = fromPartial<GetCaseStudyFeedbackDeps>({
      db: {
        caseStudyFeedback: {
          findMany: async () => {
            throw new Error("DB offline");
          },
        },
      },
    });

    const handler = new GetCaseStudyFeedbackHandler(deps);
    const result = await handler.execute({
      caseStudySlug: "crf",
      connectionHash: "hash-match",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
