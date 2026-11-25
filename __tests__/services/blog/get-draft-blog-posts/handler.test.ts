// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GetDraftBlogPostsHandler,
  type BlogPostDbRecord,
  type GetDraftBlogPostsDeps,
} from "@/lib/services";

describe("GetDraftBlogPostsHandler (Logic Test)", () => {
  it("returns paginated drafts and total count", async () => {
    const draft = fromPartial<BlogPostDbRecord>({
      id: "draft-1",
      slug: "draft-1",
      published: false,
    });
    const deps = fromPartial<GetDraftBlogPostsDeps>({
      db: {
        blogPost: {
          findMany: async () => [draft],
          count: async () => 1,
        },
      },
    });

    const handler = new GetDraftBlogPostsHandler(deps);
    const result = await handler.execute({ page: 1, pageSize: 10 });
    expect(result).toEqual({
      success: true,
      data: { drafts: [draft], total: 1 },
    });
  });

  it("returns STORAGE_UNAVAILABLE when database query fails", async () => {
    const deps = fromPartial<GetDraftBlogPostsDeps>({
      db: {
        blogPost: {
          findMany: async () => {
            throw new Error("DB error");
          },
          count: async () => 0,
        },
      },
    });

    const handler = new GetDraftBlogPostsHandler(deps);
    const result = await handler.execute({ page: 1, pageSize: 10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
