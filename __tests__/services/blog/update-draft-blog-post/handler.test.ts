// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  UpdateDraftBlogPostHandler,
  type PersistedBlogPostRecord,
} from "@/lib/services";

describe("UpdateDraftBlogPostHandler (Logic Test)", () => {
  it("updates draft, evicts cache, and queues newsletter announcement on first publish", async () => {
    const existing = fromPartial<PersistedBlogPostRecord>({
      id: "draft-1",
      slug: "draft-slug",
      published: false,
    });
    const updated = fromPartial<PersistedBlogPostRecord>({
      id: "draft-1",
      slug: "draft-slug",
      published: true,
    });
    const evictCache = vi.fn().mockResolvedValue({});
    const queuePostAnnouncement = vi.fn().mockResolvedValue({});

    const handler = new UpdateDraftBlogPostHandler({
      blogPosts: {
        findFirst: vi.fn().mockResolvedValue(existing),
        findUnique: vi.fn().mockResolvedValue(existing),
        updateManyAndReturn: vi.fn().mockResolvedValue([updated]),
      },
      evictCache,
      queuePostAnnouncement,
      sanitizeHtml: async (s) => s,
    });

    const result = await handler.execute({
      id: "draft-1",
      updates: { published: true },
    });

    expect(result.success).toBe(true);
    expect(evictCache).toHaveBeenCalledWith("draft-slug");
    expect(queuePostAnnouncement).toHaveBeenCalledWith("draft-1");
  });

  it("returns EMPTY_DRAFT_UPDATE or BLOG_POST_NOT_FOUND without throwing", async () => {
    const handler = new UpdateDraftBlogPostHandler({
      blogPosts: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        updateManyAndReturn: vi.fn().mockResolvedValue([]),
      },
    });

    const empty = await handler.execute({ id: "draft-1", updates: {} });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.code).toBe("EMPTY_DRAFT_UPDATE");
    }

    const missing = await handler.execute({
      id: "missing",
      updates: { title: "New" },
    });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.code).toBe("BLOG_POST_NOT_FOUND");
    }
  });
});
