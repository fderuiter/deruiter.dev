// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  UpdateDraftBlogPostErrorCode,
  UpdateDraftBlogPostInputSchema,
} from "@/lib/services";

describe("UpdateDraftBlogPostInputSchema (Contract Test)", () => {
  it("accepts non-empty ID and partial draft update", () => {
    const parsed = UpdateDraftBlogPostInputSchema.safeParse({
      id: "draft-1",
      updates: { title: "Updated Title", published: true },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty updates object", () => {
    const parsed = UpdateDraftBlogPostInputSchema.safeParse({
      id: "draft-1",
      updates: {},
    });
    expect(parsed.success).toBe(false);
    expect(UpdateDraftBlogPostErrorCode.options).toContain(
      "EMPTY_DRAFT_UPDATE"
    );
  });
});
