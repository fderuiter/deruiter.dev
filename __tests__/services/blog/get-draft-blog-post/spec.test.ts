// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetDraftBlogPostErrorCode,
  GetDraftBlogPostInputSchema,
} from "@/lib/services";

describe("GetDraftBlogPostInputSchema (Contract Test)", () => {
  it("accepts non-empty draft ID", () => {
    expect(
      GetDraftBlogPostInputSchema.safeParse({ id: "draft-1" }).success
    ).toBe(true);
  });

  it("rejects empty ID", () => {
    expect(GetDraftBlogPostInputSchema.safeParse({ id: "   " }).success).toBe(
      false
    );
    expect(GetDraftBlogPostErrorCode.options).toEqual([
      "INVALID_BLOG_POST_ID",
      "BLOG_POST_NOT_FOUND",
      "STORAGE_UNAVAILABLE",
    ]);
  });
});
