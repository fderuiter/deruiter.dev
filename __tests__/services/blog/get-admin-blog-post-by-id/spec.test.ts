// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetAdminBlogPostByIdErrorCode,
  GetAdminBlogPostByIdInputSchema,
} from "@/lib/services";

describe("GetAdminBlogPostByIdInputSchema (Contract Test)", () => {
  it("accepts non-empty blog post ID", () => {
    expect(
      GetAdminBlogPostByIdInputSchema.safeParse({ id: "post-1" }).success
    ).toBe(true);
  });

  it("rejects empty ID", () => {
    expect(GetAdminBlogPostByIdInputSchema.safeParse({ id: "" }).success).toBe(
      false
    );
    expect(GetAdminBlogPostByIdErrorCode.options).toEqual([
      "INVALID_BLOG_POST_ID",
      "BLOG_POST_NOT_FOUND",
      "STORAGE_UNAVAILABLE",
    ]);
  });
});
