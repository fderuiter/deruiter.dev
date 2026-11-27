// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetCaseStudyBySlugErrorCode,
  GetCaseStudyBySlugInputSchema,
} from "@/lib/services";

describe("GetCaseStudyBySlugInputSchema (Contract Test)", () => {
  it("accepts non-empty case study slug", () => {
    const parsed = GetCaseStudyBySlugInputSchema.safeParse({
      slug: "clinical-data-mapper",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty slug", () => {
    const parsed = GetCaseStudyBySlugInputSchema.safeParse({ slug: "" });
    expect(parsed.success).toBe(false);
    expect(GetCaseStudyBySlugErrorCode.options).toContain(
      "INVALID_CASE_STUDY_SLUG"
    );
  });
});
