// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { calculatePostMd5, syncBlogPosts } from "../scripts/sync-blog-posts";
import type { BlogPostData } from "@/lib/fallback-blog-posts";

describe("calculatePostMd5", () => {
  it("generates a deterministic 32-character hex hash", () => {
    const post = {
      title: "Test Post",
      dek: "Test Dek",
      body: "<p>Content</p>",
      pillar: "clinical-data-engineering",
      tags: "cdisc, odm",
      reading_time_minutes: 5,
    };

    const hash1 = calculatePostMd5(post);
    const hash2 = calculatePostMd5(post);
    expect(hash1).toHaveLength(32);
    expect(hash1).toBe(hash2);
  });

  it("produces a different hash when content changes", () => {
    const postA = {
      title: "Test Post",
      dek: "Test Dek",
      body: "<p>Original Content</p>",
      pillar: "clinical-data-engineering",
      tags: "cdisc",
      reading_time_minutes: 5,
    };

    const postB = {
      ...postA,
      body: "<p>Audited and Expanded Content</p>",
    };

    expect(calculatePostMd5(postA)).not.toBe(calculatePostMd5(postB));
  });

  it("detects publish-state and hero image changes", () => {
    const post = {
      title: "Test Post",
      dek: "Test Dek",
      body: "<p>Content</p>",
      pillar: "clinical-data-engineering",
      tags: "cdisc",
      published: true,
      hero_image_url: null,
    };

    expect(calculatePostMd5(post)).not.toBe(
      calculatePostMd5({ ...post, published: false })
    );
    expect(calculatePostMd5(post)).not.toBe(
      calculatePostMd5({ ...post, hero_image_url: "/hero.png" })
    );
  });

  it("trims whitespace so harmless edge spaces do not alter MD5", () => {
    const postA = {
      title: "Test Post",
      dek: "Test Dek",
      body: "<p>Content</p>",
      pillar: "clinical-data-engineering",
      tags: "cdisc",
    };

    const postB = {
      title: "  Test Post  ",
      dek: "Test Dek ",
      body: "<p>Content</p>\n",
      pillar: " clinical-data-engineering",
      tags: "cdisc ",
    };

    expect(calculatePostMd5(postA)).toBe(calculatePostMd5(postB));
  });
});

describe("syncBlogPosts", () => {
  const mockPosts: BlogPostData[] = [
    {
      id: "post-1",
      slug: "post-to-create",
      title: "New Post",
      dek: "New Dek",
      body: "<p>New Body</p>",
      pillar: "field-notes",
      tags: "architecture",
      published: true,
      reading_time_minutes: 4,
      hero_image_url: null,
      created_at: new Date("2026-01-01"),
      updated_at: new Date("2026-01-01"),
    },
    {
      id: "post-2",
      slug: "post-unchanged",
      title: "Existing Post",
      dek: "Existing Dek",
      body: "<p>Existing Body</p>",
      pillar: "clinical-data-engineering",
      tags: "cdisc",
      published: true,
      reading_time_minutes: 5,
      hero_image_url: null,
      created_at: new Date("2026-01-01"),
      updated_at: new Date("2026-01-01"),
    },
    {
      id: "post-3",
      slug: "post-to-update",
      title: "Updated Post Title",
      dek: "Updated Dek",
      body: "<p>Updated Body</p>",
      pillar: "formal-verification",
      tags: "lean4",
      published: true,
      reading_time_minutes: 8,
      hero_image_url: null,
      created_at: new Date("2026-01-01"),
      updated_at: new Date("2026-01-01"),
    },
  ];

  it("performs safe change detection in dry-run mode without modifying the database", async () => {
    const findUniqueMock = vi
      .fn()
      .mockImplementation(({ where }: { where: { slug: string } }) => {
        if (where.slug === "post-unchanged") {
          return Promise.resolve({
            slug: "post-unchanged",
            title: "Existing Post",
            dek: "Existing Dek",
            body: "<p>Existing Body</p>",
            pillar: "clinical-data-engineering",
            tags: "cdisc",
            reading_time_minutes: 5,
            published: true,
            hero_image_url: null,
          });
        }
        if (where.slug === "post-to-update") {
          return Promise.resolve({
            slug: "post-to-update",
            title: "Old Title",
            dek: "Old Dek",
            body: "<p>Old Body</p>",
            pillar: "formal-verification",
            tags: "lean4",
            reading_time_minutes: 3,
          });
        }
        return Promise.resolve(null);
      });

    const createMock = vi.fn();
    const updateMock = vi.fn();

    const mockPrisma = {
      blogPost: {
        findUnique: findUniqueMock,
        create: createMock,
        update: updateMock,
      },
    } as unknown as typeof import("@/lib/db").prisma;

    const report = await syncBlogPosts({
      commit: false,
      silent: true,
      customPosts: mockPosts,
      prismaClient: mockPrisma,
    });

    expect(report.mode).toBe("dry-run");
    expect(report.created).toBe(1);
    expect(report.unchanged).toBe(1);
    expect(report.updated).toBe(1);
    expect(report.errors).toBe(0);

    // Assert that no writes were dispatched in dry-run
    expect(createMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("executes writes in commit mode when --commit is specified", async () => {
    const findUniqueMock = vi
      .fn()
      .mockImplementation(({ where }: { where: { slug: string } }) => {
        if (where.slug === "post-to-update") {
          return Promise.resolve({
            slug: "post-to-update",
            title: "Old Title",
            dek: "Old Dek",
            body: "<p>Old Body</p>",
            pillar: "formal-verification",
            tags: "lean4",
            reading_time_minutes: 3,
          });
        }
        return Promise.resolve(null);
      });

    const createMock = vi.fn().mockResolvedValue({});
    const updateMock = vi.fn().mockResolvedValue({});
    const evictMock = vi.fn().mockResolvedValue(true);

    const mockPrisma = {
      blogPost: {
        findUnique: findUniqueMock,
        create: createMock,
        update: updateMock,
      },
    } as unknown as typeof import("@/lib/db").prisma;

    const report = await syncBlogPosts({
      commit: true,
      silent: true,
      customPosts: [mockPosts[0], mockPosts[2]], // create & update
      prismaClient: mockPrisma,
      evictCache: evictMock,
    });

    expect(report.mode).toBe("commit");
    expect(report.created).toBe(1);
    expect(report.updated).toBe(1);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(evictMock).toHaveBeenCalledWith("post-to-create");
    expect(evictMock).toHaveBeenCalledWith("post-to-update");
  });
});
