// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  EvictCaseStudyCacheErrorCode,
  EvictCaseStudyCacheInputSchema,
} from "@/lib/services";

describe("EvictCaseStudyCache Spec (Contract Test)", () => {
  it("parses valid slug input", () => {
    const parsed = EvictCaseStudyCacheInputSchema.safeParse({ slug: "crf" });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-string slug and exposes INVALID_INPUT error code", () => {
    const parsed = EvictCaseStudyCacheInputSchema.safeParse(
      fromAny({ slug: 123 })
    );
    expect(parsed.success).toBe(false);
    expect(EvictCaseStudyCacheErrorCode.options).toContain("INVALID_INPUT");
  });
});
