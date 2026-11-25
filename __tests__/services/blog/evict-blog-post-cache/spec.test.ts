// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  EvictBlogPostCacheErrorCode,
  EvictBlogPostCacheInputSchema,
} from "@/lib/services";

describe("EvictBlogPostCache Spec (Contract Test)", () => {
  it("accepts string slug", () => {
    expect(
      EvictBlogPostCacheInputSchema.safeParse({ slug: "my-post" }).success
    ).toBe(true);
  });

  it("rejects non-string slug and defines INVALID_INPUT", () => {
    expect(
      EvictBlogPostCacheInputSchema.safeParse(fromAny({ slug: 123 })).success
    ).toBe(false);
    expect(EvictBlogPostCacheErrorCode.options).toContain("INVALID_INPUT");
  });
});
