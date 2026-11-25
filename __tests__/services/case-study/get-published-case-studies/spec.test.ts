// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  GetPublishedCaseStudiesErrorCode,
  GetPublishedCaseStudiesInputSchema,
} from "@/lib/services";

describe("GetPublishedCaseStudies Spec (Contract Test)", () => {
  it("accepts undefined and empty object inputs", () => {
    expect(
      GetPublishedCaseStudiesInputSchema.safeParse(undefined).success
    ).toBe(true);
    expect(GetPublishedCaseStudiesInputSchema.safeParse({}).success).toBe(true);
  });

  it("rejects primitive input and exposes INVALID_INPUT", () => {
    const parsed = GetPublishedCaseStudiesInputSchema.safeParse(fromAny(123));
    expect(parsed.success).toBe(false);
    expect(GetPublishedCaseStudiesErrorCode.options).toContain("INVALID_INPUT");
  });
});
