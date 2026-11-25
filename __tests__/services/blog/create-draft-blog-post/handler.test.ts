// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import {
  CreateDraftBlogPostHandler,
  type BlogPostDbRecord,
  type CreateDraftBlogPostDeps,
} from "@/lib/services";

describe("CreateDraftBlogPostHandler (Logic Test)", () => {
  it("sanitizes body HTML, persists unpublished draft, and evicts blog cache", async () => {
    const sanitizeHtml = vi.fn(async (html: string) => html);
    const evictExecute = vi.fn(async () => ({
      success: true as const,
      data: { evicted: true },
    }));
    const created = fromPartial<BlogPostDbRecord>({
      id: "post-1",
      slug: "draft-post",
      title: "Draft Post",
      published: false,
    });
    const deps = fromPartial<CreateDraftBlogPostDeps>({
      sanitizeHtml,
      evictCacheHandler: { execute: evictExecute },
      db: {
        blogPost: {
          create: async () => created,
        },
      },
    });

    const handler = new CreateDraftBlogPostHandler(deps);
    const result = await handler.execute({
      title: "Draft Post",
      slug: "draft-post",
      dek: "Dek",
      body: "<p>Hello world</p>",
      pillar: CONTENT_PILLARS[0],
      tags: "ts",
      hero_image_url: null,
    });

    expect(result).toEqual({ success: true, data: created });
    expect(sanitizeHtml).toHaveBeenCalledTimes(1);
    expect(evictExecute).toHaveBeenCalledWith({ slug: "draft-post" });
  });

  it("maps Prisma P2002 unique slug error to CONFLICT", async () => {
    const deps = fromPartial<CreateDraftBlogPostDeps>({
      sanitizeHtml: async (html: string) => html,
      db: {
        blogPost: {
          create: async () => {
            throw Object.assign(new Error("Duplicate slug"), { code: "P2002" });
          },
        },
      },
    });

    const handler = new CreateDraftBlogPostHandler(deps);
    const result = await handler.execute({
      title: "Draft Post",
      slug: "dup-slug",
      dek: "Dek",
      body: "<p>Body</p>",
      pillar: CONTENT_PILLARS[0],
      tags: "ts",
      hero_image_url: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CONFLICT");
    }
  });
});
