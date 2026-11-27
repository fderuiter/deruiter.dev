// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  DeleteBlogPostHandler,
  type PersistedBlogPostRecord,
} from "@/lib/services";

describe("DeleteBlogPostHandler (Logic Test)", () => {
  it("deletes existing blog post and evicts its slug cache", async () => {
    const existing = fromPartial<PersistedBlogPostRecord>({
      id: "post-1",
      slug: "post-slug",
    });
    const del = vi.fn().mockResolvedValue({});
    const evictCache = vi.fn().mockResolvedValue({});

    const handler = new DeleteBlogPostHandler({
      blogPosts: {
        findUnique: vi.fn().mockResolvedValue(existing),
        delete: del,
      },
      evictCache,
    });

    const result = await handler.execute({ id: "post-1" });
    expect(result.success).toBe(true);
    expect(del).toHaveBeenCalledWith({ where: { id: "post-1" } });
    expect(evictCache).toHaveBeenCalledWith("post-slug");
  });

  it("returns BLOG_POST_NOT_FOUND or STORAGE_UNAVAILABLE without throwing", async () => {
    const missingHandler = new DeleteBlogPostHandler({
      blogPosts: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
    });
    const missing = await missingHandler.execute({ id: "missing" });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.code).toBe("BLOG_POST_NOT_FOUND");
    }

    const errHandler = new DeleteBlogPostHandler({
      blogPosts: {
        findUnique: vi.fn().mockRejectedValue(new Error("DB offline")),
        delete: vi.fn(),
      },
    });
    const errRes = await errHandler.execute({ id: "post-1" });
    expect(errRes.success).toBe(false);
    if (!errRes.success) {
      expect(errRes.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
