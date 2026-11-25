// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetCaseStudyReactionsErrorCode,
  GetCaseStudyReactionsInputSchema,
} from "@/lib/services";

describe("GetCaseStudyReactions Spec (Contract Test)", () => {
  it("accepts non-empty slug and connectionHash", () => {
    const parsed = GetCaseStudyReactionsInputSchema.safeParse({
      slug: "crf",
      connectionHash: "hash-1",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty connectionHash with INVALID_INPUT", () => {
    const parsed = GetCaseStudyReactionsInputSchema.safeParse({
      slug: "crf",
      connectionHash: "",
    });
    expect(parsed.success).toBe(false);
    expect(GetCaseStudyReactionsErrorCode.options).toContain("INVALID_INPUT");
  });
});
