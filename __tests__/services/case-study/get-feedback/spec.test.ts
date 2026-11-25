// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetCaseStudyFeedbackErrorCode,
  GetCaseStudyFeedbackInputSchema,
} from "@/lib/services";

describe("GetCaseStudyFeedback Spec (Contract Test)", () => {
  it("accepts non-empty caseStudySlug and connectionHash", () => {
    const parsed = GetCaseStudyFeedbackInputSchema.safeParse({
      caseStudySlug: "crf",
      connectionHash: "hash-abc",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty slug and exposes STORAGE_UNAVAILABLE", () => {
    const parsed = GetCaseStudyFeedbackInputSchema.safeParse({
      caseStudySlug: "",
      connectionHash: "hash-abc",
    });
    expect(parsed.success).toBe(false);
    expect(GetCaseStudyFeedbackErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
