// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  SubmitCaseStudyFeedbackErrorCode,
  SubmitCaseStudyFeedbackInputSchema,
} from "@/lib/services";

describe("SubmitCaseStudyFeedbackInputSchema (Contract Test)", () => {
  it("accepts valid feedback submission with optional operationKey", () => {
    const parsed = SubmitCaseStudyFeedbackInputSchema.safeParse({
      caseStudySlug: "crf-studio",
      takeaways: ["Vertical slice contracts"],
      comments: "Clean separation",
      connectionHash: "conn-1",
      operationKey: "op-123",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects blank caseStudySlug or connectionHash", () => {
    const parsed = SubmitCaseStudyFeedbackInputSchema.safeParse({
      caseStudySlug: "",
      takeaways: [],
      comments: "",
      connectionHash: "",
    });
    expect(parsed.success).toBe(false);
    expect(SubmitCaseStudyFeedbackErrorCode.options).toEqual([
      "INVALID_FEEDBACK_INPUT",
      "RATE_LIMITED",
      "STORAGE_UNAVAILABLE",
    ]);
  });
});
