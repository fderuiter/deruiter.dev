// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetBlogPostByIdErrorCode,
  GetBlogPostByIdInputSchema,
} from "@/lib/services";

describe("GetBlogPostById Spec (Contract Test)", () => {
  it("accepts non-empty id", () => {
    expect(GetBlogPostByIdInputSchema.safeParse({ id: "post-1" }).success).toBe(
      true
    );
  });

  it("rejects empty id and defines NOT_FOUND and STORAGE_UNAVAILABLE", () => {
    expect(GetBlogPostByIdInputSchema.safeParse({ id: "" }).success).toBe(
      false
    );
    expect(GetBlogPostByIdErrorCode.options).toEqual(
      expect.arrayContaining([
        "INVALID_INPUT",
        "NOT_FOUND",
        "STORAGE_UNAVAILABLE",
      ])
    );
  });
});
