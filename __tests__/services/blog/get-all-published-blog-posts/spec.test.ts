// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  GetAllPublishedBlogPostsErrorCode,
  GetAllPublishedBlogPostsInputSchema,
} from "@/lib/services";

describe("GetAllPublishedBlogPosts Spec (Contract Test)", () => {
  it("accepts undefined input", () => {
    expect(
      GetAllPublishedBlogPostsInputSchema.safeParse(undefined).success
    ).toBe(true);
  });

  it("rejects non-object input with INVALID_INPUT", () => {
    expect(
      GetAllPublishedBlogPostsInputSchema.safeParse(fromAny("bad")).success
    ).toBe(false);
    expect(GetAllPublishedBlogPostsErrorCode.options).toContain(
      "INVALID_INPUT"
    );
  });
});
