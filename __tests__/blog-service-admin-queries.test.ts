// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "next/navigation";
import {
  GetAdminBlogPostByIdHandler,
  ListAdminBlogPostsHandler,
} from "@/lib/services";
import { prisma } from "@/lib/db";
import { getAdminAuthSession } from "@/lib/auth/admin";
import AdminBlogPage from "@/app/admin/blog/page";
import EditBlogPostPage from "@/app/admin/blog/[id]/page";

vi.mock("@/components/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/auth/admin", () => ({
  getAdminAuthSession: vi.fn(),
  isCurrentUserAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const mockPosts = [
  {
    id: "post-1",
    slug: "published-post",
    title: "Published Post",
    dek: "Published dek",
    body: "<p>Published body</p>",
    pillar: "agent-first-dx",
    tags: "tag1",
    published: true,
    reading_time_minutes: 2,
    hero_image_url: null,
    created_at: new Date("2026-09-01T10:00:00Z"),
    updated_at: new Date("2026-09-02T12:00:00Z"),
  },
  {
    id: "post-2",
    slug: "draft-post",
    title: "Draft Post",
    dek: "Draft dek",
    body: "<p>Draft body</p>",
    pillar: "systems-software",
    tags: "tag2",
    published: false,
    reading_time_minutes: 3,
    hero_image_url: null,
    created_at: new Date("2026-09-03T10:00:00Z"),
    updated_at: new Date("2026-09-03T11:00:00Z"),
  },
];

const adminSession = {
  isAuthenticated: true,
  isAdmin: true,
  userId: "admin-1",
  primaryEmail: "admin@example.com",
  displayName: "Admin User",
  user: null,
};

describe("Admin Blog Query Vertical Slices & Outage UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ListAdminBlogPostsHandler", () => {
    it("fetches all persisted posts ordered by updated_at desc and id asc", async () => {
      vi.mocked(prisma.blogPost.findMany).mockResolvedValue(mockPosts);

      const result = await new ListAdminBlogPostsHandler().execute();

      expect(prisma.blogPost.findMany).toHaveBeenCalledWith({
        orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      });
      expect(result).toEqual({ success: true, data: mockPosts });
    });

    it("returns STORAGE_UNAVAILABLE failure instead of empty array on database failure", async () => {
      const dbError = new Error("Database connection lost");
      vi.mocked(prisma.blogPost.findMany).mockRejectedValue(dbError);

      const result = await new ListAdminBlogPostsHandler().execute();

      expect(result).toMatchObject({
        success: false,
        error: {
          code: "STORAGE_UNAVAILABLE",
          recoverable: true,
          details: dbError,
        },
      });
    });
  });

  describe("GetAdminBlogPostByIdHandler", () => {
    it("retrieves a post by ID", async () => {
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(mockPosts[0]);

      const result = await new GetAdminBlogPostByIdHandler().execute({
        id: "post-1",
      });

      expect(prisma.blogPost.findUnique).toHaveBeenCalledWith({
        where: { id: "post-1" },
      });
      expect(result).toEqual({ success: true, data: mockPosts[0] });
    });

    it("returns BLOG_POST_NOT_FOUND when post is not found", async () => {
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(null);

      const result = await new GetAdminBlogPostByIdHandler().execute({
        id: "non-existent",
      });

      expect(result).toMatchObject({
        success: false,
        error: { code: "BLOG_POST_NOT_FOUND", recoverable: false },
      });
    });

    it("returns STORAGE_UNAVAILABLE instead of null on database failure", async () => {
      const dbError = new Error("Database connection lost");
      vi.mocked(prisma.blogPost.findUnique).mockRejectedValue(dbError);

      const result = await new GetAdminBlogPostByIdHandler().execute({
        id: "post-1",
      });

      expect(result).toMatchObject({
        success: false,
        error: {
          code: "STORAGE_UNAVAILABLE",
          recoverable: true,
          details: dbError,
        },
      });
    });
  });

  describe("Admin Blog Page Routes", () => {
    it("AdminBlogPage queries posts via ListAdminBlogPostsHandler", async () => {
      vi.mocked(getAdminAuthSession).mockResolvedValue(adminSession);
      vi.mocked(prisma.blogPost.findMany).mockResolvedValue(mockPosts);

      const spy = vi.spyOn(ListAdminBlogPostsHandler.prototype, "execute");
      const pageJsx = await AdminBlogPage();

      expect(spy).toHaveBeenCalled();
      expect(pageJsx).toBeDefined();
    });

    it("AdminBlogPage renders an explicit role=alert outage banner instead of an empty inventory when DB fails", async () => {
      vi.mocked(getAdminAuthSession).mockResolvedValue(adminSession);
      vi.mocked(prisma.blogPost.findMany).mockRejectedValue(
        new Error("Database connection lost")
      );

      const pageJsx = await AdminBlogPage();
      const html = renderToStaticMarkup(pageJsx);

      expect(html).toContain('role="alert"');
      expect(html).toContain("DATABASE STORAGE TEMPORARILY UNAVAILABLE");
      expect(html).not.toContain(
        "No blog posts or drafts found in database persistence."
      );
    });

    it("EditBlogPostPage queries post via GetAdminBlogPostByIdHandler", async () => {
      vi.mocked(getAdminAuthSession).mockResolvedValue(adminSession);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(mockPosts[0]);

      const spy = vi.spyOn(GetAdminBlogPostByIdHandler.prototype, "execute");
      const pageJsx = await EditBlogPostPage({
        params: Promise.resolve({ id: "post-1" }),
      });

      expect(spy).toHaveBeenCalledWith({ id: "post-1" });
      expect(pageJsx).toBeDefined();
    });

    it("EditBlogPostPage calls notFound() when post does not exist", async () => {
      vi.mocked(getAdminAuthSession).mockResolvedValue(adminSession);
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(null);

      await expect(
        EditBlogPostPage({ params: Promise.resolve({ id: "missing" }) })
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalled();
    });

    it("EditBlogPostPage renders an explicit role=alert outage banner instead of 404 when DB fails", async () => {
      vi.mocked(getAdminAuthSession).mockResolvedValue(adminSession);
      vi.mocked(prisma.blogPost.findUnique).mockRejectedValue(
        new Error("Database connection lost")
      );

      const pageJsx = await EditBlogPostPage({
        params: Promise.resolve({ id: "post-1" }),
      });
      const html = renderToStaticMarkup(pageJsx);

      expect(notFound).not.toHaveBeenCalled();
      expect(html).toContain('role="alert"');
      expect(html).toContain("Blog Storage Temporarily Unavailable");
      expect(html).toContain("post-1");
    });
  });
});
