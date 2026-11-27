// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DeleteBlogPostErrorCode,
  DeleteBlogPostInputSchema,
} from "@/lib/services";

describe("DeleteBlogPostInputSchema (Contract Test)", () => {
  it("accepts non-empty blog post ID", () => {
    const parsed = DeleteBlogPostInputSchema.safeParse({ id: "post-1" });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty ID", () => {
    const parsed = DeleteBlogPostInputSchema.safeParse({ id: "   " });
    expect(parsed.success).toBe(false);
    expect(DeleteBlogPostErrorCode.options).toEqual([
      "INVALID_BLOG_POST_ID",
      "BLOG_POST_NOT_FOUND",
      "STORAGE_UNAVAILABLE",
    ]);
  });
});
