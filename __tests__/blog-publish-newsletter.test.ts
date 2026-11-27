// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  QueuePostAnnouncementHandler,
  UpdateDraftBlogPostHandler,
  createSuccess,
} from "@/lib/services";

vi.mock("@/lib/db", () => ({
  prisma: {
    blogPost: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateManyAndReturn: vi.fn(),
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

const draft = {
  id: "post-1",
  slug: "post-1",
  title: "Title",
  dek: "Dek",
  body: "<p>Body</p>",
  pillar: "agent-first-dx",
  tags: "a",
  hero_image_url: null,
  reading_time_minutes: 1,
  published: false,
  created_at: new Date("2026-09-20T00:00:00Z"),
  updated_at: new Date("2026-09-20T00:00:00Z"),
};

// #841: publishing queues an announcement for the daily maintenance run and
// sends nothing synchronously.
describe("UpdateDraftBlogPostHandler publish transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queues a newsletter announcement when a draft is published", async () => {
    const queue = vi
      .spyOn(QueuePostAnnouncementHandler.prototype, "execute")
      .mockResolvedValue(createSuccess({ queued: true, blogPostId: "post-1" }));
    vi.mocked(prisma.blogPost.findFirst).mockResolvedValue(draft);
    vi.mocked(prisma.blogPost.updateManyAndReturn).mockResolvedValue([
      { ...draft, published: true },
    ]);

    const res = await new UpdateDraftBlogPostHandler().execute({
      id: "post-1",
      updates: { published: true },
    });

    expect(res.success).toBe(true);
    expect(queue).toHaveBeenCalledExactlyOnceWith({ blogPostId: "post-1" });
  });

  it("does not queue for an edit that leaves the post a draft or re-saves a published post", async () => {
    const queue = vi
      .spyOn(QueuePostAnnouncementHandler.prototype, "execute")
      .mockResolvedValue(createSuccess({ queued: true, blogPostId: "post-1" }));
    vi.mocked(prisma.blogPost.findFirst).mockResolvedValue(draft);
    vi.mocked(prisma.blogPost.updateManyAndReturn).mockResolvedValue([
      { ...draft, title: "Edited" },
    ]);
    await new UpdateDraftBlogPostHandler().execute({
      id: "post-1",
      updates: { title: "Edited" },
    });

    vi.mocked(prisma.blogPost.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.blogPost.findUnique).mockResolvedValue({
      ...draft,
      published: true,
    });
    vi.mocked(prisma.blogPost.updateManyAndReturn).mockResolvedValue([
      { ...draft, published: true, title: "Typo fix" },
    ]);
    await new UpdateDraftBlogPostHandler().execute({
      id: "post-1",
      updates: { title: "Typo fix" },
    });

    expect(queue).not.toHaveBeenCalled();
  });

  it("keeps the publish when queueing the announcement fails", async () => {
    vi.spyOn(
      QueuePostAnnouncementHandler.prototype,
      "execute"
    ).mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.blogPost.findFirst).mockResolvedValue(draft);
    vi.mocked(prisma.blogPost.updateManyAndReturn).mockResolvedValue([
      { ...draft, published: true },
    ]);

    await expect(
      new UpdateDraftBlogPostHandler().execute({
        id: "post-1",
        updates: { published: true },
      })
    ).resolves.toMatchObject({
      success: true,
      data: { published: true },
    });
  });
});
