// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetCaseStudyFeedbackErrorCode,
  GetCaseStudyFeedbackInputSchema,
} from "@/lib/services";

describe("GetCaseStudyFeedbackInputSchema (Contract Test)", () => {
  it("accepts non-empty slug and connectionHash", () => {
    const parsed = GetCaseStudyFeedbackInputSchema.safeParse({
      slug: "crf-studio",
      connectionHash: "conn-hash-1",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing connectionHash", () => {
    const parsed = GetCaseStudyFeedbackInputSchema.safeParse({
      slug: "crf-studio",
      connectionHash: "",
    });
    expect(parsed.success).toBe(false);
    expect(GetCaseStudyFeedbackErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
