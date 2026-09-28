// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FALLBACK_BLOG_POSTS } from "@/lib/fallback-blog-posts";
import BlogPostPage from "@/app/(desktop)/blog/[slug]/page";

vi.mock("@/lib/blog", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/blog")>("@/lib/blog");
  const targetPost = FALLBACK_BLOG_POSTS.find(
    (p) => p.slug === "pipelines-that-survive-an-audit"
  )!;
  const targetSummary = {
    slug: targetPost.slug,
    title: targetPost.title,
    dek: targetPost.dek,
    pillar: targetPost.pillar,
    tags: targetPost.tags.split(",").map((t) => t.trim()),
    publishedAt: targetPost.created_at,
    updatedAt: targetPost.updated_at,
    readingTimeMinutes: targetPost.reading_time_minutes,
    heroImageUrl: targetPost.hero_image_url,
  };
  return {
    ...actual,
    getAllPublishedBlogPosts: vi.fn().mockResolvedValue([targetSummary]),
    getBlogPostBySlug: vi.fn().mockResolvedValue({
      ...targetSummary,
      body: targetPost.body,
    }),
  };
});

describe("Target Dispatch Regression: Pipelines That Survive an Audit (Issue #1146)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(function (this: Record<string, unknown>) {
        this.observe = vi.fn();
        this.unobserve = vi.fn();
        this.disconnect = vi.fn();
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders semantic headings and lists with distinct visual hierarchy", async () => {
    const page = await BlogPostPage({
      params: Promise.resolve({ slug: "pipelines-that-survive-an-audit" }),
    });
    const { container } = render(page);

    // Verify authored h2 elements exist and are semantic
    const headings = container.querySelectorAll("article h2");
    expect(headings.length).toBe(4);
    expect(headings[0].textContent).toContain("Working is the easy half");
    expect(headings[1].textContent).toContain(
      "Three properties that must be structural"
    );
    expect(headings[2].textContent).toContain(
      "The failure that is hardest to catch"
    );
    expect(headings[3].textContent).toContain("What to test");

    // Verify each heading has a generated ID
    headings.forEach((heading) => {
      expect(heading.id).toBeTruthy();
      expect(heading.id.startsWith("section-")).toBe(true);
    });

    // Verify authored unordered list and list items exist within prose
    const lists = container.querySelectorAll("article ul");
    expect(lists.length).toBeGreaterThanOrEqual(1);
    const listItems = container.querySelectorAll("article ul li");
    expect(listItems.length).toBe(3);
    expect(listItems[0].textContent).toContain(
      "Re-run a pinned rule against a stored input hash"
    );
  });

  it("renders syntax-tokenized code with interactive copy control", async () => {
    const page = await BlogPostPage({
      params: Promise.resolve({ slug: "pipelines-that-survive-an-audit" }),
    });
    const { container } = render(page);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /copy code to clipboard/i })
      ).toBeDefined();
    });

    // Language label
    expect(screen.getByText("TYPESCRIPT")).toBeDefined();

    // Verify keywords and comments are tokenized
    const keywords = Array.from(
      container.querySelectorAll(".blog-code-token--keyword"),
      (el) => el.textContent
    );
    expect(keywords).toContain("interface");

    const comments = Array.from(
      container.querySelectorAll(".blog-code-token--comment"),
      (el) => el.textContent
    );
    expect(
      comments.some((c) => c?.includes("the ODM item this came from"))
    ).toBe(true);
  });

  it("positions topic tags below the article narrative and before reactions", async () => {
    const page = await BlogPostPage({
      params: Promise.resolve({ slug: "pipelines-that-survive-an-audit" }),
    });
    const { container } = render(page);

    const article = container.querySelector("article");
    expect(article).not.toBeNull();

    // Tags should be inside or immediately in article footer
    const articleFooter = container.querySelector(
      "article footer[aria-label='Article topics']"
    );
    expect(articleFooter).not.toBeNull();

    // Verify topic tags are present
    expect(articleFooter?.textContent).toContain("#cdisc");
    expect(articleFooter?.textContent).toContain("#audit-trail");
    expect(articleFooter?.textContent).toContain("#provenance");

    // Verify header does NOT contain topic tags
    const header = container.querySelector("header");
    expect(header?.textContent).not.toContain("#cdisc");
  });

  it("supplies responsive TOC with desktop side rail and mobile collapsible toggle", async () => {
    const page = await BlogPostPage({
      params: Promise.resolve({ slug: "pipelines-that-survive-an-audit" }),
    });
    const { container } = render(page);

    // TOC rail container
    const tocRail = container.querySelector(".blog-reader-toc-rail");
    expect(tocRail).not.toBeNull();

    // Mobile/tablet accordion toggle button
    const toggleButton = screen.getByRole("button", {
      name: /toggle table of contents/i,
    });
    expect(toggleButton.className).toContain("lg:hidden");

    // TOC links to all sections
    const tocNav = screen.getByRole("navigation", {
      name: /table of contents/i,
    });
    expect(tocNav).toBeDefined();
    const tocLinks = Array.from(tocNav.querySelectorAll("a"), (a) =>
      a.textContent?.trim()
    );
    expect(tocLinks).toContain("Working is the easy half");
    expect(tocLinks).toContain("Three properties that must be structural");
    expect(tocLinks).toContain("The failure that is hardest to catch");
    expect(tocLinks).toContain("What to test");
  });
});
