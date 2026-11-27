// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  SubmitBlogReactionErrorCode,
  SubmitBlogReactionInputSchema,
} from "@/lib/services";

describe("SubmitBlogReactionInputSchema (Contract Test)", () => {
  it("accepts allowed blog reaction payload", () => {
    expect(
      SubmitBlogReactionInputSchema.safeParse({
        blogPostSlug: "post-1",
        reactionType: "insightful",
        connectionHash: "conn-1",
      }).success
    ).toBe(true);
  });

  it("rejects unsupported reactionType", () => {
    expect(
      SubmitBlogReactionInputSchema.safeParse({
        blogPostSlug: "post-1",
        reactionType: fromAny("dislike"),
        connectionHash: "conn-1",
      }).success
    ).toBe(false);
    expect(SubmitBlogReactionErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
