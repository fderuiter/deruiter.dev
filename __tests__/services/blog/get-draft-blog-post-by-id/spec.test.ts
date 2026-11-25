// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetDraftBlogPostByIdErrorCode,
  GetDraftBlogPostByIdInputSchema,
} from "@/lib/services";

describe("GetDraftBlogPostById Spec (Contract Test)", () => {
  it("accepts non-empty draft id", () => {
    expect(
      GetDraftBlogPostByIdInputSchema.safeParse({ id: "draft-1" }).success
    ).toBe(true);
  });

  it("rejects empty draft id and enumerates NOT_FOUND and STORAGE_UNAVAILABLE", () => {
    expect(GetDraftBlogPostByIdInputSchema.safeParse({ id: "" }).success).toBe(
      false
    );
    expect(GetDraftBlogPostByIdErrorCode.options).toEqual(
      expect.arrayContaining([
        "INVALID_INPUT",
        "NOT_FOUND",
        "STORAGE_UNAVAILABLE",
      ])
    );
  });
});
