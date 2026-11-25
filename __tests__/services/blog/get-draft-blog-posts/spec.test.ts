// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetDraftBlogPostsErrorCode,
  GetDraftBlogPostsInputSchema,
} from "@/lib/services";

describe("GetDraftBlogPosts Spec (Contract Test)", () => {
  it("accepts positive integer page and pageSize", () => {
    expect(
      GetDraftBlogPostsInputSchema.safeParse({ page: 1, pageSize: 20 }).success
    ).toBe(true);
  });

  it("rejects zero page and exposes STORAGE_UNAVAILABLE", () => {
    expect(
      GetDraftBlogPostsInputSchema.safeParse({ page: 0, pageSize: 20 }).success
    ).toBe(false);
    expect(GetDraftBlogPostsErrorCode.options).toContain("STORAGE_UNAVAILABLE");
  });
});
