// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  GetBlogPostBySlugErrorCode,
  GetBlogPostBySlugInputSchema,
} from "@/lib/services";

describe("GetBlogPostBySlug Spec (Contract Test)", () => {
  it("accepts string slug", () => {
    expect(
      GetBlogPostBySlugInputSchema.safeParse({ slug: "some-post" }).success
    ).toBe(true);
  });

  it("rejects non-string slug and defines NOT_FOUND and INVALID_INPUT", () => {
    expect(
      GetBlogPostBySlugInputSchema.safeParse(fromAny({ slug: false })).success
    ).toBe(false);
    expect(GetBlogPostBySlugErrorCode.options).toEqual(
      expect.arrayContaining(["NOT_FOUND", "INVALID_INPUT"])
    );
  });
});
