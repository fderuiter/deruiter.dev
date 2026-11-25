// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DeleteBlogPostErrorCode,
  DeleteBlogPostInputSchema,
} from "@/lib/services";

describe("DeleteBlogPost Spec (Contract Test)", () => {
  it("accepts non-empty post id", () => {
    const parsed = DeleteBlogPostInputSchema.safeParse({ id: "post-1" });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty id and exposes NOT_FOUND and STORAGE_UNAVAILABLE", () => {
    const parsed = DeleteBlogPostInputSchema.safeParse({ id: "" });
    expect(parsed.success).toBe(false);
    expect(DeleteBlogPostErrorCode.options).toEqual(
      expect.arrayContaining([
        "INVALID_INPUT",
        "NOT_FOUND",
        "STORAGE_UNAVAILABLE",
      ])
    );
  });
});
