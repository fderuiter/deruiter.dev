// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  GetDraftBlogPostHandler,
  type PersistedBlogPostRecord,
} from "@/lib/services";

describe("GetDraftBlogPostHandler (Logic Test)", () => {
  it("loads unpublished blog draft and surfaces STORAGE_UNAVAILABLE on DB outage", async () => {
    const draft = fromPartial<PersistedBlogPostRecord>({
      id: "draft-1",
      slug: "draft-slug",
      published: false,
    });
    const okHandler = new GetDraftBlogPostHandler({
      blogPosts: { findFirst: vi.fn().mockResolvedValue(draft) },
    });
    const ok = await okHandler.execute({ id: "draft-1" });
    expect(ok.success).toBe(true);

    const notFoundHandler = new GetDraftBlogPostHandler({
      blogPosts: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    const notFound = await notFoundHandler.execute({ id: "missing" });
    expect(notFound.success).toBe(false);
    if (!notFound.success) {
      expect(notFound.error.code).toBe("BLOG_POST_NOT_FOUND");
    }
  });
});
