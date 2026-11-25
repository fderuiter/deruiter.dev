// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  HydrateBlogReactionCountsErrorCode,
  HydrateBlogReactionCountsInputSchema,
} from "@/lib/services";

describe("HydrateBlogReactionCounts Spec (Contract Test)", () => {
  it("accepts non-empty slug", () => {
    expect(
      HydrateBlogReactionCountsInputSchema.safeParse({ slug: "post-1" }).success
    ).toBe(true);
  });

  it("rejects empty slug with INVALID_INPUT", () => {
    expect(
      HydrateBlogReactionCountsInputSchema.safeParse({ slug: "" }).success
    ).toBe(false);
    expect(HydrateBlogReactionCountsErrorCode.options).toContain(
      "INVALID_INPUT"
    );
  });
});
