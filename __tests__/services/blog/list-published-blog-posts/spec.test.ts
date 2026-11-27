// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  ListPublishedBlogPostsErrorCode,
  ListPublishedBlogPostsInputSchema,
} from "@/lib/services";

describe("ListPublishedBlogPostsInputSchema (Contract Test)", () => {
  it("accepts undefined or empty object", () => {
    expect(ListPublishedBlogPostsInputSchema.safeParse(undefined).success).toBe(
      true
    );
    expect(ListPublishedBlogPostsInputSchema.safeParse({}).success).toBe(true);
  });

  it("rejects primitive non-object input", () => {
    expect(
      ListPublishedBlogPostsInputSchema.safeParse(fromAny("bad")).success
    ).toBe(false);
    expect(ListPublishedBlogPostsErrorCode.options).toContain(
      "INVALID_BLOG_QUERY"
    );
  });
});
