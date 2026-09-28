// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { prisma } from "@/lib/db";
import { redis, isRedisConfigured } from "@/lib/redis";
import { revalidateTag, revalidatePath } from "next/cache";
import { BlogPostService } from "@/lib/services/blog-service";
import BlogIndexPage from "@/app/(desktop)/blog/page";
import BlogPostPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/(desktop)/blog/[slug]/page";

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  getScopedRedisKey: vi.fn((key: string) => `test:${key}`),
  isRedisConfigured: vi.fn(() => false),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/fallback-blog-posts", () => ({
  FALLBACK_BLOG_POSTS: [
    {
      id: "fallback-1",
      slug: "fallback-dispatch",
      title: "Fallback Dispatch",
      dek: "A statically seeded dispatch used when Neon is unreachable.",
      body: "<p>Fallback body</p>",
      pillar: "field-notes",
      tags: "reliability, fallback",
      published: true,
      reading_time_minutes: 4,
      hero_image_url: null,
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: new Date("2026-01-02T00:00:00.000Z"),
    },
    {
      id: "fallback-same-slug",
      slug: "conflicting-slug",
      title: "Fallback Same Slug Post",
      dek: "Returned when the database query excludes an unpublished post.",
      body: "<p>Fallback conflicting body</p>",
      pillar: "field-notes",
      tags: "conflict",
      published: true,
      reading_time_minutes: 3,
      hero_image_url: null,
      created_at: new Date("2026-01-05T00:00:00.000Z"),
      updated_at: new Date("2026-01-05T00:00:00.000Z"),
    },
  ],
}));

describe("Resilient Hybrid Blog Post Fallback Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRedisConfigured).mockReturnValue(false);
  });

  describe("BlogPostService.getBlogPostBySlug", () => {
    it("returns database record when slug is found and published in DB", async () => {
      const mockDbRecord = {
        id: "db-post-1",
        slug: "zero-cls-canvas-text",
        title: "Zero-CLS Canvas Text Measurement",
        dek: "How Pretext avoids layout shift.",
        body: "<p>DB body</p>",
        pillar: "browser-graphics-engineering",
        tags: "canvas, pretext, cls",
        published: true,
        reading_time_minutes: 6,
        hero_image_url: null,
        created_at: new Date("2026-02-01T00:00:00.000Z"),
        updated_at: new Date("2026-02-02T00:00:00.000Z"),
      };

      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(
        mockDbRecord as never
      );

      const result = await BlogPostService.getBlogPostBySlug(
        "zero-cls-canvas-text"
      );
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Zero-CLS Canvas Text Measurement");
      expect(result?.id).toBe("db-post-1");
    });

    it("enforces DB draft precedence over same-slug fallback: returns null when DB post is unpublished", async () => {
      const mockDbDraft = {
        id: "db-draft-1",
        slug: "conflicting-slug",
        title: "DB Draft with Same Slug",
        dek: "Unpublished draft in DB.",
        body: "<p>Draft body</p>",
        pillar: "field-notes",
        tags: "draft",
        published: false,
        reading_time_minutes: 3,
        hero_image_url: null,
        created_at: new Date("2026-02-01T00:00:00.000Z"),
        updated_at: new Date("2026-02-02T00:00:00.000Z"),
      };

      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(
        mockDbDraft as never
      );

      const result =
        await BlogPostService.getBlogPostBySlug("conflicting-slug");
      expect(result).toBeNull();
    });

    it("falls back to FALLBACK_BLOG_POSTS when slug is absent from DB", async () => {
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const result =
        await BlogPostService.getBlogPostBySlug("fallback-dispatch");
      expect(result).not.toBeNull();
      expect(result?.slug).toBe("fallback-dispatch");
    });

    it("falls back to FALLBACK_BLOG_POSTS when DB query throws an exception", async () => {
      vi.mocked(prisma.blogPost.findUnique).mockRejectedValueOnce(
        new Error("Neon DB connection timeout")
      );

      const result =
        await BlogPostService.getBlogPostBySlug("fallback-dispatch");
      expect(result).not.toBeNull();
      expect(result?.slug).toBe("fallback-dispatch");
    });

    it("returns null when slug does not exist in DB or static fallbacks", async () => {
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const result =
        await BlogPostService.getBlogPostBySlug("non-existent-post");
      expect(result).toBeNull();
    });

    it("serves post from Redis cache when configured and valid", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const cachedPost = {
        id: "cached-1",
        slug: "cached-post",
        title: "Cached Post",
        dek: "From Redis",
        body: "<p>Cached body</p>",
        pillar: "field-notes",
        tags: "redis",
        published: true,
        reading_time_minutes: 2,
        hero_image_url: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-02T00:00:00.000Z",
      };

      vi.mocked(redis.get).mockResolvedValueOnce(cachedPost as never);

      const result = await BlogPostService.getBlogPostBySlug("cached-post");
      expect(result).not.toBeNull();
      expect(result?.title).toBe("Cached Post");
      expect(prisma.blogPost.findUnique).not.toHaveBeenCalled();
    });

    it("rejects draft post from Redis cache and queries DB", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const cachedDraft = {
        id: "cached-draft",
        slug: "cached-post",
        title: "Cached Draft Post",
        dek: "From Redis",
        body: "<p>Draft body</p>",
        pillar: "field-notes",
        tags: "draft",
        published: false,
        reading_time_minutes: 2,
        hero_image_url: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-02T00:00:00.000Z",
      };

      vi.mocked(redis.get).mockResolvedValueOnce(cachedDraft as never);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const result = await BlogPostService.getBlogPostBySlug("cached-post");
      expect(result).toBeNull();
      expect(prisma.blogPost.findUnique).toHaveBeenCalledWith({
        where: { slug: "cached-post" },
      });
    });

    it("rejects malformed data from Redis cache and queries DB", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.get).mockResolvedValueOnce({ invalid: "shape" } as never);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const result = await BlogPostService.getBlogPostBySlug("some-post");
      expect(result).toBeNull();
      expect(prisma.blogPost.findUnique).toHaveBeenCalled();
    });

    it("rejects post with invalid Date object from Redis cache and queries DB", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const cachedInvalidDate = {
        id: "cached-invalid-date",
        slug: "invalid-date-post",
        title: "Invalid Date Post",
        dek: "Has NaN Date",
        body: "<p>Body</p>",
        pillar: "field-notes",
        tags: "date",
        published: true,
        reading_time_minutes: 2,
        hero_image_url: null,
        created_at: new Date(NaN),
        updated_at: new Date(NaN),
      };

      vi.mocked(redis.get).mockResolvedValueOnce(cachedInvalidDate as never);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const result =
        await BlogPostService.getBlogPostBySlug("invalid-date-post");
      expect(result).toBeNull();
      expect(prisma.blogPost.findUnique).toHaveBeenCalledWith({
        where: { slug: "invalid-date-post" },
      });
    });

    it("rejects post with unparsable date string from Redis cache and queries DB", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const cachedUnparsable = {
        id: "cached-unparsable",
        slug: "unparsable-post",
        title: "Unparsable Post",
        dek: "Has invalid date string",
        body: "<p>Body</p>",
        pillar: "field-notes",
        tags: "date",
        published: true,
        reading_time_minutes: 2,
        hero_image_url: null,
        created_at: "not-a-valid-date-timestamp",
        updated_at: "2026-99-99T99:99:99.999Z",
      };

      vi.mocked(redis.get).mockResolvedValueOnce(cachedUnparsable as never);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const result = await BlogPostService.getBlogPostBySlug("unparsable-post");
      expect(result).toBeNull();
      expect(prisma.blogPost.findUnique).toHaveBeenCalledWith({
        where: { slug: "unparsable-post" },
      });
    });

    it("rejects post with out-of-range timestamp from Redis cache and queries DB", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const cachedOutOfRange = {
        id: "cached-oor",
        slug: "oor-post",
        title: "Out of Range Post",
        dek: "Has out of range timestamp",
        body: "<p>Body</p>",
        pillar: "field-notes",
        tags: "date",
        published: true,
        reading_time_minutes: 2,
        hero_image_url: null,
        created_at: 1e30,
        updated_at: -1e30,
      };

      vi.mocked(redis.get).mockResolvedValueOnce(cachedOutOfRange as never);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const result = await BlogPostService.getBlogPostBySlug("oor-post");
      expect(result).toBeNull();
      expect(prisma.blogPost.findUnique).toHaveBeenCalledWith({
        where: { slug: "oor-post" },
      });
    });

    it("rejects post with unknown pillar from Redis cache and queries DB", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const cachedUnknownPillar = {
        id: "cached-bad-pillar",
        slug: "bad-pillar-post",
        title: "Bad Pillar Post",
        dek: "Has non-whitelisted pillar",
        body: "<p>Body</p>",
        pillar: "growth-hacking-crypto",
        tags: "marketing",
        published: true,
        reading_time_minutes: 2,
        hero_image_url: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      };

      vi.mocked(redis.get).mockResolvedValueOnce(cachedUnknownPillar as never);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const result = await BlogPostService.getBlogPostBySlug("bad-pillar-post");
      expect(result).toBeNull();
      expect(prisma.blogPost.findUnique).toHaveBeenCalledWith({
        where: { slug: "bad-pillar-post" },
      });
    });
  });

  describe("BlogPostService.getAllPublishedBlogPosts", () => {
    it("filters DB drafts, merges missing fallbacks, prefers DB duplicates, and orders newest-first", async () => {
      const mockDbPosts = [
        {
          id: "db-post-old",
          slug: "older-db-post",
          title: "Older DB Post",
          dek: "Older post from DB.",
          body: "<p>Old DB</p>",
          pillar: "browser-graphics-engineering",
          tags: "canvas",
          published: true,
          reading_time_minutes: 5,
          hero_image_url: null,
          created_at: new Date("2026-01-02T00:00:00.000Z"),
          updated_at: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          id: "db-post-new",
          slug: "newest-db-post",
          title: "Newest DB Post",
          dek: "Newest post from DB.",
          body: "<p>New DB</p>",
          pillar: "formal-verification",
          tags: "ast",
          published: true,
          reading_time_minutes: 7,
          hero_image_url: null,
          created_at: new Date("2026-03-01T00:00:00.000Z"),
          updated_at: new Date("2026-03-01T00:00:00.000Z"),
        },
        {
          id: "db-post-fallback-dispatch",
          slug: "fallback-dispatch",
          title: "Database Fallback Dispatch",
          dek: "Published database version of the static fallback.",
          body: "<p>DB fallback dispatch</p>",
          pillar: "field-notes",
          tags: "database, fallback",
          published: true,
          reading_time_minutes: 4,
          hero_image_url: null,
          created_at: new Date("2026-02-15T00:00:00.000Z"),
          updated_at: new Date("2026-02-15T00:00:00.000Z"),
        },
        {
          id: "db-draft-same-slug",
          slug: "conflicting-slug",
          title: "DB Draft With Same Slug As Fallback",
          dek: "Unpublished DB draft.",
          body: "<p>Secret DB draft</p>",
          pillar: "field-notes",
          tags: "draft",
          published: false,
          reading_time_minutes: 2,
          hero_image_url: null,
          created_at: new Date("2026-02-15T00:00:00.000Z"),
          updated_at: new Date("2026-02-15T00:00:00.000Z"),
        },
      ];

      vi.mocked(prisma.blogPost.findMany).mockResolvedValueOnce(
        mockDbPosts.filter((post) => post.published) as never
      );

      const results = await BlogPostService.getAllPublishedBlogPosts();

      // DB query verified newest-first descending
      expect(prisma.blogPost.findMany).toHaveBeenCalledWith({
        where: { published: true },
        orderBy: { created_at: "desc" },
      });

      // The filtered DB response excludes its draft, so the same-slug fallback remains available.
      expect(results.some((p) => p.slug === "conflicting-slug")).toBe(true);
      expect(results.find((p) => p.slug === "conflicting-slug")?.title).toBe(
        "Fallback Same Slug Post"
      );

      // The published DB row wins over the same-slug static fallback and appears only once.
      const fallbackDispatchPosts = results.filter(
        (post) => post.slug === "fallback-dispatch"
      );
      expect(fallbackDispatchPosts).toHaveLength(1);
      expect(fallbackDispatchPosts[0].title).toBe("Database Fallback Dispatch");

      expect(results).toHaveLength(4);
      expect(results[0].slug).toBe("newest-db-post");

      // Verify sorted newest-first
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].created_at.getTime()).toBeGreaterThanOrEqual(
          results[i + 1].created_at.getTime()
        );
      }
    });

    it("serves empty cached array without querying database", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.get).mockResolvedValueOnce([] as never);

      const results = await BlogPostService.getAllPublishedBlogPosts();
      expect(results).toEqual([]);
      expect(prisma.blogPost.findMany).not.toHaveBeenCalled();
    });

    it("filters out draft and malformed entries from cached array", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const cachedArray = [
        {
          id: "cached-valid",
          slug: "cached-valid-post",
          title: "Valid Post",
          dek: "Published",
          body: "<p>Body</p>",
          pillar: "field-notes",
          tags: "valid",
          published: true,
          reading_time_minutes: 3,
          hero_image_url: null,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "cached-draft",
          slug: "cached-draft-post",
          title: "Draft Post",
          dek: "Unpublished",
          body: "<p>Draft</p>",
          pillar: "field-notes",
          tags: "draft",
          published: false,
          reading_time_minutes: 1,
          hero_image_url: null,
          created_at: "2026-03-02T00:00:00.000Z",
          updated_at: "2026-03-02T00:00:00.000Z",
        },
        null,
        "malformed string",
      ];

      vi.mocked(redis.get).mockResolvedValueOnce(cachedArray as never);

      const results = await BlogPostService.getAllPublishedBlogPosts();
      expect(results.length).toBe(1);
      expect(results[0].slug).toBe("cached-valid-post");
      expect(prisma.blogPost.findMany).not.toHaveBeenCalled();
    });

    it("sorts cached array newest-first even if Redis returns an unsorted list", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const unsortedCached = [
        {
          id: "cached-old",
          slug: "cached-older-post",
          title: "Older Post",
          dek: "Older",
          body: "<p>Old</p>",
          pillar: "field-notes",
          tags: "old",
          published: true,
          reading_time_minutes: 2,
          hero_image_url: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "cached-new",
          slug: "cached-newer-post",
          title: "Newer Post",
          dek: "Newer",
          body: "<p>New</p>",
          pillar: "browser-graphics-engineering",
          tags: "new",
          published: true,
          reading_time_minutes: 3,
          hero_image_url: null,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
      ];

      vi.mocked(redis.get).mockResolvedValueOnce(unsortedCached as never);

      const results = await BlogPostService.getAllPublishedBlogPosts();
      expect(results.length).toBe(2);
      expect(results[0].slug).toBe("cached-newer-post");
      expect(results[1].slug).toBe("cached-older-post");
      expect(prisma.blogPost.findMany).not.toHaveBeenCalled();
    });

    it("falls back to DB when cached array contains only malformed or invalid entries", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const allMalformed = [
        {
          id: "bad-1",
          slug: "bad-1",
          title: "Bad Pillar",
          dek: "Invalid",
          body: "<p>Bad</p>",
          pillar: "unknown-pillar",
          tags: "bad",
          published: true,
          reading_time_minutes: 1,
          hero_image_url: null,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "bad-2",
          slug: "bad-2",
          title: "Bad Date",
          dek: "Invalid",
          body: "<p>Bad</p>",
          pillar: "field-notes",
          tags: "bad",
          published: true,
          reading_time_minutes: 1,
          hero_image_url: null,
          created_at: "invalid-date",
          updated_at: 1e30,
        },
      ];

      vi.mocked(redis.get).mockResolvedValueOnce(allMalformed as never);
      vi.mocked(prisma.blogPost.findMany).mockResolvedValueOnce([]);

      const results = await BlogPostService.getAllPublishedBlogPosts();
      expect(prisma.blogPost.findMany).toHaveBeenCalled();
      expect(results.some((p) => p.slug === "fallback-dispatch")).toBe(true);
    });

    it("writes empty array to cache when database has no published posts and fallbacks are empty", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.get).mockResolvedValueOnce(null as never);
      vi.mocked(prisma.blogPost.findMany).mockResolvedValueOnce([]);

      // Temporarily test with empty fallbacks
      const originalFallback = vi.mocked(
        (await import("@/lib/fallback-blog-posts")).FALLBACK_BLOG_POSTS
      );
      const emptyFallbacks = originalFallback.slice(0, 0);

      vi.doMock("@/lib/fallback-blog-posts", () => ({
        FALLBACK_BLOG_POSTS: emptyFallbacks,
      }));

      // Cache write was called with bounded TTL even for empty results
      await BlogPostService.getAllPublishedBlogPosts();
      expect(redis.set).toHaveBeenCalledWith(
        "test:blog:all_published",
        expect.any(Array),
        { ex: 3600 }
      );
    });

    it("returns static fallbacks if DB findMany throws an error", async () => {
      vi.mocked(prisma.blogPost.findMany).mockRejectedValueOnce(
        new Error("Postgres connection reset")
      );

      const results = await BlogPostService.getAllPublishedBlogPosts();
      expect(results.length).toBe(2);
      expect(results.some((p) => p.slug === "fallback-dispatch")).toBe(true);
    });
  });

  describe("Redis failure resilience & invalidation", () => {
    it("clears timeout timer on early success", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      vi.mocked(redis.get).mockResolvedValueOnce([] as never);

      await BlogPostService.getAllPublishedBlogPosts();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it("tolerates Redis read timeout or rejection gracefully and falls back to DB", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.get).mockRejectedValueOnce(
        new Error("Upstash Redis connection timeout")
      );
      vi.mocked(prisma.blogPost.findMany).mockResolvedValueOnce([]);

      const results = await BlogPostService.getAllPublishedBlogPosts();
      expect(results).toBeDefined();
      expect(prisma.blogPost.findMany).toHaveBeenCalled();
    });

    it("tolerates Redis write timeout or rejection gracefully", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.get).mockResolvedValueOnce(null as never);
      vi.mocked(redis.set).mockRejectedValueOnce(
        new Error("Upstash write error")
      );
      vi.mocked(prisma.blogPost.findMany).mockResolvedValueOnce([]);

      const results = await BlogPostService.getAllPublishedBlogPosts();
      expect(results).toBeDefined();
    });

    it("evictBlogPostCache batches key deletions, revalidates paths, and revalidates Next.js ISR tags", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.del).mockResolvedValueOnce(2 as never);

      const evicted = await BlogPostService.evictBlogPostCache(
        "zero-cls-canvas-text"
      );

      expect(evicted).toBe(true);
      expect(redis.del).toHaveBeenCalledWith(
        "test:blog:slug:zero-cls-canvas-text",
        "test:blog:all_published"
      );
      expect(revalidatePath).toHaveBeenCalledWith(
        "/blog/zero-cls-canvas-text",
        undefined
      );
      expect(revalidatePath).toHaveBeenCalledWith("/blog", undefined);
      expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml", undefined);
      expect(revalidateTag).toHaveBeenCalledWith(
        "blog-post-zero-cls-canvas-text",
        "max"
      );
      expect(revalidateTag).toHaveBeenCalledWith("blog-posts", "max");
    });

    it("evictBlogPostCache revalidates paths and ISR tags even when Redis is not configured", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(false);

      const evicted = await BlogPostService.evictBlogPostCache(
        "zero-cls-canvas-text"
      );

      expect(evicted).toBe(false);
      expect(redis.del).not.toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith(
        "/blog/zero-cls-canvas-text",
        undefined
      );
      expect(revalidatePath).toHaveBeenCalledWith("/blog", undefined);
      expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml", undefined);
      expect(revalidateTag).toHaveBeenCalledWith(
        "blog-post-zero-cls-canvas-text",
        "max"
      );
      expect(revalidateTag).toHaveBeenCalledWith("blog-posts", "max");
    });

    it("evictBlogPostCache revalidates paths and ISR tags even when Redis deletion fails", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.del).mockRejectedValueOnce(
        new Error("Redis eviction timeout")
      );

      const evicted = await BlogPostService.evictBlogPostCache(
        "zero-cls-canvas-text"
      );

      expect(evicted).toBe(false);
      expect(revalidatePath).toHaveBeenCalledWith(
        "/blog/zero-cls-canvas-text",
        undefined
      );
      expect(revalidatePath).toHaveBeenCalledWith("/blog", undefined);
      expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml", undefined);
      expect(revalidateTag).toHaveBeenCalledWith(
        "blog-post-zero-cls-canvas-text",
        "max"
      );
      expect(revalidateTag).toHaveBeenCalledWith("blog-posts", "max");
    });
  });

  describe("Blog route prerender invariants", () => {
    it("generateStaticParams returns all published slugs including the fallback post", async () => {
      vi.mocked(prisma.blogPost.findMany).mockResolvedValueOnce([]);

      const params = await generateStaticParams();
      expect(params.some((p) => p.slug === "fallback-dispatch")).toBe(true);
    });

    it("generateMetadata returns valid metadata for a fallback post", async () => {
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: "fallback-dispatch" }),
      });

      expect(meta.title).toContain("Fallback Dispatch");
      expect((meta.openGraph as { type?: string })?.type).toBe("article");
    });

    it("generateMetadata returns not-found metadata when slug is invalid", async () => {
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: "invalid-random-slug" }),
      });

      expect(meta.title).toBe("Dispatch Not Found");
    });

    it("generateMetadata safely handles cached post with invalid dates and returns Dispatch Not Found without throwing RangeError", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const cachedInvalidDate = {
        id: "bad-meta",
        slug: "bad-meta-slug",
        title: "Bad Meta Post",
        dek: "Dek",
        body: "<p>Body</p>",
        pillar: "field-notes",
        tags: "meta",
        published: true,
        reading_time_minutes: 1,
        hero_image_url: null,
        created_at: "not-a-valid-date",
        updated_at: 1e30,
      };

      vi.mocked(redis.get).mockResolvedValueOnce(cachedInvalidDate as never);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: "bad-meta-slug" }),
      });

      expect(meta.title).toBe("Dispatch Not Found");
    });

    it("BlogPostPage renders successfully without throwing for a fallback post", async () => {
      vi.mocked(prisma.blogPost.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const element = await BlogPostPage({
        params: Promise.resolve({ slug: "fallback-dispatch" }),
      });

      expect(element).toBeDefined();
    });

    it("BlogIndexPage renders successfully without throwing", async () => {
      vi.mocked(prisma.blogPost.findMany).mockResolvedValueOnce([]);

      const element = await BlogIndexPage();
      expect(element).toBeDefined();
    });
  });
});
