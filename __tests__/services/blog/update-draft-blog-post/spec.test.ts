// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  UpdateDraftBlogPostErrorCode,
  UpdateDraftBlogPostInputSchema,
} from "@/lib/services";

describe("UpdateDraftBlogPost Spec (Contract Test)", () => {
  it("accepts id and partial patch object", () => {
    expect(
      UpdateDraftBlogPostInputSchema.safeParse({
        id: "post-1",
        patch: { title: "Updated Title", published: true },
      }).success
    ).toBe(true);
  });

  it("rejects empty id and defines NOT_FOUND, CONFLICT, STORAGE_UNAVAILABLE", () => {
    expect(
      UpdateDraftBlogPostInputSchema.safeParse({
        id: "",
        patch: {},
      }).success
    ).toBe(false);
    expect(UpdateDraftBlogPostErrorCode.options).toEqual(
      expect.arrayContaining([
        "INVALID_INPUT",
        "NOT_FOUND",
        "CONFLICT",
        "STORAGE_UNAVAILABLE",
      ])
    );
  });
});
