// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ListDraftBlogPostsErrorCode,
  ListDraftBlogPostsInputSchema,
} from "@/lib/services";

describe("ListDraftBlogPostsInputSchema (Contract Test)", () => {
  it("accepts valid page and pageSize integers", () => {
    expect(
      ListDraftBlogPostsInputSchema.safeParse({ page: 1, pageSize: 20 }).success
    ).toBe(true);
  });

  it("rejects out-of-bounds pagination", () => {
    expect(
      ListDraftBlogPostsInputSchema.safeParse({ page: 0, pageSize: 200 })
        .success
    ).toBe(false);
    expect(ListDraftBlogPostsErrorCode.options).toEqual([
      "INVALID_PAGINATION",
      "STORAGE_UNAVAILABLE",
    ]);
  });
});
