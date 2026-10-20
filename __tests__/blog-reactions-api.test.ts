// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  POST as blogReactionPOST,
  GET as blogReactionGET,
} from "@/app/api/blog/reactions/route";
import { resetSubmissionAttemptRateLimit } from "@/lib/moderation";
import { prisma } from "@/lib/db";

const mockPublishedPost = {
  id: "blog-1",
  slug: "cdisc-crf-compiler-architecture",
  title: "CDISC CRF Compiler Architecture",
  dek: "Deep dive into CDISC ODM and CRF standards.",
  body: "<p>Content body</p>",
  pillar: "formal-verification",
  tags: "cdisc, compiler",
  published: true,
  reading_time_minutes: 5,
  hero_image_url: null,
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-01T00:00:00Z"),
};

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    blogPostReaction: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

describe("Blog Post Reactions API (/api/blog/reactions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSubmissionAttemptRateLimit();

    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue(
      mockPublishedPost as any
    );
    vi.mocked(prisma.blogPostReaction.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.blogPostReaction.findMany).mockResolvedValue([] as never);
  });

  it("should reject GET requests missing slug parameter with 400", async () => {
    const req = new NextRequest("http://localhost/api/blog/reactions");
    const res = await blogReactionGET(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain("Missing required query parameter");
  });

  it("should return reaction counts on GET for valid post slug", async () => {
    const req = new NextRequest(
      "http://localhost/api/blog/reactions?slug=cdisc-crf-compiler-architecture"
    );
    const res = await blogReactionGET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.blogPostSlug).toBe("cdisc-crf-compiler-architecture");
    expect(json.counts).toHaveProperty("insightful");
    expect(json.counts).toHaveProperty("mind_blowing");
    expect(json.counts).toHaveProperty("actionable");
    expect(json.counts).toHaveProperty("thorough");
  });

  it("should reject invalid reaction type with 400", async () => {
    const req = new NextRequest("http://localhost/api/blog/reactions", {
      method: "POST",
      body: JSON.stringify({
        blogPostSlug: "cdisc-crf-compiler-architecture",
        reactionType: "invalid_reaction",
      }),
    });

    const res = await blogReactionPOST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("should return 404 for non-existent or unpublished blog post", async () => {
    vi.mocked(prisma.blogPost.findUnique).mockResolvedValueOnce(null as any);

    const req = new NextRequest("http://localhost/api/blog/reactions", {
      method: "POST",
      body: JSON.stringify({
        blogPostSlug: "non-existent-blog-post-slug-12345",
        reactionType: "insightful",
      }),
    });

    const res = await blogReactionPOST(req);
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toContain("Blog post not found or not published");
  });

  it("should accept valid reaction submission for a published post with 200", async () => {
    vi.mocked(prisma.blogPostReaction.groupBy).mockResolvedValueOnce([
      { reactionType: "insightful", _count: { id: 1 } },
    ] as never);
    vi.mocked(prisma.blogPostReaction.findMany).mockResolvedValueOnce([
      { reactionType: "insightful" },
    ] as never);

    const req = new NextRequest("http://localhost/api/blog/reactions", {
      method: "POST",
      headers: {
        "x-forwarded-for": "10.0.0.1",
        "user-agent": "blog-rx-agent-1",
      },
      body: JSON.stringify({
        blogPostSlug: "cdisc-crf-compiler-architecture",
        reactionType: "insightful",
      }),
    });

    const res = await blogReactionPOST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.reactionType).toBe("insightful");
    expect(json.counts.insightful).toBeGreaterThanOrEqual(1);
    expect(json.userReactions).toContain("insightful");
  });

  it("should return 429 when connection hash exceeds rate limit threshold", async () => {
    const headers = {
      "x-forwarded-for": "10.0.0.99",
      "user-agent": "rate-limit-tester",
    };

    for (let i = 0; i < 10; i++) {
      const req = new NextRequest("http://localhost/api/blog/reactions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          blogPostSlug: "cdisc-crf-compiler-architecture",
          reactionType: "insightful",
        }),
      });
      await blogReactionPOST(req);
    }

    const reqExceeded = new NextRequest("http://localhost/api/blog/reactions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        blogPostSlug: "cdisc-crf-compiler-architecture",
        reactionType: "actionable",
      }),
    });

    const res = await blogReactionPOST(reqExceeded);
    expect(res.status).toBe(429);

    const json = await res.json();
    expect(json.error).toContain("Too many submission attempts");
  });

  it("should return 429 when user attempts a duplicate reaction within the sliding window", async () => {
    vi.mocked(prisma.blogPostReaction.findFirst).mockResolvedValueOnce({
      id: "rx-1",
      blogPostSlug: "cdisc-crf-compiler-architecture",
      reactionType: "insightful",
      connectionHash: "test-hash",
      createdAt: new Date(),
    } as any);

    const req = new NextRequest("http://localhost/api/blog/reactions", {
      method: "POST",
      headers: {
        "x-forwarded-for": "10.0.0.1",
        "user-agent": "duplicate-agent",
      },
      body: JSON.stringify({
        blogPostSlug: "cdisc-crf-compiler-architecture",
        reactionType: "insightful",
      }),
    });

    const res = await blogReactionPOST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Duplicate reaction");
  });
});
