// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/blog", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/blog")>("@/lib/blog");
  return {
    ...actual,
    getAllPublishedBlogPosts: vi.fn(),
    getBlogPostBySlug: vi.fn(),
  };
});

import { getAllPublishedBlogPosts, getBlogPostBySlug } from "@/lib/blog";
import BlogPostPage from "@/app/(desktop)/blog/[slug]/page";

describe("Blog Reader Metadata Display (Ticket #1056)", () => {
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

  it("renders author byline, formatted dates, reading time, and pillar badge", async () => {
    const mockPost = {
      slug: "test-metadata-slug",
      title: "Test Engineering Post",
      dek: "A deep dive into high-assurance systems.",
      pillar: "clinical-data-engineering" as const,
      tags: ["cdisc", "odm"],
      publishedAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-05T00:00:00.000Z"), // updated 4 days later
      readingTimeMinutes: 7,
      heroImageUrl: null,
      body: "<h2>First Section</h2><p>Paragraph text.</p><h2>Second Section</h2><p>Another paragraph.</p>",
    };

    vi.mocked(getAllPublishedBlogPosts).mockResolvedValue([mockPost]);
    vi.mocked(getBlogPostBySlug).mockResolvedValue(mockPost);

    const pageElement = await BlogPostPage({
      params: Promise.resolve({ slug: "test-metadata-slug" }),
    });

    const { container } = render(pageElement);

    // Author byline
    expect(screen.getByText("By Frederick de Ruiter")).toBeDefined();

    // Publication date in UTC
    expect(screen.getByText("March 1, 2026")).toBeDefined();

    // Updated date
    expect(screen.getByText("Updated March 5, 2026")).toBeDefined();

    // Reading time
    expect(screen.getByText("7 min read")).toBeDefined();

    // Pillar badge
    expect(
      screen.getByText("Clinical Data Engineering & CDISC Standards")
    ).toBeDefined();

    // Tags
    expect(screen.getByText("#cdisc")).toBeDefined();
    expect(screen.getByText("#odm")).toBeDefined();

    const article = container.querySelector("article");
    const topicsFooter = article?.querySelector(
      'footer[aria-label="Article topics"]'
    );
    const reactions = container.querySelector(
      '[data-testid="blog-post-reactions"]'
    );

    expect(article).not.toBeNull();
    expect(topicsFooter).not.toBeNull();
    expect(topicsFooter?.textContent).toContain("#cdisc");
    expect(topicsFooter?.textContent).toContain("#odm");
    expect(topicsFooter?.parentElement).toBe(article);
    expect(article?.lastElementChild).toBe(topicsFooter);
    expect(reactions).not.toBeNull();
    expect(
      (article!.compareDocumentPosition(reactions!) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0
    ).toBe(true);

    for (const metadata of [
      screen.getByText("Clinical Data Engineering & CDISC Standards"),
      screen.getByText("By Frederick de Ruiter"),
      screen.getByText("March 1, 2026"),
      screen.getByText("7 min read"),
    ]) {
      expect(
        (metadata.compareDocumentPosition(article!) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0
      ).toBe(true);
    }
  });
});
