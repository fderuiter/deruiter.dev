// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import {
  CreateDraftBlogPostErrorCode,
  CreateDraftBlogPostInputSchema,
} from "@/lib/services";

describe("CreateDraftBlogPostInputSchema (Contract Test)", () => {
  it("accepts valid blog draft creation payload", () => {
    const parsed = CreateDraftBlogPostInputSchema.safeParse({
      title: "Vertical Slice Services",
      slug: "vertical-slice-services",
      dek: "Replacing monolithic service objects with ADR 0028 handlers.",
      body: "<p>Detailed architectural breakdown.</p>",
      pillar: CONTENT_PILLARS[0],
      tags: "architecture, typescript",
      hero_image_url: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty title or body", () => {
    const parsed = CreateDraftBlogPostInputSchema.safeParse({
      title: "   ",
      slug: "valid-slug",
      dek: "Dek",
      body: "",
      pillar: CONTENT_PILLARS[0],
      tags: "architecture",
      hero_image_url: null,
    });
    expect(parsed.success).toBe(false);
    expect(CreateDraftBlogPostErrorCode.options).toContain(
      "DUPLICATE_BLOG_SLUG"
    );
  });
});
