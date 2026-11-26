// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { CONTENT_PILLARS } from "@/lib/blog/types";
import { FALLBACK_BLOG_POSTS } from "@/lib/fallback-blog-posts";
import {
  GetBlogPostBySlugHandler,
  compareBlogPostsNewestFirst,
  getBaseBlogReactionCounts,
  isBlogUniqueViolation,
  isPrismaRecordNotFound,
  isValidBlogPost,
  parseBlogPostDates,
  parseValidDate,
  safeRevalidateBlogPath,
  safeRevalidateBlogTag,
  type BlogPostData,
  type BlogPostDbRecord,
  type GetBlogPostBySlugDeps,
} from "@/lib/services";

describe("GetBlogPostBySlugHandler (Logic Test)", () => {
  const validRecord: BlogPostDbRecord = {
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

  it("returns INVALID_INPUT for non-string slug payload", async () => {
    const handler = new GetBlogPostBySlugHandler();
    const result = await handler.execute(fromAny({ slug: 123 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("returns NOT_FOUND for whitespace-only slug", async () => {
    const handler = new GetBlogPostBySlugHandler();
    const result = await handler.execute({ slug: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns cached blog post on Redis cache hit without querying DB", async () => {
    const findUnique = vi.fn(async () => null);
    const deps = fromPartial<GetBlogPostBySlugDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () => fromAny(validRecord),
        set: async () => "OK",
      },
      db: { blogPost: { findUnique } },
    });

    const handler = new GetBlogPostBySlugHandler(deps);
    const result = await handler.execute({ slug: "slug-post" });
    expect(result.success).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
    if (result.success) {
      expect(result.data.slug).toBe("slug-post");
    }
  });

  it("returns published blog post from database and writes to Redis cache", async () => {
    const setSpy = vi.fn(async () => "OK");
    const deps = fromPartial<GetBlogPostBySlugDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () => null,
        set: setSpy,
      },
      db: { blogPost: { findUnique: async () => validRecord } },
    });

    const handler = new GetBlogPostBySlugHandler(deps);
    const result = await handler.execute({ slug: "slug-post" });
    expect(result.success).toBe(true);
    expect(setSpy).toHaveBeenCalledTimes(1);
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

  it("resolves static fallback when DB misses and caches static post", async () => {
    const fallbackSlug = FALLBACK_BLOG_POSTS[0]!.slug;
    const setSpy = vi.fn(async () => "OK");
    const deps = fromPartial<GetBlogPostBySlugDeps>({
      isRedisReady: () => true,
      redisClient: {
        get: async () => {
          throw new Error("Redis timeout");
        },
        set: setSpy,
      },
      db: { blogPost: { findUnique: async () => null } },
    });

    const handler = new GetBlogPostBySlugHandler(deps);
    const hit = await handler.execute({ slug: fallbackSlug });
    expect(hit.success).toBe(true);
    expect(setSpy).toHaveBeenCalledTimes(1);

    const miss = await handler.execute({ slug: "missing-blog-slug" });
    expect(miss.success).toBe(false);
    if (!miss.success) {
      expect(miss.error.code).toBe("NOT_FOUND");
    }
  });

  it("falls back to static blog post without caching when DB throws", async () => {
    const fallbackSlug = FALLBACK_BLOG_POSTS[0]!.slug;
    const deps = fromPartial<GetBlogPostBySlugDeps>({
      isRedisReady: () => false,
      db: {
        blogPost: {
          findUnique: async () => {
            throw new Error("DB connection failed");
          },
        },
      },
    });

    const handler = new GetBlogPostBySlugHandler(deps);
    const hit = await handler.execute({ slug: fallbackSlug });
    expect(hit.success).toBe(true);

    const miss = await handler.execute({ slug: "missing-blog-slug" });
    expect(miss.success).toBe(false);
    if (!miss.success) {
      expect(miss.error.code).toBe("NOT_FOUND");
    }
  });
});

describe("Blog shared contract helpers", () => {
  it("validates dates across Date, string, number, and invalid inputs", () => {
    expect(parseValidDate(null)).toBeNull();
    expect(parseValidDate(undefined)).toBeNull();
    expect(parseValidDate(new Date("invalid"))).toBeNull();
    expect(parseValidDate(new Date("1965-01-01T00:00:00Z"))).toBeNull();
    expect(parseValidDate(new Date("2026-02-01T00:00:00Z"))).toBeInstanceOf(
      Date
    );
    expect(parseValidDate("   ")).toBeNull();
    expect(parseValidDate("not-a-date")).toBeNull();
    expect(parseValidDate("1960-01-01T00:00:00Z")).toBeNull();
    expect(parseValidDate("2026-02-01T00:00:00Z")).toBeInstanceOf(Date);
    expect(parseValidDate(Number.NaN)).toBeNull();
    expect(parseValidDate(-5)).toBeNull();
    expect(parseValidDate(1767225600000)).toBeInstanceOf(Date);
    expect(parseValidDate({})).toBeNull();
  });

  it("validates blog post payloads, date coercion, and error helpers", async () => {
    expect(isValidBlogPost(null)).toBe(false);
    expect(
      isValidBlogPost({
        id: "1",
        slug: "s",
        title: "T",
        dek: "d",
        body: "b",
        pillar: CONTENT_PILLARS[0],
        tags: "t",
        published: true,
        reading_time_minutes: -2,
        hero_image_url: null,
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-01-01T00:00:00Z"),
      })
    ).toBe(false);
    expect(
      isValidBlogPost({
        id: "1",
        slug: "s",
        title: "T",
        dek: "d",
        body: "b",
        pillar: CONTENT_PILLARS[0],
        tags: "t",
        published: true,
        reading_time_minutes: 3,
        hero_image_url: 42,
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-01-01T00:00:00Z"),
      })
    ).toBe(false);

    const badDateRes = parseBlogPostDates(
      fromPartial<BlogPostData>({
        slug: "bad-dates",
        created_at: new Date("invalid"),
        updated_at: new Date("2026-01-01T00:00:00Z"),
      })
    );
    expect(badDateRes.success).toBe(false);

    expect(isBlogUniqueViolation(null)).toBe(false);
    expect(isBlogUniqueViolation({ code: "P2002" })).toBe(true);
    expect(
      isBlogUniqueViolation({ message: "Unique constraint failed on slug" })
    ).toBe(true);
    expect(isPrismaRecordNotFound({ code: "P2025" })).toBe(true);
    expect(isPrismaRecordNotFound(null)).toBe(false);

    const a = { created_at: new Date("2026-01-02T00:00:00Z"), slug: "b" };
    const b = { created_at: new Date("2026-01-02T00:00:00Z"), slug: "a" };
    const invalid = { created_at: new Date("invalid"), slug: "c" };
    expect(compareBlogPostsNewestFirst(a, b)).toBeGreaterThan(0);
    expect(compareBlogPostsNewestFirst(a, invalid)).toBe(-1);
    expect(compareBlogPostsNewestFirst(invalid, a)).toBe(1);

    const counts = await getBaseBlogReactionCounts("slug-1", {
      isRedisReady: () => true,
      redisClient: {
        get: async () => {
          throw new Error("Redis timeout");
        },
      },
    });
    expect(typeof counts).toBe("object");

    await expect(safeRevalidateBlogPath("/blog")).resolves.toBeUndefined();
    await expect(safeRevalidateBlogTag("blog-posts")).resolves.toBeUndefined();
  });
});
