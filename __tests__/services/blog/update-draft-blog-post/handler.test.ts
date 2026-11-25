// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  UpdateDraftBlogPostHandler,
  type BlogPostDbRecord,
  type UpdateDraftBlogPostDeps,
} from "@/lib/services";

describe("UpdateDraftBlogPostHandler (Logic Test)", () => {
  it("transitions draft to published, queues announcement, and evicts caches", async () => {
    const draft = fromPartial<BlogPostDbRecord>({
      id: "post-1",
      slug: "draft-slug",
      published: false,
    });
    const published = fromPartial<BlogPostDbRecord>({
      id: "post-1",
      slug: "draft-slug",
      published: true,
    });
    const queueAnnouncement = vi.fn(async () => undefined);
    const evictExecute = vi.fn(async () => ({
      success: true as const,
      data: { evicted: true },
    }));
    const deps = fromPartial<UpdateDraftBlogPostDeps>({
      getDraftByIdHandler: {
        execute: async () => ({ success: true, data: draft }),
      },
      evictCacheHandler: { execute: evictExecute },
      queueAnnouncement,
      sanitizeHtml: async (html: string) => html,
      db: {
        blogPost: {
          updateManyAndReturn: async () => [published],
        },
      },
    });

    const handler = new UpdateDraftBlogPostHandler(deps);
    const result = await handler.execute({
      id: "post-1",
      patch: { published: true, body: "<p>Published body</p>" },
    });

    expect(result).toEqual({ success: true, data: published });
    expect(queueAnnouncement).toHaveBeenCalledWith("post-1");
    expect(evictExecute).toHaveBeenCalledWith({ slug: "draft-slug" });
  });

  it("propagates STORAGE_UNAVAILABLE when draft lookup fails due to database outage", async () => {
    const deps = fromPartial<UpdateDraftBlogPostDeps>({
      getDraftByIdHandler: {
        execute: async () => ({
          success: false,
          error: {
            code: "STORAGE_UNAVAILABLE",
            message: "Database offline",
            recoverable: true,
          },
        }),
      },
    });

    const handler = new UpdateDraftBlogPostHandler(deps);
    const result = await handler.execute({
      id: "post-1",
      patch: { title: "New" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
