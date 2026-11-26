// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { ALLOWED_REACTIONS } from "@/lib/schemas";
import {
  SubmitBlogReactionHandler,
  type BlogPostData,
  type SubmitBlogReactionDeps,
} from "@/lib/services";

describe("SubmitBlogReactionHandler (Logic Test)", () => {
  const reactionType = ALLOWED_REACTIONS[0];
  const publishedPost = fromPartial<BlogPostData>({
    slug: "post-1",
    published: true,
  });

  it("returns INVALID_INPUT when payload fails schema validation", async () => {
    const handler = new SubmitBlogReactionHandler();
    const result = await handler.execute({
      blogPostSlug: "",
      reactionType,
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("returns NOT_FOUND when target blog post is missing or unpublished", async () => {
    const deps = fromPartial<SubmitBlogReactionDeps>({
      getBlogPostBySlugHandler: {
        execute: async () => ({
          success: true,
          data: fromPartial<BlogPostData>({ slug: "post-1", published: false }),
        }),
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
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("persists reaction via direct Postgres path when Redis is disabled", async () => {
    const deps = fromPartial<SubmitBlogReactionDeps>({
      isRedisReady: () => false,
      getBlogPostBySlugHandler: {
        execute: async () => ({ success: true, data: publishedPost }),
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

  it("returns RATE_LIMITED on duplicate reaction via direct Postgres path", async () => {
    const deps = fromPartial<SubmitBlogReactionDeps>({
      isRedisReady: () => false,
      getBlogPostBySlugHandler: {
        execute: async () => ({ success: true, data: publishedPost }),
      },
      db: {
        blogPostReaction: {
          findFirst: async () => ({ id: "existing-1" }),
          create: async () => ({}),
          groupBy: async () => [{ reactionType, _count: { id: 2 } }],
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
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("RATE_LIMITED");
    }
  });

  it("returns STORAGE_UNAVAILABLE when database fails instead of ephemeral memory fallback", async () => {
    const deps = fromPartial<SubmitBlogReactionDeps>({
      isRedisReady: () => false,
      getBlogPostBySlugHandler: {
        execute: async () => ({ success: true, data: publishedPost }),
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

  it("buffers new reaction in Redis pipeline and merges base + buffered counts", async () => {
    const exec = vi.fn(async () => []);
    const deps = fromPartial<SubmitBlogReactionDeps>({
      isRedisReady: () => true,
      idGenerator: () => "evt-1",
      getBlogPostBySlugHandler: {
        execute: async () => ({ success: true, data: publishedPost }),
      },
      redisClient: {
        sismember: async () => 0,
        pipeline: () => ({
          sadd: vi.fn(),
          expire: vi.fn(),
          hincrby: vi.fn(),
          rpush: vi.fn(),
          exec,
        }),
        smembers: async () => [],
        get: async () => fromAny({ [reactionType]: 3 }),
        hgetall: async () => fromAny({ [reactionType]: "2" }),
      },
    });

    const handler = new SubmitBlogReactionHandler(deps);
    const result = await handler.execute({
      blogPostSlug: "post-1",
      reactionType,
      connectionHash: "hash-1",
    });
    expect(result.success).toBe(true);
    expect(exec).toHaveBeenCalledTimes(1);
    if (result.success) {
      expect(result.data.counts[reactionType]).toBe(5);
      expect(result.data.userReactions).toContain(reactionType);
    }
  });

  it("returns RATE_LIMITED when Redis sismember detects duplicate reaction", async () => {
    const deps = fromPartial<SubmitBlogReactionDeps>({
      isRedisReady: () => true,
      getBlogPostBySlugHandler: {
        execute: async () => ({ success: true, data: publishedPost }),
      },
      redisClient: {
        sismember: async () => 1,
        smembers: async () => [reactionType],
        get: async () => fromAny({ [reactionType]: 1 }),
        hgetall: async () => fromAny({ [reactionType]: 2 }),
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
      expect(result.error.code).toBe("RATE_LIMITED");
    }
  });

  it("falls back to direct Postgres path in non-production when Redis throws", async () => {
    const deps = fromPartial<SubmitBlogReactionDeps>({
      isRedisReady: () => true,
      getBlogPostBySlugHandler: {
        execute: async () => ({ success: true, data: publishedPost }),
      },
      redisClient: {
        sismember: async () => {
          throw new Error("Redis connection reset");
        },
      },
      db: {
        blogPostReaction: {
          findFirst: async () => null,
          create: async () => ({ id: "r-fallback" }),
          groupBy: async () => [{ reactionType, _count: { id: 1 } }],
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
  });
});
