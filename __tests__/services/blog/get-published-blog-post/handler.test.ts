// @vitest-environment node
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import {
  GetPublishedBlogPostHandler,
  type PersistedBlogPostRecord,
} from "@/lib/services";

describe("GetPublishedBlogPostHandler (Logic Test)", () => {
  it("returns published blog post from DB and null for blank slug", async () => {
    const record = fromPartial<PersistedBlogPostRecord>({
      id: "p-1",
      slug: "published-post",
      title: "Published Post",
      dek: "Dek",
      body: "<p>Body</p>",
      pillar: CONTENT_PILLARS[0],
      tags: "ts",
      published: true,
      reading_time_minutes: 3,
      hero_image_url: null,
      created_at: new Date("2026-02-01T00:00:00Z"),
      updated_at: new Date("2026-02-01T00:00:00Z"),
    });
    const handler = new GetPublishedBlogPostHandler({
      blogPosts: { findUnique: vi.fn().mockResolvedValue(record) },
    });

    const found = await handler.execute({ slug: "published-post" });
    expect(found.success).toBe(true);
    if (found.success) {
      expect(found.data?.slug).toBe("published-post");
    }

    const blank = await handler.execute({ slug: "   " });
    expect(blank.success).toBe(true);
    if (blank.success) {
      expect(blank.data).toBeNull();
    }

    const invalid = await handler.execute(fromAny({ slug: 123 }));
    expect(invalid.success).toBe(false);
  });
});
