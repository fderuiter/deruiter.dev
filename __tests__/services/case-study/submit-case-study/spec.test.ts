// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  SubmitCaseStudyErrorCode,
  SubmitCaseStudyInputSchema,
} from "@/lib/services";

describe("SubmitCaseStudy Spec (Contract Test)", () => {
  it("accepts valid case study submission payload", () => {
    const parsed = SubmitCaseStudyInputSchema.safeParse({
      title: "New Study",
      slug: "new-study",
      primary_language: "TypeScript",
      editorial_content: "<p>Editorial</p>",
      architectural_narrative: "<p>Narrative</p>",
      tags: "ts,web",
      github_url: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty title and enumerates DUPLICATE_SLUG and STORAGE_UNAVAILABLE", () => {
    const parsed = SubmitCaseStudyInputSchema.safeParse({
      title: "",
      slug: "new-study",
      primary_language: "TypeScript",
      editorial_content: "",
      architectural_narrative: "",
      tags: "",
    });
    expect(parsed.success).toBe(false);
    expect(SubmitCaseStudyErrorCode.options).toEqual(
      expect.arrayContaining([
        "INVALID_INPUT",
        "DUPLICATE_SLUG",
        "STORAGE_UNAVAILABLE",
      ])
    );
  });
});
