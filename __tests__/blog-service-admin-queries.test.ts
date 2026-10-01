import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlogPostService } from "@/lib/services/blog-service";
import { prisma } from "@/lib/db";
import { getAdminAuthSession } from "@/lib/auth/admin";
import AdminBlogPage from "@/app/admin/blog/page";
import EditBlogPostPage from "@/app/admin/blog/[id]/page";

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

describe("BlogPostService Admin Query Methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("BlogPostService.getAllBlogPostsAdmin", () => {
    it("fetches all persisted posts ordered by updated_at desc and id asc", async () => {
      vi.mocked(prisma.blogPost.findMany).mockResolvedValue(mockPosts);

      const posts = await BlogPostService.getAllBlogPostsAdmin();

      expect(prisma.blogPost.findMany).toHaveBeenCalledWith({
        orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      });
      expect(posts).toEqual(mockPosts);
    });

    it("returns empty array on database failure", async () => {
      vi.mocked(prisma.blogPost.findMany).mockRejectedValue(
        new Error("Database connection lost")
      );

      const posts = await BlogPostService.getAllBlogPostsAdmin();

      expect(posts).toEqual([]);
    });
  });

  describe("BlogPostService.getBlogPostById", () => {
    it("retrieves a post by ID", async () => {
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(mockPosts[0]);

      const post = await BlogPostService.getBlogPostById("post-1");

      expect(prisma.blogPost.findUnique).toHaveBeenCalledWith({
        where: { id: "post-1" },
      });
      expect(post).toEqual(mockPosts[0]);
    });

    it("returns null when post is not found", async () => {
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(null);

      const post = await BlogPostService.getBlogPostById("non-existent");

      expect(post).toBeNull();
    });

    it("returns null on database failure", async () => {
      vi.mocked(prisma.blogPost.findUnique).mockRejectedValue(
        new Error("Database connection lost")
      );

      const post = await BlogPostService.getBlogPostById("post-1");

      expect(post).toBeNull();
    });
  });

  describe("Admin Blog Page Routes", () => {
    it("AdminBlogPage queries posts via BlogPostService.getAllBlogPostsAdmin", async () => {
      vi.mocked(getAdminAuthSession).mockResolvedValue({
        isAuthenticated: true,
        isAdmin: true,
        userId: "admin-1",
        primaryEmail: "admin@example.com",
        displayName: "Admin User",
        user: null,
      });
      vi.mocked(prisma.blogPost.findMany).mockResolvedValue(mockPosts);

      const spy = vi.spyOn(BlogPostService, "getAllBlogPostsAdmin");
      const pageJsx = await AdminBlogPage();

      expect(spy).toHaveBeenCalled();
      expect(pageJsx).toBeDefined();
    });

    it("EditBlogPostPage queries post via BlogPostService.getBlogPostById", async () => {
      vi.mocked(getAdminAuthSession).mockResolvedValue({
        isAuthenticated: true,
        isAdmin: true,
        userId: "admin-1",
        primaryEmail: "admin@example.com",
        displayName: "Admin User",
        user: null,
      });
      vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(mockPosts[0]);

      const spy = vi.spyOn(BlogPostService, "getBlogPostById");
      const pageJsx = await EditBlogPostPage({
        params: Promise.resolve({ id: "post-1" }),
      });

      expect(spy).toHaveBeenCalledWith("post-1");
      expect(pageJsx).toBeDefined();
    });
  });
});
