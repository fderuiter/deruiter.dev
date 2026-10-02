// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { redis, isRedisConfigured } from "@/lib/redis";
import { GET, PATCH, DELETE } from "@/app/api/admin/blog/[id]/route";

vi.mock("@/lib/auth/admin", () => ({
  isCurrentUserAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateManyAndReturn: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: { del: vi.fn() },
  getScopedRedisKey: vi.fn((key: string) => `test:${key}`),
  isRedisConfigured: vi.fn(() => false),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const originalDraft = {
  id: "draft-1",
  slug: "original-draft",
  title: "Original Draft Title",
  dek: "A complete original draft standfirst.",
  body: "<p>Original body.</p>",
  pillar: "agent-first-dx",
  tags: "testing, security",
  hero_image_url: "https://www.deruiter.dev/original.png",
  reading_time_minutes: 1,
  published: false,
  created_at: new Date("2026-09-14T12:00:00.000Z"),
  updated_at: new Date("2026-09-14T12:00:00.000Z"),
};

const updatedDraft = {
  ...originalDraft,
  slug: "renamed-draft",
  title: "Edited Draft Title",
  body: "<p>Edited body.</p>",
  tags: "editing, security",
  updated_at: new Date("2026-09-14T13:00:00.000Z"),
};

const routeContext = { params: Promise.resolve({ id: originalDraft.id }) };

describe("GET and PATCH /api/admin/blog/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(true);
    vi.mocked(isRedisConfigured).mockReturnValue(false);
  });

  it("denies anonymous reads and edits before Prisma access", async () => {
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(false);

    const read = await GET(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1"),
      routeContext
    );
    const edit = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Edited Draft Title" }),
      }),
      routeContext
    );

    expect(read.status).toBe(403);
    expect(edit.status).toBe(403);
    expect(prisma.blogPost.findFirst).not.toHaveBeenCalled();
    expect(prisma.blogPost.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it("reads a persisted unpublished draft without consulting public fallbacks", async () => {
    vi.mocked(prisma.blogPost.findFirst).mockResolvedValue(originalDraft);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1"),
      routeContext
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        ...originalDraft,
        created_at: "2026-09-14T12:00:00.000Z",
        updated_at: "2026-09-14T12:00:00.000Z",
      },
    });
    expect(prisma.blogPost.findFirst).toHaveBeenCalledWith({
      where: { id: originalDraft.id, published: false },
    });
  });

  it("returns not found for missing or published records", async () => {
    vi.mocked(prisma.blogPost.findFirst).mockResolvedValue(null);

    const missing = await GET(
      new NextRequest("http://localhost:3000/api/admin/blog/missing"),
      { params: Promise.resolve({ id: "missing" }) }
    );
    const published = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Edited Draft Title" }),
      }),
      routeContext
    );

    expect(missing.status).toBe(404);
    expect(published.status).toBe(404);
    expect(prisma.blogPost.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it("updates only supplied draft fields, sanitizes changed HTML, and invalidates old and new slugs", async () => {
    vi.mocked(isRedisConfigured).mockReturnValue(true);
    vi.mocked(redis.del).mockResolvedValue(2 as never);
    vi.mocked(prisma.blogPost.findFirst).mockResolvedValue(originalDraft);
    vi.mocked(prisma.blogPost.updateManyAndReturn).mockResolvedValue([
      updatedDraft,
    ]);

    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1", {
        method: "PATCH",
        body: JSON.stringify({
          title: updatedDraft.title,
          slug: updatedDraft.slug,
          body: '<p onclick="alert(1)">Edited body.</p>',
          tags: ["editing", "security"],
        }),
      }),
      routeContext
    );

    expect(response.status).toBe(200);
    expect(prisma.blogPost.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: originalDraft.id, published: false },
      data: {
        title: updatedDraft.title,
        slug: updatedDraft.slug,
        body: updatedDraft.body,
        tags: updatedDraft.tags,
        reading_time_minutes: 1,
      },
    });
    expect(redis.del).toHaveBeenCalledWith(
      "test:blog:slug:original-draft",
      "test:blog:all_published"
    );
    expect(redis.del).toHaveBeenCalledWith(
      "test:blog:slug:renamed-draft",
      "test:blog:all_published"
    );
  });

  it("rejects publication, identity, timestamp, and empty edits without a write", async () => {
    const forbidden = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1", {
        method: "PATCH",
        body: JSON.stringify({ published: true, id: "attacker-controlled" }),
      }),
      routeContext
    );
    const timestamp = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1", {
        method: "PATCH",
        body: JSON.stringify({ updated_at: "2020-01-01T00:00:00.000Z" }),
      }),
      routeContext
    );
    const empty = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      routeContext
    );

    expect(forbidden.status).toBe(400);
    expect(timestamp.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(prisma.blogPost.findFirst).not.toHaveBeenCalled();
    expect(prisma.blogPost.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it("reports duplicate slugs and database failures without cache eviction", async () => {
    vi.mocked(prisma.blogPost.findFirst).mockResolvedValue(originalDraft);
    vi.mocked(prisma.blogPost.updateManyAndReturn)
      .mockRejectedValueOnce(
        Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
      )
      .mockRejectedValueOnce(new Error("database unavailable"));

    const duplicate = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1", {
        method: "PATCH",
        body: JSON.stringify({ slug: "duplicate-draft" }),
      }),
      routeContext
    );
    const unavailable = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1", {
        method: "PATCH",
        body: JSON.stringify({ slug: "unavailable-draft" }),
      }),
      routeContext
    );

    expect(duplicate.status).toBe(409);
    expect(unavailable.status).toBe(500);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it("does not update or evict when concurrent publication wins the race", async () => {
    vi.mocked(isRedisConfigured).mockReturnValue(true);
    vi.mocked(prisma.blogPost.findFirst).mockResolvedValue(originalDraft);
    vi.mocked(prisma.blogPost.updateManyAndReturn).mockResolvedValue([]);

    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Edited Draft Title" }),
      }),
      routeContext
    );

    expect(response.status).toBe(404);
    expect(prisma.blogPost.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: originalDraft.id, published: false },
      data: { title: "Edited Draft Title" },
    });
    expect(redis.del).not.toHaveBeenCalled();
  });

  it("denies anonymous deletion and deletes post when authorized", async () => {
    vi.mocked(isCurrentUserAdmin).mockResolvedValueOnce(false);

    const denied = await DELETE(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1", {
        method: "DELETE",
      }),
      routeContext
    );

    expect(denied.status).toBe(403);
    expect(prisma.blogPost.delete).not.toHaveBeenCalled();

    vi.mocked(isCurrentUserAdmin).mockResolvedValue(true);
    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(originalDraft);
    vi.mocked(prisma.blogPost.delete).mockResolvedValue(originalDraft);

    const allowed = await DELETE(
      new NextRequest("http://localhost:3000/api/admin/blog/draft-1", {
        method: "DELETE",
      }),
      routeContext
    );

    expect(allowed.status).toBe(200);
    expect(prisma.blogPost.delete).toHaveBeenCalledWith({
      where: { id: originalDraft.id },
    });
  });
});
