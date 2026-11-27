// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import {
  GetBlogRssFeedHandler,
  createSuccess,
  type BlogPostData,
} from "@/lib/services";

describe("GetBlogRssFeedHandler (Logic Test)", () => {
  it("renders RSS 2.0 XML containing published blog posts", async () => {
    const post = fromPartial<BlogPostData>({
      id: "p-1",
      slug: "test-rss-post",
      title: "Test RSS Post",
      dek: "Dek summary",
      body: "<p>Full body</p>",
      pillar: CONTENT_PILLARS[0],
      tags: "rss, systems",
      published: true,
      created_at: new Date("2026-02-01T00:00:00Z"),
    });
    const handler = new GetBlogRssFeedHandler({
      listPublishedPosts: vi.fn().mockResolvedValue(createSuccess([post])),
    });

    const result = await handler.execute({ baseUrl: "https://deruiter.dev" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.itemCount).toBe(1);
      expect(result.data.xml).toContain(
        "https://deruiter.dev/blog/test-rss-post"
      );
    }
  });

  it("returns RSS_GENERATION_FAILED when listing published posts throws", async () => {
    const handler = new GetBlogRssFeedHandler({
      listPublishedPosts: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const result = await handler.execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RSS_GENERATION_FAILED");
    }
  });
});
