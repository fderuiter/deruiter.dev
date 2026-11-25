// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import {
  GetBlogPostBySlugHandler,
  type BlogPostDbRecord,
  type GetBlogPostBySlugDeps,
} from "@/lib/services";

describe("GetBlogPostBySlugHandler (Logic Test)", () => {
  it("returns published blog post from database", async () => {
    const dbRecord: BlogPostDbRecord = {
      id: "post-1",
      slug: "slug-post",
      title: "Slug Post",
      dek: "Summary",
      body: "<p>Body</p>",
      pillar: CONTENT_PILLARS[0],
      tags: "ts",
      published: true,
      reading_time_minutes: 2,
      hero_image_url: null,
      created_at: new Date("2026-01-01T00:00:00Z"),
      updated_at: new Date("2026-01-01T00:00:00Z"),
    };
    const deps = fromPartial<GetBlogPostBySlugDeps>({
      isRedisReady: () => false,
      db: { blogPost: { findUnique: async () => dbRecord } },
    });

    const handler = new GetBlogPostBySlugHandler(deps);
    const result = await handler.execute({ slug: "slug-post" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("slug-post");
    }
  });

  it("hides unpublished database draft even when slug is requested", async () => {
    const draftRecord = fromPartial<BlogPostDbRecord>({
      id: "draft-1",
      slug: "draft-slug",
      published: false,
    });
    const deps = fromPartial<GetBlogPostBySlugDeps>({
      isRedisReady: () => false,
      db: { blogPost: { findUnique: async () => draftRecord } },
    });

    const handler = new GetBlogPostBySlugHandler(deps);
    const result = await handler.execute({ slug: "draft-slug" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
