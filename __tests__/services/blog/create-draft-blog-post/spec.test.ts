// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import {
  CreateDraftBlogPostErrorCode,
  CreateDraftBlogPostInputSchema,
} from "@/lib/services";

describe("CreateDraftBlogPost Spec (Contract Test)", () => {
  it("accepts valid blog draft payload", () => {
    const parsed = CreateDraftBlogPostInputSchema.safeParse({
      title: "Architecture Notes",
      slug: "architecture-notes",
      dek: "Short summary",
      body: "<p>Body text</p>",
      pillar: CONTENT_PILLARS[0],
      tags: "architecture,ts",
      hero_image_url: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty title and enumerates CONFLICT and STORAGE_UNAVAILABLE", () => {
    const parsed = CreateDraftBlogPostInputSchema.safeParse({
      title: "",
      slug: "architecture-notes",
      dek: "",
      body: "",
      pillar: CONTENT_PILLARS[0],
      tags: "",
      hero_image_url: null,
    });
    expect(parsed.success).toBe(false);
    expect(CreateDraftBlogPostErrorCode.options).toEqual(
      expect.arrayContaining([
        "INVALID_INPUT",
        "CONFLICT",
        "STORAGE_UNAVAILABLE",
      ])
    );
  });
});
