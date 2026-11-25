// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  GetAllPublishedCaseStudiesErrorCode,
  GetAllPublishedCaseStudiesInputSchema,
} from "@/lib/services";

describe("GetAllPublishedCaseStudies Spec (Contract Test)", () => {
  it("accepts undefined input and defaults to empty object", () => {
    const parsed = GetAllPublishedCaseStudiesInputSchema.safeParse(undefined);
    expect(parsed.success).toBe(true);
  });

  it("rejects non-object input and defines INVALID_INPUT", () => {
    const parsed = GetAllPublishedCaseStudiesInputSchema.safeParse(
      fromAny("invalid")
    );
    expect(parsed.success).toBe(false);
    expect(GetAllPublishedCaseStudiesErrorCode.options).toContain(
      "INVALID_INPUT"
    );
  });
});
