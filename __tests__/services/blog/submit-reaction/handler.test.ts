// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { ALLOWED_REACTIONS } from "@/lib/schemas";
import {
  SubmitBlogReactionHandler,
  type BlogPostData,
  type SubmitBlogReactionDeps,
} from "@/lib/services";

describe("SubmitBlogReactionHandler (Logic Test)", () => {
  it("persists reaction via direct Postgres path when Redis is disabled", async () => {
    const reactionType = ALLOWED_REACTIONS[0];
    const post = fromPartial<BlogPostData>({
      slug: "post-1",
      published: true,
    });
    const deps = fromPartial<SubmitBlogReactionDeps>({
      isRedisReady: () => false,
      getBlogPostBySlugHandler: {
        execute: async () => ({ success: true, data: post }),
      },
      db: {
        blogPostReaction: {
          findFirst: async () => null,
          create: async () => ({ id: "r-1" }),
          groupBy: async () => [{ reactionType, _count: { id: 4 } }],
          findMany: async () => [{ reactionType }],
        },
      },
    });

    const handler = new SubmitBlogReactionHandler(deps);
    const result = await handler.execute({
      blogPostSlug: "post-1",
      reactionType,
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.counts[reactionType]).toBe(4);
    }
  });

  it("returns STORAGE_UNAVAILABLE when database fails instead of ephemeral memory fallback", async () => {
    const reactionType = ALLOWED_REACTIONS[0];
    const post = fromPartial<BlogPostData>({
      slug: "post-1",
      published: true,
    });
    const deps = fromPartial<SubmitBlogReactionDeps>({
      isRedisReady: () => false,
      getBlogPostBySlugHandler: {
        execute: async () => ({ success: true, data: post }),
      },
      db: {
        blogPostReaction: {
          findFirst: async () => {
            throw new Error("DB unreachable");
          },
          create: async () => ({}),
          groupBy: async () => [],
          findMany: async () => [],
        },
      },
    });

    const handler = new SubmitBlogReactionHandler(deps);
    const result = await handler.execute({
      blogPostSlug: "post-1",
      reactionType,
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
