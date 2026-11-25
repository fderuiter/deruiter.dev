// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  DeleteBlogPostHandler,
  type BlogPostDbRecord,
  type DeleteBlogPostDeps,
} from "@/lib/services";

describe("DeleteBlogPostHandler (Logic Test)", () => {
  it("deletes existing blog post and evicts cache by slug", async () => {
    const existing = fromPartial<BlogPostDbRecord>({
      id: "post-1",
      slug: "to-delete",
      title: "Delete Me",
    });
    const evictExecute = vi.fn(async () => ({
      success: true as const,
      data: { evicted: true },
    }));
    const deps = fromPartial<DeleteBlogPostDeps>({
      evictCacheHandler: { execute: evictExecute },
      db: {
        blogPost: {
          findUnique: async () => existing,
          delete: async () => existing,
        },
      },
    });

    const handler = new DeleteBlogPostHandler(deps);
    const result = await handler.execute({ id: "post-1" });
    expect(result).toEqual({ success: true, data: existing });
    expect(evictExecute).toHaveBeenCalledWith({ slug: "to-delete" });
  });

  it("returns NOT_FOUND when post does not exist", async () => {
    const deps = fromPartial<DeleteBlogPostDeps>({
      db: {
        blogPost: {
          findUnique: async () => null,
          delete: async () => {
            throw new Error("unused");
          },
        },
      },
    });

    const handler = new DeleteBlogPostHandler(deps);
    const result = await handler.execute({ id: "missing" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
