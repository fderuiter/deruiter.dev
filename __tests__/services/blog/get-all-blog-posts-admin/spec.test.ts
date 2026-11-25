// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  GetAllBlogPostsAdminErrorCode,
  GetAllBlogPostsAdminInputSchema,
} from "@/lib/services";

describe("GetAllBlogPostsAdmin Spec (Contract Test)", () => {
  it("accepts undefined input", () => {
    expect(GetAllBlogPostsAdminInputSchema.safeParse(undefined).success).toBe(
      true
    );
  });

  it("rejects non-object input and defines STORAGE_UNAVAILABLE", () => {
    expect(
      GetAllBlogPostsAdminInputSchema.safeParse(fromAny("bad")).success
    ).toBe(false);
    expect(GetAllBlogPostsAdminErrorCode.options).toEqual(
      expect.arrayContaining(["INVALID_INPUT", "STORAGE_UNAVAILABLE"])
    );
  });
});
