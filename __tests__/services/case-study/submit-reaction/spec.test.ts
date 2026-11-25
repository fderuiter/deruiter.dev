// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  SubmitCaseStudyReactionErrorCode,
  SubmitCaseStudyReactionInputSchema,
} from "@/lib/services";

describe("SubmitCaseStudyReaction Spec (Contract Test)", () => {
  it("validates reaction submission payload", () => {
    const parsed = SubmitCaseStudyReactionInputSchema.safeParse({
      caseStudySlug: "crf",
      reactionType: "insightful",
      connectionHash: "hash-1",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty reactionType and exposes STORAGE_UNAVAILABLE", () => {
    const parsed = SubmitCaseStudyReactionInputSchema.safeParse({
      caseStudySlug: "crf",
      reactionType: "",
      connectionHash: "hash-1",
    });
    expect(parsed.success).toBe(false);
    expect(SubmitCaseStudyReactionErrorCode.options).toEqual(
      expect.arrayContaining(["INVALID_INPUT", "STORAGE_UNAVAILABLE"])
    );
  });
});
