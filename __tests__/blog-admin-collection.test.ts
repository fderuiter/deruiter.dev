// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { redis, isRedisConfigured } from "@/lib/redis";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { GET, POST } from "@/app/api/admin/blog/route";

vi.mock("@/lib/auth/admin", () => ({
  isCurrentUserAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    del: vi.fn(),
  },
  getScopedRedisKey: vi.fn((key: string) => `test:${key}`),
  isRedisConfigured: vi.fn(() => false),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const validDraft = {
  title: "A Safer Draft Pipeline",
  slug: "safer-draft-pipeline",
  dek: "A bounded, authenticated collection endpoint.",
  body: '<h2>Design</h2><p onclick="alert(1)">Safe HTML</p>',
  pillar: "agent-first-dx",
  tags: ["security", "cms"],
  heroImageUrl: "https://www.deruiter.dev/draft.png",
};

const createdDraft = {
  id: "draft-1",
  slug: validDraft.slug,
  title: validDraft.title,
  dek: validDraft.dek,
  body: "<h2>Design</h2><p>Safe HTML</p>",
  pillar: validDraft.pillar,
  tags: "security, cms",
  hero_image_url: validDraft.heroImageUrl,
  reading_time_minutes: 1,
  published: false,
  created_at: new Date("2026-09-14T12:00:00.000Z"),
  updated_at: new Date("2026-09-14T12:00:00.000Z"),
};

const createdDraftResponse = {
  ...createdDraft,
  created_at: "2026-09-14T12:00:00.000Z",
  updated_at: "2026-09-14T12:00:00.000Z",
};

describe("GET and POST /api/admin/blog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(true);
    vi.mocked(isRedisConfigured).mockReturnValue(false);
  });

  it("denies anonymous draft reads before querying the database", async () => {
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(false);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/admin/blog")
    );

    expect(response.status).toBe(403);
    expect(prisma.blogPost.findMany).not.toHaveBeenCalled();
    expect(prisma.blogPost.count).not.toHaveBeenCalled();
  });

  it("denies non-admin draft creation before writing", async () => {
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(false);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/blog", {
        method: "POST",
        body: JSON.stringify(validDraft),
      })
    );

    expect(response.status).toBe(403);
    expect(prisma.blogPost.create).not.toHaveBeenCalled();
  });

  it("lists only drafts with deterministic tied-timestamp pagination and never uses public fallbacks", async () => {
    vi.mocked(prisma.blogPost.findMany).mockResolvedValue([createdDraft]);
    vi.mocked(prisma.blogPost.count).mockResolvedValue(3);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/admin/blog?page=2&pageSize=1")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [createdDraftResponse],
      pagination: { page: 2, pageSize: 1, total: 3 },
    });
    expect(prisma.blogPost.findMany).toHaveBeenCalledWith({
      where: { published: false },
      orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      skip: 1,
      take: 1,
    });
  });

  it("creates a sanitized unpublished draft and evicts public cache entries", async () => {
    vi.mocked(isRedisConfigured).mockReturnValue(true);
    vi.mocked(prisma.blogPost.create).mockResolvedValue(createdDraft);
    vi.mocked(redis.del).mockResolvedValue(2 as never);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/blog", {
        method: "POST",
        body: JSON.stringify(validDraft),
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      success: true,
      data: createdDraftResponse,
    });
    expect(prisma.blogPost.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: validDraft.slug,
        body: "<h2>Design</h2><p>Safe HTML</p>",
        tags: "security, cms",
        published: false,
      }),
    });
    expect(redis.del).toHaveBeenCalledWith(
      "test:blog:slug:safer-draft-pipeline",
      "test:blog:all_published"
    );
  });

  it("rejects invalid taxonomy, mass-assignment, and out-of-bounds pagination", async () => {
    const invalidBody = {
      ...validDraft,
      pillar: "marketing",
      published: true,
      id: "attacker-controlled",
      created_at: "2020-01-01T00:00:00.000Z",
      published_at: "2020-01-01T00:00:00.000Z",
    };

    const invalidPost = await POST(
      new NextRequest("http://localhost:3000/api/admin/blog", {
        method: "POST",
        body: JSON.stringify(invalidBody),
      })
    );
    const invalidPage = await GET(
      new NextRequest("http://localhost:3000/api/admin/blog?pageSize=101")
    );

    expect(invalidPost.status).toBe(400);
    expect(invalidPage.status).toBe(400);
    expect(prisma.blogPost.create).not.toHaveBeenCalled();
    expect(prisma.blogPost.findMany).not.toHaveBeenCalled();
  });

  it("reports duplicate slugs and database failures without claiming a write succeeded", async () => {
    const duplicateError = Object.assign(
      new Error("Unique constraint failed"),
      {
        code: "P2002",
      }
    );
    vi.mocked(prisma.blogPost.create).mockRejectedValueOnce(duplicateError);
    vi.mocked(prisma.blogPost.create).mockRejectedValueOnce(
      new Error("database unavailable")
    );

    const duplicate = await POST(
      new NextRequest("http://localhost:3000/api/admin/blog", {
        method: "POST",
        body: JSON.stringify(validDraft),
      })
    );
    const unavailable = await POST(
      new NextRequest("http://localhost:3000/api/admin/blog", {
        method: "POST",
        body: JSON.stringify(validDraft),
      })
    );

    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({
      error: "A blog post with this slug already exists",
      details: [
        { path: "slug", message: "A blog post with this slug already exists" },
      ],
    });
    expect(unavailable.status).toBe(500);
    expect(await unavailable.json()).toEqual({
      error: "Failed to create blog draft",
    });
  });
});
