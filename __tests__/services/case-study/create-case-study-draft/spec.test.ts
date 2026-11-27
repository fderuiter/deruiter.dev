// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CreateCaseStudyDraftErrorCode,
  CreateCaseStudyDraftInputSchema,
} from "@/lib/services";

describe("CreateCaseStudyDraftInputSchema (Contract Test)", () => {
  it("accepts valid draft input including empty narrative strings", () => {
    const parsed = CreateCaseStudyDraftInputSchema.safeParse({
      title: "CRF Studio",
      slug: "crf-studio",
      primary_language: "TypeScript",
      editorial_content: "",
      architectural_narrative: "",
      tags: "clinical, typescript",
      github_url: "https://github.com/fderuiter/crf-studio",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects blank title or slug", () => {
    const parsed = CreateCaseStudyDraftInputSchema.safeParse({
      title: "",
      slug: "   ",
      primary_language: "TypeScript",
      editorial_content: "",
      architectural_narrative: "",
      tags: "clinical",
    });
    expect(parsed.success).toBe(false);
    expect(CreateCaseStudyDraftErrorCode.options).toContain(
      "DUPLICATE_CASE_STUDY_SLUG"
    );
  });
});
