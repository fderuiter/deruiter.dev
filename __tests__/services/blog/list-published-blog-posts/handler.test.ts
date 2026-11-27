// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import {
  ListPublishedBlogPostsHandler,
  type PersistedBlogPostRecord,
} from "@/lib/services";

describe("ListPublishedBlogPostsHandler (Logic Test)", () => {
  it("merges DB published posts with fallback posts and degrades gracefully on DB error", async () => {
    const dbPost = fromPartial<PersistedBlogPostRecord>({
      id: "db-1",
      slug: "db-blog-post",
      title: "DB Blog Post",
      dek: "Dek",
      body: "<p>Body</p>",
      pillar: CONTENT_PILLARS[0],
      tags: "ts",
      published: true,
      reading_time_minutes: 4,
      hero_image_url: null,
      created_at: new Date("2026-03-01T00:00:00Z"),
      updated_at: new Date("2026-03-01T00:00:00Z"),
    });
    const okHandler = new ListPublishedBlogPostsHandler({
      blogPosts: { findMany: vi.fn().mockResolvedValue([dbPost]) },
    });
    const ok = await okHandler.execute();
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.some((p) => p.slug === "db-blog-post")).toBe(true);
    }

    const fallbackHandler = new ListPublishedBlogPostsHandler({
      blogPosts: {
        findMany: vi.fn().mockRejectedValue(new Error("DB offline")),
      },
    });
    const fb = await fallbackHandler.execute();
    expect(fb.success).toBe(true);
  });
});
