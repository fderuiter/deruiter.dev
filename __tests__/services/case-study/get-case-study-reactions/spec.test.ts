// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetCaseStudyReactionsErrorCode,
  GetCaseStudyReactionsInputSchema,
} from "@/lib/services";

describe("GetCaseStudyReactionsInputSchema (Contract Test)", () => {
  it("accepts valid slug and connectionHash", () => {
    const parsed = GetCaseStudyReactionsInputSchema.safeParse({
      slug: "crf-studio",
      connectionHash: "conn-1",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty slug", () => {
    const parsed = GetCaseStudyReactionsInputSchema.safeParse({
      slug: "",
      connectionHash: "conn-1",
    });
    expect(parsed.success).toBe(false);
    expect(GetCaseStudyReactionsErrorCode.options).toContain(
      "INVALID_REACTION_QUERY"
    );
  });
});
