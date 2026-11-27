// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  GetPublishedBlogPostErrorCode,
  GetPublishedBlogPostInputSchema,
} from "@/lib/services";

describe("GetPublishedBlogPostInputSchema (Contract Test)", () => {
  it("accepts string slug", () => {
    expect(
      GetPublishedBlogPostInputSchema.safeParse({ slug: "my-post" }).success
    ).toBe(true);
  });

  it("rejects non-string slug", () => {
    expect(
      GetPublishedBlogPostInputSchema.safeParse({ slug: fromAny(null) }).success
    ).toBe(false);
    expect(GetPublishedBlogPostErrorCode.options).toContain(
      "INVALID_BLOG_SLUG"
    );
  });
});
