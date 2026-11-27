// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  ListCaseStudySummariesErrorCode,
  ListCaseStudySummariesInputSchema,
} from "@/lib/services";

describe("ListCaseStudySummariesInputSchema (Contract Test)", () => {
  it("accepts undefined or empty object", () => {
    expect(ListCaseStudySummariesInputSchema.safeParse(undefined).success).toBe(
      true
    );
    expect(ListCaseStudySummariesInputSchema.safeParse({}).success).toBe(true);
  });

  it("rejects non-object values", () => {
    expect(
      ListCaseStudySummariesInputSchema.safeParse(fromAny("bad")).success
    ).toBe(false);
    expect(ListCaseStudySummariesErrorCode.options).toContain(
      "INVALID_CASE_STUDY_SUMMARY_QUERY"
    );
  });
});
