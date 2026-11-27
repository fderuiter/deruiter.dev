// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  EvictBlogCacheErrorCode,
  EvictBlogCacheInputSchema,
} from "@/lib/services";

describe("EvictBlogCacheInputSchema (Contract Test)", () => {
  it("accepts string slug", () => {
    expect(
      EvictBlogCacheInputSchema.safeParse({ slug: "my-post" }).success
    ).toBe(true);
  });

  it("rejects non-string slug", () => {
    expect(
      EvictBlogCacheInputSchema.safeParse({ slug: fromAny(123) }).success
    ).toBe(false);
    expect(EvictBlogCacheErrorCode.options).toContain("INVALID_BLOG_SLUG");
  });
});
