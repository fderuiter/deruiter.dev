// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GetAllBlogPostsAdminHandler,
  type BlogPostDbRecord,
  type GetAllBlogPostsAdminDeps,
} from "@/lib/services";

describe("GetAllBlogPostsAdminHandler (Logic Test)", () => {
  it("returns all persisted blog posts ordered for admin console", async () => {
    const post = fromPartial<BlogPostDbRecord>({
      id: "post-1",
      slug: "admin-post",
      title: "Admin Post",
      published: false,
    });
    const deps = fromPartial<GetAllBlogPostsAdminDeps>({
      db: {
        blogPost: {
          findMany: async () => [post],
        },
      },
    });

    const handler = new GetAllBlogPostsAdminHandler(deps);
    const result = await handler.execute();
    expect(result).toEqual({ success: true, data: [post] });
  });

  it("returns STORAGE_UNAVAILABLE when database query fails", async () => {
    const deps = fromPartial<GetAllBlogPostsAdminDeps>({
      db: {
        blogPost: {
          findMany: async () => {
            throw new Error("DB down");
          },
        },
      },
    });

    const handler = new GetAllBlogPostsAdminHandler(deps);
    const result = await handler.execute();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
