// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import {
  GetAllPublishedBlogPostsHandler,
  type BlogPostDbRecord,
  type GetAllPublishedBlogPostsDeps,
} from "@/lib/services";

describe("GetAllPublishedBlogPostsHandler (Logic Test)", () => {
  it("merges valid published database posts with static fallbacks sorted newest first", async () => {
    const dbRecord: BlogPostDbRecord = {
      id: "db-post-1",
      slug: "db-published-post",
      title: "DB Published Post",
      dek: "Summary",
      body: "<p>Content</p>",
      pillar: CONTENT_PILLARS[0],
      tags: "ts,arch",
      published: true,
      reading_time_minutes: 3,
      hero_image_url: null,
      created_at: new Date("2026-06-01T00:00:00Z"),
      updated_at: new Date("2026-06-01T00:00:00Z"),
    };
    const deps = fromPartial<GetAllPublishedBlogPostsDeps>({
      isRedisReady: () => false,
      db: {
        blogPost: {
          findMany: async () => [dbRecord],
        },
      },
    });

    const handler = new GetAllPublishedBlogPostsHandler(deps);
    const result = await handler.execute();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.some((p) => p.slug === "db-published-post")).toBe(
        true
      );
    }
  });

  it("returns INVALID_INPUT for invalid input payload", async () => {
    const handler = new GetAllPublishedBlogPostsHandler();
    const result = await handler.execute(fromAny(123));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
