// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  SubmitCaseStudyReactionErrorCode,
  SubmitCaseStudyReactionInputSchema,
} from "@/lib/services";

describe("SubmitCaseStudyReactionInputSchema (Contract Test)", () => {
  it("accepts allowed case study reactionType", () => {
    const parsed = SubmitCaseStudyReactionInputSchema.safeParse({
      caseStudySlug: "crf-studio",
      reactionType: "insightful",
      connectionHash: "conn-1",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unsupported reactionType", () => {
    const parsed = SubmitCaseStudyReactionInputSchema.safeParse({
      caseStudySlug: "crf-studio",
      reactionType: fromAny("dislike"),
      connectionHash: "conn-1",
    });
    expect(parsed.success).toBe(false);
    expect(SubmitCaseStudyReactionErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
