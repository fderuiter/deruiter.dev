// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CaseStudyImageErrorCode,
  UpdateCaseStudyImageInputSchema,
} from "@/lib/services";

describe("UpdateCaseStudyImageInputSchema (Contract Test)", () => {
  it("accepts non-empty slug with string or null heroImageUrl", () => {
    expect(
      UpdateCaseStudyImageInputSchema.safeParse({
        slug: "crf-studio",
        heroImageUrl: "/api/media/projects/crf-studio/hero.png",
      }).success
    ).toBe(true);
    expect(
      UpdateCaseStudyImageInputSchema.safeParse({
        slug: "crf-studio",
        heroImageUrl: null,
      }).success
    ).toBe(true);
  });

  it("rejects empty slug", () => {
    expect(
      UpdateCaseStudyImageInputSchema.safeParse({
        slug: "   ",
        heroImageUrl: null,
      }).success
    ).toBe(false);
    expect(CaseStudyImageErrorCode.options).toContain("PERSISTENCE_FAILED");
  });
});
