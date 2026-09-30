import { describe, it, expect, vi, beforeEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import { prisma } from "@/lib/db";
import { redis, isRedisConfigured } from "@/lib/redis";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  BlogPostService,
  isValidBlogPost,
  isValidPillar,
  parseValidDate,
  parseBlogPostDates,
  toValidBlogPosts,
  compareBlogPostsNewestFirst,
} from "@/lib/services/blog-service";
import {
  getAllPublishedBlogPosts,
  getBlogPostBySlug,
  CONTENT_PILLARS,
} from "@/lib/blog";

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      create: vi.fn(),
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
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/fallback-blog-posts", () => ({
  FALLBACK_BLOG_POSTS: [
    {
      id: "fallback-inv-1",
      slug: "fallback-post-alpha",
      title: "Fallback Post Alpha",
      dek: "Seeded fallback post for testing.",
      body: "<p>Alpha fallback body</p>",
      pillar: "formal-verification",
      tags: "testing, verification",
      published: true,
      reading_time_minutes: 5,
      hero_image_url: null,
      created_at: new Date("2026-01-10T00:00:00.000Z"),
      updated_at: new Date("2026-01-10T00:00:00.000Z"),
    },
    {
      id: "fallback-inv-2",
      slug: "conflicting-draft-slug",
      title: "Fallback Conflict Post",
      dek: "Should not be returned if DB draft exists with same slug.",
      body: "<p>Conflict body</p>",
      pillar: "field-notes",
      tags: "conflict",
      published: true,
      reading_time_minutes: 3,
      hero_image_url: null,
      created_at: new Date("2026-01-12T00:00:00.000Z"),
      updated_at: new Date("2026-01-12T00:00:00.000Z"),
    },
  ],
}));

describe("Blog Cache Contracts & Concrete Invalidation Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRedisConfigured).mockReturnValue(false);
  });

  describe("Cache Invalidation (BlogPostService.evictBlogPostCache)", () => {
    it("invalidates concrete rendered route paths and tags upon eviction", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.del).mockResolvedValueOnce(2 as never);

      const success = await BlogPostService.evictBlogPostCache(
        "resilient-blog-engine"
      );

      expect(success).toBe(true);

      // Scoped Redis keys deleted
      expect(redis.del).toHaveBeenCalledWith(
        "test:blog:slug:resilient-blog-engine",
        "test:blog:all_published"
      );

      // Concrete rendered routes invalidated
      expect(revalidatePath).toHaveBeenCalledWith(
        "/blog/resilient-blog-engine",
        undefined
      );
      expect(revalidatePath).toHaveBeenCalledWith("/blog", undefined);
      expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml", undefined);

      // Cache tags dispatched with stale-while-revalidate "max"
      expect(revalidateTag).toHaveBeenCalledWith(
        "blog-post-resilient-blog-engine",
        "max"
      );
      expect(revalidateTag).toHaveBeenCalledWith("blog-posts", "max");
    });

    it("survives and suppresses revalidatePath exceptions gracefully", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.del).mockResolvedValueOnce(2 as never);
      vi.mocked(revalidatePath).mockImplementationOnce(() => {
        throw new Error(
          "Invariant: static generation store missing in revalidatePath"
        );
      });

      const success =
        await BlogPostService.evictBlogPostCache("path-error-slug");
      expect(success).toBe(true);
      expect(revalidatePath).toHaveBeenCalled();
      expect(revalidateTag).toHaveBeenCalledWith("blog-posts", "max");
    });

    it("survives and suppresses revalidateTag exceptions gracefully", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.del).mockResolvedValueOnce(2 as never);
      vi.mocked(revalidateTag).mockImplementationOnce(() => {
        throw new Error(
          "Invariant: static generation store missing in revalidateTag"
        );
      });

      const success =
        await BlogPostService.evictBlogPostCache("tag-error-slug");
      expect(success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith(
        "/blog/tag-error-slug",
        undefined
      );
    });

    it("runs path and tag invalidations even when Redis deletion rejects or times out", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.del).mockRejectedValueOnce(
        new Error("Redis cache eviction timeout")
      );

      const success = await BlogPostService.evictBlogPostCache("timeout-slug");
      expect(success).toBe(false);

      expect(revalidatePath).toHaveBeenCalledWith(
        "/blog/timeout-slug",
        undefined
      );
      expect(revalidatePath).toHaveBeenCalledWith("/blog", undefined);
      expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml", undefined);
      expect(revalidateTag).toHaveBeenCalledWith(
        "blog-post-timeout-slug",
        "max"
      );
      expect(revalidateTag).toHaveBeenCalledWith("blog-posts", "max");
    });

    it("runs path and tag invalidations when Redis is unconfigured", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(false);

      const success = await BlogPostService.evictBlogPostCache("offline-slug");
      expect(success).toBe(false);
      expect(redis.del).not.toHaveBeenCalled();

      expect(revalidatePath).toHaveBeenCalledWith(
        "/blog/offline-slug",
        undefined
      );
      expect(revalidatePath).toHaveBeenCalledWith("/blog", undefined);
      expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml", undefined);
      expect(revalidateTag).toHaveBeenCalledWith(
        "blog-post-offline-slug",
        "max"
      );
      expect(revalidateTag).toHaveBeenCalledWith("blog-posts", "max");
    });

    it("rejects empty or whitespace-only slug safely without invoking eviction", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);

      const emptyRes = await BlogPostService.evictBlogPostCache("");
      const wsRes = await BlogPostService.evictBlogPostCache("   ");

      expect(emptyRes).toBe(false);
      expect(wsRes).toBe(false);
      expect(redis.del).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(revalidateTag).not.toHaveBeenCalled();
    });

    it("rejects non-string slug (null, undefined, number) safely without throwing", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);

      expect(await BlogPostService.evictBlogPostCache(fromAny(null))).toBe(
        false
      );
      expect(await BlogPostService.evictBlogPostCache(fromAny(undefined))).toBe(
        false
      );
      expect(await BlogPostService.evictBlogPostCache(fromAny(123))).toBe(
        false
      );
      expect(redis.del).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("Draft shadowing of warmed public fallbacks", () => {
    it("evicts a warmed fallback and keeps a same-slug draft out of public detail and list contracts", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.get)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValueOnce(null as never);
      vi.mocked(redis.del).mockResolvedValue(2 as never);

      vi.mocked(prisma.blogPost.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "draft-shadow-1",
          slug: "conflicting-draft-slug",
          title: "Same Slug Draft",
          dek: "This persisted draft shadows the static fallback.",
          body: "<p>Draft body.</p>",
          pillar: "field-notes",
          tags: "draft",
          published: false,
          reading_time_minutes: 1,
          hero_image_url: null,
          created_at: new Date("2026-09-14T00:00:00.000Z"),
          updated_at: new Date("2026-09-14T00:00:00.000Z"),
        });
      vi.mocked(prisma.blogPost.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "draft-shadow-1",
            slug: "conflicting-draft-slug",
            title: "Same Slug Draft",
            dek: "This persisted draft shadows the static fallback.",
            body: "<p>Draft body.</p>",
            pillar: "field-notes",
            tags: "draft",
            published: false,
            reading_time_minutes: 1,
            hero_image_url: null,
            created_at: new Date("2026-09-14T00:00:00.000Z"),
            updated_at: new Date("2026-09-14T00:00:00.000Z"),
          },
        ]);
      vi.mocked(prisma.blogPost.create).mockResolvedValue({
        id: "draft-shadow-1",
        slug: "conflicting-draft-slug",
        title: "Same Slug Draft",
        dek: "This persisted draft shadows the static fallback.",
        body: "<p>Draft body.</p>",
        pillar: "field-notes",
        tags: "draft",
        published: false,
        reading_time_minutes: 1,
        hero_image_url: null,
        created_at: new Date("2026-09-14T00:00:00.000Z"),
        updated_at: new Date("2026-09-14T00:00:00.000Z"),
      });

      const warmedFallback = await getBlogPostBySlug("conflicting-draft-slug");
      await getAllPublishedBlogPosts();
      await BlogPostService.createDraftBlogPost({
        title: "Same Slug Draft",
        slug: "conflicting-draft-slug",
        dek: "This persisted draft shadows the static fallback.",
        body: "<p>Draft body.</p>",
        pillar: "field-notes",
        tags: "draft",
        hero_image_url: null,
      });
      const publicDetail = await getBlogPostBySlug("conflicting-draft-slug");
      const publicList = await getAllPublishedBlogPosts();

      expect(warmedFallback?.slug).toBe("conflicting-draft-slug");
      expect(redis.del).toHaveBeenCalledWith(
        "test:blog:slug:conflicting-draft-slug",
        "test:blog:all_published"
      );
      expect(publicDetail).toBeNull();
      expect(publicList).not.toContainEqual(
        expect.objectContaining({ slug: "conflicting-draft-slug" })
      );
    });
  });

  describe("Date Boundary Parsing & Validation (parseValidDate)", () => {
    it("accepts valid Date objects and preserves them", () => {
      const now = new Date("2026-05-15T12:00:00.000Z");
      const parsed = parseValidDate(now);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.toISOString()).toBe("2026-05-15T12:00:00.000Z");
    });

    it("accepts valid ISO date strings and parses to Date", () => {
      const parsed = parseValidDate("2026-07-20T08:30:00.000Z");
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.toISOString()).toBe("2026-07-20T08:30:00.000Z");
    });

    it("accepts valid numeric millisecond timestamps within range", () => {
      const ts = Date.UTC(2026, 4, 1, 0, 0, 0);
      const parsed = parseValidDate(ts);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getTime()).toBe(ts);
    });

    it("rejects invalid Date objects (NaN)", () => {
      expect(parseValidDate(new Date(NaN))).toBeNull();
      expect(parseValidDate(new Date("invalid"))).toBeNull();
    });

    it("rejects unparsable date strings", () => {
      expect(parseValidDate("")).toBeNull();
      expect(parseValidDate("   ")).toBeNull();
      expect(parseValidDate("not-a-date")).toBeNull();
      expect(parseValidDate("2026-99-99T99:99:99.999Z")).toBeNull();
    });

    it("rejects out-of-range numeric timestamps", () => {
      expect(parseValidDate(NaN)).toBeNull();
      expect(parseValidDate(Infinity)).toBeNull();
      expect(parseValidDate(-Infinity)).toBeNull();
      expect(parseValidDate(1e30)).toBeNull();
      expect(parseValidDate(-1e30)).toBeNull();
      expect(parseValidDate(-1)).toBeNull(); // Before 1970
      expect(parseValidDate(253402300800000)).toBeNull(); // Year > 9999
    });

    it("rejects non-date primitives (null, undefined, boolean, object)", () => {
      expect(parseValidDate(null)).toBeNull();
      expect(parseValidDate(undefined)).toBeNull();
      expect(parseValidDate(true)).toBeNull();
      expect(parseValidDate(false)).toBeNull();
      expect(parseValidDate({})).toBeNull();
      expect(parseValidDate([])).toBeNull();
    });

    it("returns an isolated Date instance that cannot mutate original input", () => {
      const original = new Date("2026-06-01T12:00:00.000Z");
      const parsed = parseValidDate(original);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getTime()).toBe(original.getTime());

      // Mutate parsed and ensure original is untouched
      parsed?.setFullYear(2030);
      expect(original.getUTCFullYear()).toBe(2026);
    });
  });

  describe("Date Coercion (parseBlogPostDates)", () => {
    const rawPost = {
      id: "raw-1",
      slug: "raw-slug",
      title: "Raw Title",
      dek: "Raw Dek",
      body: "<p>Body</p>",
      pillar: "formal-verification",
      tags: "testing",
      published: true,
      reading_time_minutes: 5,
      hero_image_url: null,
      created_at: fromAny<Date, unknown>("2026-05-01T00:00:00.000Z"),
      updated_at: fromAny<Date, unknown>("2026-05-02T00:00:00.000Z"),
    };

    it("coerces string dates into validated Date instances", () => {
      const result = parseBlogPostDates(rawPost);
      if (!result.success) throw new Error("expected valid dates");
      const parsed = result.data;
      expect(parsed.created_at).toBeInstanceOf(Date);
      expect(parsed.updated_at).toBeInstanceOf(Date);
      expect(parsed.created_at.toISOString()).toBe("2026-05-01T00:00:00.000Z");
      expect(parsed.updated_at.toISOString()).toBe("2026-05-02T00:00:00.000Z");
    });

    it("returns INVALID_DATE_CONTRACT instead of throwing for unparsable or invalid dates (#1532)", () => {
      const invalidDateFailure = {
        success: false,
        error: {
          code: "INVALID_DATE_CONTRACT",
          message:
            'parseBlogPostDates: Invalid date contract for blog post "raw-slug"',
          recoverable: false,
        },
      };

      expect(
        parseBlogPostDates({
          ...rawPost,
          created_at: fromAny<Date, unknown>("unparsable-garbage"),
        })
      ).toMatchObject(invalidDateFailure);

      expect(
        parseBlogPostDates({
          ...rawPost,
          updated_at: new Date(NaN),
        })
      ).toMatchObject(invalidDateFailure);
    });

    it("keeps only valid records, with coerced dates, in toValidBlogPosts", () => {
      const posts = toValidBlogPosts([
        rawPost,
        { ...rawPost, slug: "bad-date", created_at: "garbage" },
        { slug: "not-a-post" },
        null,
      ]);

      expect(posts.map((p) => p.slug)).toEqual(["raw-slug"]);
      expect(posts[0].created_at).toBeInstanceOf(Date);
    });
  });

  describe("Pillar Taxonomy Validation (isValidPillar)", () => {
    it("accepts all defined CONTENT_PILLARS", () => {
      for (const pillar of CONTENT_PILLARS) {
        expect(isValidPillar(pillar)).toBe(true);
      }
    });

    it("rejects unknown, arbitrary or empty pillars", () => {
      expect(isValidPillar("")).toBe(false);
      expect(isValidPillar("unknown-pillar")).toBe(false);
      expect(isValidPillar("marketing")).toBe(false);
      expect(isValidPillar("growth-hacking")).toBe(false);
      expect(isValidPillar(123)).toBe(false);
      expect(isValidPillar(null)).toBe(false);
      expect(isValidPillar(undefined)).toBe(false);
    });
  });

  describe("Cached Blog Post Contract Assertion (isValidBlogPost)", () => {
    const validPost = {
      id: "valid-1",
      slug: "valid-slug",
      title: "Valid Title",
      dek: "Valid Dek",
      body: "<p>Valid Body</p>",
      pillar: "formal-verification",
      tags: "verification, formal",
      published: true,
      reading_time_minutes: 4,
      hero_image_url: null,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-02T00:00:00.000Z",
    };

    it("accepts completely valid post records", () => {
      expect(isValidBlogPost(validPost)).toBe(true);
    });

    it("rejects records with unpublished status", () => {
      expect(isValidBlogPost({ ...validPost, published: false })).toBe(false);
    });

    it("rejects records missing or whitespace-only required string fields", () => {
      expect(isValidBlogPost({ ...validPost, id: "" })).toBe(false);
      expect(isValidBlogPost({ ...validPost, id: "   " })).toBe(false);
      expect(isValidBlogPost({ ...validPost, slug: "" })).toBe(false);
      expect(isValidBlogPost({ ...validPost, slug: "   " })).toBe(false);
      expect(isValidBlogPost({ ...validPost, title: "" })).toBe(false);
      expect(isValidBlogPost({ ...validPost, title: "   " })).toBe(false);
      expect(isValidBlogPost({ ...validPost, title: 123 })).toBe(false);
      expect(isValidBlogPost({ ...validPost, dek: null })).toBe(false);
      expect(isValidBlogPost({ ...validPost, body: undefined })).toBe(false);
      expect(isValidBlogPost({ ...validPost, tags: ["array-tags"] })).toBe(
        false
      );
    });

    it("rejects records with invalid reading_time_minutes", () => {
      expect(isValidBlogPost({ ...validPost, reading_time_minutes: -1 })).toBe(
        false
      );
      expect(
        isValidBlogPost({
          ...validPost,
          reading_time_minutes: fromAny("five"),
        })
      ).toBe(false);
      expect(isValidBlogPost({ ...validPost, reading_time_minutes: NaN })).toBe(
        false
      );
      expect(
        isValidBlogPost({
          ...validPost,
          reading_time_minutes: Infinity,
        })
      ).toBe(false);
    });

    it("accepts records with valid reading_time_minutes (positive, zero, null, undefined)", () => {
      expect(isValidBlogPost({ ...validPost, reading_time_minutes: 0 })).toBe(
        true
      );
      expect(isValidBlogPost({ ...validPost, reading_time_minutes: 10 })).toBe(
        true
      );
      expect(
        isValidBlogPost({ ...validPost, reading_time_minutes: null })
      ).toBe(true);
      expect(
        isValidBlogPost({ ...validPost, reading_time_minutes: undefined })
      ).toBe(true);
    });

    it("rejects records with invalid hero_image_url (non-string types)", () => {
      expect(
        isValidBlogPost({
          ...validPost,
          hero_image_url: fromAny(12345),
        })
      ).toBe(false);
      expect(
        isValidBlogPost({
          ...validPost,
          hero_image_url: fromAny({ url: "malicious" }),
        })
      ).toBe(false);
    });

    it("accepts records with valid hero_image_url (string, null, undefined)", () => {
      expect(
        isValidBlogPost({
          ...validPost,
          hero_image_url: "https://example.com/hero.jpg",
        })
      ).toBe(true);
      expect(isValidBlogPost({ ...validPost, hero_image_url: null })).toBe(
        true
      );
      expect(isValidBlogPost({ ...validPost, hero_image_url: undefined })).toBe(
        true
      );
    });

    it("rejects records with non-whitelisted pillar", () => {
      expect(isValidBlogPost({ ...validPost, pillar: "ai-hype" })).toBe(false);
    });

    it("rejects records with invalid created_at or updated_at dates", () => {
      expect(isValidBlogPost({ ...validPost, created_at: new Date(NaN) })).toBe(
        false
      );
      expect(isValidBlogPost({ ...validPost, created_at: "invalid" })).toBe(
        false
      );
      expect(isValidBlogPost({ ...validPost, created_at: 1e30 })).toBe(false);
      expect(isValidBlogPost({ ...validPost, updated_at: "2026-99-99" })).toBe(
        false
      );
    });
  });

  describe("Deterministic Ordering Contracts", () => {
    it("compareBlogPostsNewestFirst sorts newest-first by created_at", () => {
      const older = {
        created_at: new Date("2026-01-01T00:00:00.000Z"),
        slug: "post-a",
      };
      const newer = {
        created_at: new Date("2026-02-01T00:00:00.000Z"),
        slug: "post-b",
      };

      const sorted = [older, newer].sort(compareBlogPostsNewestFirst);
      expect(sorted[0].slug).toBe("post-b");
      expect(sorted[1].slug).toBe("post-a");
    });

    it("compareBlogPostsNewestFirst uses slug ascending as deterministic tie-breaker", () => {
      const sameTimeA = {
        created_at: new Date("2026-02-01T00:00:00.000Z"),
        slug: "alpha-post",
      };
      const sameTimeB = {
        created_at: new Date("2026-02-01T00:00:00.000Z"),
        slug: "beta-post",
      };

      const sorted = [sameTimeB, sameTimeA].sort(compareBlogPostsNewestFirst);
      expect(sorted[0].slug).toBe("alpha-post");
      expect(sorted[1].slug).toBe("beta-post");
    });

    it("compareBlogPostsNewestFirst handles invalid (NaN) dates safely without returning NaN", () => {
      const valid = {
        created_at: new Date("2026-02-01T00:00:00.000Z"),
        slug: "valid-post",
      };
      const invalidA = {
        created_at: new Date(NaN),
        slug: "alpha-invalid",
      };
      const invalidB = {
        created_at: new Date(NaN),
        slug: "beta-invalid",
      };

      const diffValidInvalid = compareBlogPostsNewestFirst(valid, invalidA);
      expect(Number.isNaN(diffValidInvalid)).toBe(false);
      expect(diffValidInvalid).toBe(-1); // Valid sorts before invalid

      const diffInvalidValid = compareBlogPostsNewestFirst(invalidA, valid);
      expect(Number.isNaN(diffInvalidValid)).toBe(false);
      expect(diffInvalidValid).toBe(1); // Invalid sorts after valid

      const diffBothInvalid = compareBlogPostsNewestFirst(invalidA, invalidB);
      expect(Number.isNaN(diffBothInvalid)).toBe(false);
      expect(diffBothInvalid).toBeLessThan(0); // Falls back to slug ascending
    });

    it("getAllPublishedBlogPosts sorts cached list newest-first even when cached unsorted", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const unsorted = [
        {
          id: "post-1",
          slug: "older-dispatch",
          title: "Older Dispatch",
          dek: "Jan post",
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
          id: "post-2",
          slug: "newest-dispatch",
          title: "Newest Dispatch",
          dek: "March post",
          body: "<p>New</p>",
          pillar: "accessibility-engineering",
          tags: "new",
          published: true,
          reading_time_minutes: 3,
          hero_image_url: null,
          created_at: "2026-03-01T00:00:00.000Z",
          updated_at: "2026-03-01T00:00:00.000Z",
        },
        {
          id: "post-3",
          slug: "middle-dispatch",
          title: "Middle Dispatch",
          dek: "Feb post",
          body: "<p>Middle</p>",
          pillar: "agent-first-dx",
          tags: "middle",
          published: true,
          reading_time_minutes: 4,
          hero_image_url: null,
          created_at: "2026-02-01T00:00:00.000Z",
          updated_at: "2026-02-01T00:00:00.000Z",
        },
      ];

      vi.mocked(redis.get).mockResolvedValueOnce(unsorted as never);

      const summaries = await getAllPublishedBlogPosts();

      expect(summaries.length).toBe(3);
      expect(summaries[0].slug).toBe("newest-dispatch");
      expect(summaries[1].slug).toBe("middle-dispatch");
      expect(summaries[2].slug).toBe("older-dispatch");

      // Verify each summary has real Date instances and valid pillars
      for (const item of summaries) {
        expect(item.publishedAt).toBeInstanceOf(Date);
        expect(item.updatedAt).toBeInstanceOf(Date);
        expect(Number.isNaN(item.publishedAt.getTime())).toBe(false);
        expect(Number.isNaN(item.updatedAt.getTime())).toBe(false);
        expect(CONTENT_PILLARS).toContain(item.pillar);
      }
    });
  });

  describe("Public Blog Facade Contracts (lib/blog/index.ts)", () => {
    it("getBlogPostBySlug returns null when cached entry has invalid dates", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const cachedInvalid = {
        id: "corrupt-id",
        slug: "corrupt-dates",
        title: "Corrupt Dates Post",
        dek: "Dek",
        body: "<p>Body</p>",
        pillar: "field-notes",
        tags: "corrupt",
        published: true,
        reading_time_minutes: 1,
        hero_image_url: null,
        created_at: "invalid-timestamp-value",
        updated_at: new Date(NaN),
      };

      vi.mocked(redis.get).mockResolvedValueOnce(cachedInvalid as never);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const post = await getBlogPostBySlug("corrupt-dates");
      expect(post).toBeNull();
    });

    it("getBlogPostBySlug returns null when cached entry has unknown pillar", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const cachedBadPillar = {
        id: "bad-pillar-id",
        slug: "bad-pillar-slug",
        title: "Bad Pillar Post",
        dek: "Dek",
        body: "<p>Body</p>",
        pillar: "not-a-real-pillar",
        tags: "bad",
        published: true,
        reading_time_minutes: 1,
        hero_image_url: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      };

      vi.mocked(redis.get).mockResolvedValueOnce(cachedBadPillar as never);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null);

      const post = await getBlogPostBySlug("bad-pillar-slug");
      expect(post).toBeNull();
    });

    it("getBlogPostBySlug returns formatted post with valid Date objects", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const validCached = {
        id: "valid-cached-1",
        slug: "valid-cached-slug",
        title: "Valid Post Title",
        dek: "Valid Post Dek",
        body: "<p>Valid Narrative</p>",
        pillar: "clinical-data-engineering",
        tags: "clinical, edc",
        published: true,
        reading_time_minutes: 5,
        hero_image_url: "https://example.com/hero.jpg",
        created_at: "2026-03-10T12:00:00.000Z",
        updated_at: "2026-03-11T12:00:00.000Z",
      };

      vi.mocked(redis.get).mockResolvedValueOnce(validCached as never);

      const post = await getBlogPostBySlug("valid-cached-slug");
      expect(post).not.toBeNull();
      expect(post?.slug).toBe("valid-cached-slug");
      expect(post?.publishedAt).toBeInstanceOf(Date);
      expect(post?.updatedAt).toBeInstanceOf(Date);
      expect(post?.publishedAt.toISOString()).toBe("2026-03-10T12:00:00.000Z");
      expect(post?.updatedAt.toISOString()).toBe("2026-03-11T12:00:00.000Z");
      expect(post?.tags).toEqual(["clinical", "edc"]);
      expect(post?.pillar).toBe("clinical-data-engineering");
    });

    it("getBlogPostBySlug returns null safely for empty, whitespace, null, or non-string slug without throwing", async () => {
      expect(await getBlogPostBySlug("")).toBeNull();
      expect(await getBlogPostBySlug("   ")).toBeNull();
      expect(await getBlogPostBySlug(fromAny(null))).toBeNull();
      expect(await getBlogPostBySlug(fromAny(undefined))).toBeNull();
      expect(await getBlogPostBySlug(fromAny(12345))).toBeNull();

      expect(await BlogPostService.getBlogPostBySlug(fromAny(null))).toBeNull();
      expect(
        await BlogPostService.getBlogPostBySlug(fromAny(undefined))
      ).toBeNull();
    });

    it("toBlogPostSummary sanitizes optional fields and tags safely", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const postWithEdgeOptionals = {
        id: "post-opt-1",
        slug: "post-opt-slug",
        title: "Optional Edge Cases Post",
        dek: "Dek",
        body: "<p>Body</p>",
        pillar: "field-notes",
        tags: " single-tag , spaced-tag , , ",
        published: true,
        reading_time_minutes: null,
        hero_image_url: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      };

      vi.mocked(redis.get).mockResolvedValueOnce(
        postWithEdgeOptionals as never
      );

      const post = await getBlogPostBySlug("post-opt-slug");
      expect(post).not.toBeNull();
      expect(post?.tags).toEqual(["single-tag", "spaced-tag"]);
      expect(post?.readingTimeMinutes).toBeNull();
      expect(post?.heroImageUrl).toBeNull();
    });
  });

  describe("Privacy & Cache-Hit Guarantees", () => {
    it("preserves empty list caching without querying DB on cache hit", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      vi.mocked(redis.get).mockResolvedValueOnce([] as never);

      const posts = await BlogPostService.getAllPublishedBlogPosts();
      expect(posts).toEqual([]);
      expect(prisma.blogPost.findMany).not.toHaveBeenCalled();
    });

    it("filters out drafts from cached array and never returns them", async () => {
      vi.mocked(isRedisConfigured).mockReturnValue(true);
      const cachedWithDraft = [
        {
          id: "published-1",
          slug: "public-post",
          title: "Public Post",
          dek: "Public",
          body: "<p>Body</p>",
          pillar: "field-notes",
          tags: "public",
          published: true,
          reading_time_minutes: 2,
          hero_image_url: null,
          created_at: "2026-02-01T00:00:00.000Z",
          updated_at: "2026-02-01T00:00:00.000Z",
        },
        {
          id: "draft-secret",
          slug: "secret-draft",
          title: "Secret Draft Post",
          dek: "Draft",
          body: "<p>Draft</p>",
          pillar: "field-notes",
          tags: "draft",
          published: false,
          reading_time_minutes: 2,
          hero_image_url: null,
          created_at: "2026-02-02T00:00:00.000Z",
          updated_at: "2026-02-02T00:00:00.000Z",
        },
      ];

      vi.mocked(redis.get).mockResolvedValueOnce(cachedWithDraft as never);

      const posts = await BlogPostService.getAllPublishedBlogPosts();
      expect(posts.length).toBe(1);
      expect(posts[0].slug).toBe("public-post");
      expect(posts.some((p) => p.slug === "secret-draft")).toBe(false);
    });

    it("enforces DB draft precedence: returns null if draft exists in DB with same slug as fallback", async () => {
      const mockDbDraft = {
        id: "db-draft-same-slug",
        slug: "conflicting-draft-slug",
        title: "DB Draft with conflicting slug",
        dek: "Draft dek",
        body: "<p>Secret DB draft</p>",
        pillar: "field-notes",
        tags: "draft",
        published: false,
        reading_time_minutes: 3,
        hero_image_url: null,
        created_at: new Date("2026-01-15T00:00:00.000Z"),
        updated_at: new Date("2026-01-15T00:00:00.000Z"),
      };

      vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(
        mockDbDraft as never
      );

      const post = await getBlogPostBySlug("conflicting-draft-slug");
      expect(post).toBeNull();
    });
  });
});
