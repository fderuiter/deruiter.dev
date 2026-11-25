// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ALLOWED_REACTIONS } from "@/lib/schemas";
import {
  SubmitBlogReactionErrorCode,
  SubmitBlogReactionInputSchema,
} from "@/lib/services";

describe("SubmitBlogReaction Spec (Contract Test)", () => {
  it("accepts allowed reactionType, blogPostSlug, and connectionHash", () => {
    expect(
      SubmitBlogReactionInputSchema.safeParse({
        blogPostSlug: "post-1",
        reactionType: ALLOWED_REACTIONS[0],
        connectionHash: "hash-1",
      }).success
    ).toBe(true);
  });

  it("rejects unknown reactionType and defines NOT_FOUND, RATE_LIMITED, STORAGE_UNAVAILABLE", () => {
    expect(
      SubmitBlogReactionInputSchema.safeParse({
        blogPostSlug: "post-1",
        reactionType: "unknown_reaction",
        connectionHash: "hash-1",
      }).success
    ).toBe(false);
    expect(SubmitBlogReactionErrorCode.options).toEqual(
      expect.arrayContaining([
        "NOT_FOUND",
        "RATE_LIMITED",
        "STORAGE_UNAVAILABLE",
        "INVALID_INPUT",
      ])
    );
  });
});
