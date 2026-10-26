// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetBlogPostBySlug, mockCreateSocialImageResponse } = vi.hoisted(
  () => ({
    mockGetBlogPostBySlug: vi.fn(),
    mockCreateSocialImageResponse: vi.fn(
      () => new Response("card", { status: 200 })
    ),
  })
);

vi.mock("@/lib/blog", () => ({
  getBlogPostBySlug: mockGetBlogPostBySlug,
}));

vi.mock("@/lib/og-image", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/og-image")>();
  return {
    ...actual,
    createSocialImageResponse: mockCreateSocialImageResponse,
  };
});

import Image from "@/app/blog/[slug]/opengraph-image";

describe("blog post link preview for an unknown slug (#2971)", () => {
  beforeEach(() => {
    mockGetBlogPostBySlug.mockReset();
    mockCreateSocialImageResponse.mockClear();
  });

  it("returns 404 without rendering a card", async () => {
    mockGetBlogPostBySlug.mockResolvedValue(null);

    const res = await Image({
      params: Promise.resolve({ slug: "made-up-by-a-crawler" }),
    });

    expect(res.status).toBe(404);
    expect(mockCreateSocialImageResponse).not.toHaveBeenCalled();
  });

  it("renders the card for a published post", async () => {
    mockGetBlogPostBySlug.mockResolvedValue({
      title: "Four lanes, one merge slot",
      dek: "How the lanes share one slot.",
      tags: ["Process"],
      publishedAt: new Date("2026-10-25T00:00:00Z"),
      readingTimeMinutes: 6,
    });

    const res = await Image({
      params: Promise.resolve({ slug: "four-lanes-one-merge-slot" }),
    });

    expect(res.status).toBe(200);
    expect(mockCreateSocialImageResponse).toHaveBeenCalledOnce();
  });
});
