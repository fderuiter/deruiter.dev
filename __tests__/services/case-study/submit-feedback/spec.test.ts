// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  SubmitCaseStudyFeedbackErrorCode,
  SubmitCaseStudyFeedbackInputSchema,
} from "@/lib/services";

describe("SubmitCaseStudyFeedback Spec (Contract Test)", () => {
  it("validates feedback input with optional operationKey", () => {
    const parsed = SubmitCaseStudyFeedbackInputSchema.safeParse({
      caseStudySlug: "crf",
      takeaways: ["edge-caching"],
      comments: "Great breakdown",
      connectionHash: "hash-1",
      operationKey: "op-123",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty caseStudySlug and enumerates RATE_LIMITED and STORAGE_UNAVAILABLE", () => {
    const parsed = SubmitCaseStudyFeedbackInputSchema.safeParse({
      caseStudySlug: "",
      takeaways: [],
      comments: "",
      connectionHash: "hash-1",
    });
    expect(parsed.success).toBe(false);
    expect(SubmitCaseStudyFeedbackErrorCode.options).toEqual(
      expect.arrayContaining([
        "INVALID_INPUT",
        "RATE_LIMITED",
        "STORAGE_UNAVAILABLE",
      ])
    );
  });
});
