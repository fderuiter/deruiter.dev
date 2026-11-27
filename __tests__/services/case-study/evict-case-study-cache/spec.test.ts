// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EvictCaseStudyCacheErrorCode,
  EvictCaseStudyCacheInputSchema,
} from "@/lib/services";

describe("EvictCaseStudyCacheInputSchema (Contract Test)", () => {
  it("accepts non-empty case study slug", () => {
    const parsed = EvictCaseStudyCacheInputSchema.safeParse({
      slug: "crf-studio",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty slug", () => {
    const parsed = EvictCaseStudyCacheInputSchema.safeParse({ slug: "   " });
    expect(parsed.success).toBe(false);
    expect(EvictCaseStudyCacheErrorCode.options).toContain(
      "INVALID_CASE_STUDY_SLUG"
    );
  });
});
