// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  ListPublishedCaseStudiesErrorCode,
  ListPublishedCaseStudiesInputSchema,
} from "@/lib/services";

describe("ListPublishedCaseStudiesInputSchema (Contract Test)", () => {
  it("accepts undefined or empty object", () => {
    expect(
      ListPublishedCaseStudiesInputSchema.safeParse(undefined).success
    ).toBe(true);
    expect(ListPublishedCaseStudiesInputSchema.safeParse({}).success).toBe(
      true
    );
  });

  it("rejects primitive non-object input", () => {
    expect(
      ListPublishedCaseStudiesInputSchema.safeParse(fromAny("bad")).success
    ).toBe(false);
    expect(ListPublishedCaseStudiesErrorCode.options).toContain(
      "INVALID_CASE_STUDY_QUERY"
    );
  });
});
