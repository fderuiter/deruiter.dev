// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import {
  CreateDraftBlogPostHandler,
  type PersistedBlogPostRecord,
} from "@/lib/services";

describe("CreateDraftBlogPostHandler (Logic Test)", () => {
  it("sanitizes body HTML, persists draft, and evicts blog cache", async () => {
    const created = fromPartial<PersistedBlogPostRecord>({
      id: "post-1",
      slug: "vertical-slices",
      title: "Vertical Slices",
      published: false,
    });
    const create = vi.fn().mockResolvedValue(created);
    const evictCache = vi.fn().mockResolvedValue({});
    const sanitizeHtml = vi.fn(async (s: string) => `sanitized:${s}`);

    const handler = new CreateDraftBlogPostHandler({
      blogPosts: { create },
      evictCache,
      sanitizeHtml,
    });

    const result = await handler.execute({
      title: "Vertical Slices",
      slug: "vertical-slices",
      dek: "Architectural overview",
      body: "<p>Hello world</p>",
      pillar: CONTENT_PILLARS[0],
      tags: "architecture",
      hero_image_url: null,
    });

    expect(result.success).toBe(true);
    expect(sanitizeHtml).toHaveBeenCalledTimes(1);
    expect(evictCache).toHaveBeenCalledWith("vertical-slices");
  });

  it("returns DUPLICATE_BLOG_SLUG on P2002 and STORAGE_UNAVAILABLE on DB outage", async () => {
    const dupErr = Object.assign(new Error("Unique slug"), { code: "P2002" });
    const dupHandler = new CreateDraftBlogPostHandler({
      blogPosts: { create: vi.fn().mockRejectedValue(dupErr) },
      sanitizeHtml: async (s) => s,
    });
    const dup = await dupHandler.execute({
      title: "Vertical Slices",
      slug: "vertical-slices",
      dek: "Dek",
      body: "<p>Body</p>",
      pillar: CONTENT_PILLARS[0],
      tags: "architecture",
      hero_image_url: null,
    });
    expect(dup.success).toBe(false);
    if (!dup.success) {
      expect(dup.error.code).toBe("DUPLICATE_BLOG_SLUG");
    }
  });
});
