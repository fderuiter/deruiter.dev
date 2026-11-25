// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  GetCaseStudyBySlugErrorCode,
  GetCaseStudyBySlugInputSchema,
} from "@/lib/services";

describe("GetCaseStudyBySlug Spec (Contract Test)", () => {
  it("defaults allowFallbackOnError to true", () => {
    const parsed = GetCaseStudyBySlugInputSchema.safeParse({ slug: "crf" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.allowFallbackOnError).toBe(true);
    }
  });

  it("rejects non-string slug and defines STORAGE_UNAVAILABLE", () => {
    const parsed = GetCaseStudyBySlugInputSchema.safeParse(
      fromAny({ slug: 42 })
    );
    expect(parsed.success).toBe(false);
    expect(GetCaseStudyBySlugErrorCode.options).toEqual(
      expect.arrayContaining(["INVALID_INPUT", "STORAGE_UNAVAILABLE"])
    );
  });
});
