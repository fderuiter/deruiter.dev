// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  SubmitBlogReactionHandler,
  createSuccess,
  type BlogPostData,
} from "@/lib/services";

describe("SubmitBlogReactionHandler (Logic Test)", () => {
  it("persists blog reaction and surfaces STORAGE_UNAVAILABLE instead of fake success on DB outage", async () => {
    const publishedPost = fromPartial<BlogPostData>({
      id: "p-1",
      slug: "post-1",
      published: true,
    });
    const okHandler = new SubmitBlogReactionHandler({
      getPublishedPost: vi.fn().mockResolvedValue(createSuccess(publishedPost)),
      reactions: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        groupBy: vi
          .fn()
          .mockResolvedValue([
            { reactionType: "insightful", _count: { id: 1 } },
          ]),
        findMany: vi.fn().mockResolvedValue([{ reactionType: "insightful" }]),
      },
    });
    const ok = await okHandler.execute({
      blogPostSlug: "post-1",
      reactionType: "insightful",
      connectionHash: "conn-1",
    });
    expect(ok.success).toBe(true);

    const outageHandler = new SubmitBlogReactionHandler({
      getPublishedPost: vi.fn().mockResolvedValue(createSuccess(publishedPost)),
      reactions: {
        findFirst: vi.fn().mockRejectedValue(new Error("Postgres down")),
        create: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
    });
    const outage = await outageHandler.execute({
      blogPostSlug: "post-1",
      reactionType: "insightful",
      connectionHash: "conn-1",
    });
    expect(outage.success).toBe(false);
    if (!outage.success) {
      expect(outage.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
