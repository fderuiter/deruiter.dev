// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CaseStudyImageErrorCode,
  UpdateCaseStudyImageInputSchema,
} from "@/lib/services";

describe("UpdateCaseStudyImage Spec (Contract Test)", () => {
  it("accepts non-empty slug and nullable heroImageUrl", () => {
    const parsed = UpdateCaseStudyImageInputSchema.safeParse({
      slug: "crf",
      heroImageUrl: "/api/media/hero.webp",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty slug and enumerates CASE_STUDY_NOT_FOUND and PERSISTENCE_FAILED", () => {
    const parsed = UpdateCaseStudyImageInputSchema.safeParse({
      slug: "",
      heroImageUrl: null,
    });
    expect(parsed.success).toBe(false);
    expect(CaseStudyImageErrorCode.options).toEqual(
      expect.arrayContaining([
        "CASE_STUDY_NOT_FOUND",
        "PERSISTENCE_FAILED",
        "INVALID_INPUT",
      ])
    );
  });
});
