import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BlogAuthoringForm } from "@/components/admin/BlogAuthoringForm";
import { BlogPostService } from "@/lib/services/blog-service";
import { prisma } from "@/lib/db";
import {
  BlogDraftCreateSchema,
  BlogDraftUpdateSchema,
  blogHeroImageUrlIssue,
} from "@/lib/schemas";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/admin", () => ({
  getAdminAuthSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: { del: vi.fn(), get: vi.fn(), set: vi.fn() },
  getScopedRedisKey: vi.fn((key: string) => `test:${key}`),
  isRedisConfigured: vi.fn(() => false),
}));

global.fetch = vi.fn();

/** A draft that satisfies the shared BlogDraft contracts, so submits reach fetch. */
const VALID_DRAFT = {
  title: "Valid Draft Title",
  slug: "valid-draft-title",
  dek: "A standfirst long enough to pass validation.",
  body: "<p>Body copy.</p>",
  pillar: "field-notes" as const,
  tags: "testing",
};

describe("BlogAuthoringForm UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("auto-derives kebab-case slug from title for new posts when slug hasn't been manually edited", () => {
    render(<BlogAuthoringForm isNew={true} />);

    const titleInput = screen.getByLabelText(
      /Article Title/i
    ) as HTMLInputElement;
    const slugInput = screen.getByLabelText(/URL Slug/i) as HTMLInputElement;

    fireEvent.change(titleInput, {
      target: { value: "Formal Verification in WebAssembly Runtimes!" },
    });

    expect(slugInput.value).toBe("formal-verification-in-webassembly-runtimes");
  });

  it("preserves manually entered slug when author edits slug field directly", () => {
    render(<BlogAuthoringForm isNew={true} />);

    const titleInput = screen.getByLabelText(
      /Article Title/i
    ) as HTMLInputElement;
    const slugInput = screen.getByLabelText(/URL Slug/i) as HTMLInputElement;

    fireEvent.change(slugInput, {
      target: { value: "custom-manual-slug" },
    });

    fireEvent.change(titleInput, {
      target: { value: "New Title Here" },
    });

    expect(slugInput.value).toBe("custom-manual-slug");
  });

  it("switches to Live Preview tab and renders RichNarrative HTML content", async () => {
    render(
      <BlogAuthoringForm
        isNew={true}
        initialData={{
          title: "Preview Test Post",
          slug: "preview-test-post",
          dek: "A preview test standfirst.",
          body: "<h2>Preview Heading</h2><p>Preview paragraph copy.</p>",
          pillar: "formal-verification",
          tags: "preview, testing",
          published: false,
        }}
      />
    );

    const previewTabButton = screen.getAllByRole("button", {
      name: /Live Preview/i,
    })[0];
    fireEvent.click(previewTabButton);

    expect(screen.getByText("Live Article Preview Mode")).toBeDefined();
    expect(screen.getByText("Preview Test Post")).toBeDefined();
    expect(screen.getByText("A preview test standfirst.")).toBeDefined();
    expect(screen.getByText("Preview Heading")).toBeDefined();
    expect(screen.getByText("Preview paragraph copy.")).toBeDefined();
  });

  // CodeQL alert 29: the preview loads the hero image before any save.
  describe("hero image preview", () => {
    function openPreview(heroImageUrl: string) {
      render(
        <BlogAuthoringForm
          isNew={true}
          initialData={{
            ...VALID_DRAFT,
            hero_image_url: heroImageUrl,
            published: false,
          }}
        />
      );
      fireEvent.click(
        screen.getAllByRole("button", { name: /Live Preview/i })[0]
      );
    }

    it.each([
      ["a plain-HTTP URL", "http://images.example/hero.png"],
      ["a javascript: URL", "javascript:alert(1)"],
      ["a data: URL", "data:image/svg+xml,<svg onload=alert(1)>"],
      ["a credential-bearing URL", "https://user:pw@images.example/hero.png"],
      ["a malformed URL", "not a url"],
      ["a protocol-relative URL", "//images.example/hero.png"],
    ])("loads no image for %s and says why", (_label, url) => {
      openPreview(url);
      expect(document.querySelector("img")).toBeNull();
      expect(screen.getByTestId("blog-hero-preview-error").textContent).toMatch(
        /Hero image not shown/
      );
    });

    it("reports the problem on the hero field too", () => {
      openPreview("http://images.example/hero.png");
      fireEvent.click(screen.getAllByRole("button", { name: /Editor/i })[0]);
      const input = document.getElementById("blog-hero-url")!;
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(
        document.getElementById("blog-hero-url-error")?.textContent
      ).toMatch(/https:\/\//);
    });

    it("previews a supported https image unchanged", () => {
      const url = "https://images.example/hero.png?w=1200&h=630";
      openPreview(url);
      expect(document.querySelector("img")?.getAttribute("src")).toBe(url);
      expect(screen.queryByTestId("blog-hero-preview-error")).toBeNull();
    });
  });

  it("refuses to save a hero URL the preview would not load", () => {
    const url = "http://images.example/hero.png";
    expect(blogHeroImageUrlIssue(url)).not.toBeNull();
    for (const schema of [BlogDraftCreateSchema, BlogDraftUpdateSchema]) {
      const result = schema.safeParse({
        ...VALID_DRAFT,
        tags: ["a"],
        heroImageUrl: url,
      });
      expect(result.success).toBe(false);
    }
    const ok = BlogDraftCreateSchema.safeParse({
      ...VALID_DRAFT,
      tags: ["a"],
      heroImageUrl: "https://images.example/hero.png",
    });
    expect(ok.success).toBe(true);
    expect(
      BlogDraftCreateSchema.safeParse({
        ...VALID_DRAFT,
        tags: ["a"],
        heroImageUrl: null,
      }).success
    ).toBe(true);
  });

  it("surfaces the API error envelope message when creating a draft fails", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "A blog post with this slug already exists",
          details: [{ path: "slug", message: "duplicate" }],
        }),
        { status: 409 }
      )
    );
    render(<BlogAuthoringForm isNew={true} initialData={VALID_DRAFT} />);

    fireEvent.click(screen.getByRole("button", { name: /Save Draft/i }));

    expect(
      await screen.findByText("A blog post with this slug already exists")
    ).toBeDefined();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/blog",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("falls back to its own copy when the server returns a non-JSON error", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response("<html>502</html>", { status: 502 })
    );
    render(
      <BlogAuthoringForm initialData={{ ...VALID_DRAFT, id: "post-1" }} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Publish Post/i }));

    expect(await screen.findByText("Failed to update blog post")).toBeDefined();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/blog/post-1",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("reports a failed publish step after the draft was created", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "new-1" } }), { status: 201 })
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<BlogAuthoringForm isNew={true} initialData={VALID_DRAFT} />);

    fireEvent.click(screen.getByRole("button", { name: /Publish Post/i }));

    expect(
      await screen.findByText("Created draft, but failed to publish")
    ).toBeDefined();
    expect(global.fetch).toHaveBeenLastCalledWith(
      "/api/admin/blog/new-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ published: true }),
      })
    );
  });

  it("surfaces the server message when deleting fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Blog post not found" }), {
        status: 404,
      })
    );
    render(
      <BlogAuthoringForm
        initialData={{
          id: "post-2",
          title: "T",
          slug: "t",
          dek: "d",
          body: "b",
          pillar: "field-notes",
          tags: "",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Delete/i }));

    expect(await screen.findByText("Blog post not found")).toBeDefined();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/blog/post-2",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("Draft vs Published Isolation State Machine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never returns unpublished draft records for public getBlogPostBySlug queries", async () => {
    const unpublishedDraft = {
      id: "draft-101",
      slug: "secret-draft",
      title: "Secret Unpublished Draft",
      dek: "Unpublished standfirst.",
      body: "<p>Unpublished body.</p>",
      pillar: "field-notes",
      tags: "secret",
      published: false,
      reading_time_minutes: 1,
      hero_image_url: null,
      created_at: new Date("2026-09-15T10:00:00.000Z"),
      updated_at: new Date("2026-09-15T10:00:00.000Z"),
    };

    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(
      unpublishedDraft as never
    );

    const result = await BlogPostService.getBlogPostBySlug("secret-draft");
    expect(result).toBeNull();
  });

  it("excludes unpublished drafts from public getAllPublishedBlogPosts list", async () => {
    const mixedPosts = [
      {
        id: "pub-1",
        slug: "published-post",
        title: "Published Post",
        dek: "Published standfirst.",
        body: "<p>Published body.</p>",
        pillar: "agent-first-dx",
        tags: "public",
        published: true,
        reading_time_minutes: 1,
        hero_image_url: null,
        created_at: new Date("2026-09-15T10:00:00.000Z"),
        updated_at: new Date("2026-09-15T10:00:00.000Z"),
      },
      {
        id: "draft-1",
        slug: "secret-draft",
        title: "Secret Draft",
        dek: "Draft standfirst.",
        body: "<p>Draft body.</p>",
        pillar: "field-notes",
        tags: "private",
        published: false,
        reading_time_minutes: 1,
        hero_image_url: null,
        created_at: new Date("2026-09-15T11:00:00.000Z"),
        updated_at: new Date("2026-09-15T11:00:00.000Z"),
      },
    ];

    vi.mocked(prisma.blogPost.findMany).mockResolvedValue(mixedPosts as never);

    const results = await BlogPostService.getAllPublishedBlogPosts();
    expect(results.some((p) => p.slug === "secret-draft")).toBe(false);
  });
});
