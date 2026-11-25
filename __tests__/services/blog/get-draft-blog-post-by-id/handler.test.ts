// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GetDraftBlogPostByIdHandler,
  type BlogPostDbRecord,
  type GetDraftBlogPostByIdDeps,
} from "@/lib/services";

describe("GetDraftBlogPostByIdHandler (Logic Test)", () => {
  it("returns unpublished draft record", async () => {
    const draft = fromPartial<BlogPostDbRecord>({
      id: "draft-1",
      slug: "draft-slug",
      published: false,
    });
    const deps = fromPartial<GetDraftBlogPostByIdDeps>({
      db: { blogPost: { findFirst: async () => draft } },
    });

    const handler = new GetDraftBlogPostByIdHandler(deps);
    const result = await handler.execute({ id: "draft-1" });
    expect(result).toEqual({ success: true, data: draft });
  });

  it("returns STORAGE_UNAVAILABLE when Prisma findFirst throws", async () => {
    const deps = fromPartial<GetDraftBlogPostByIdDeps>({
      db: {
        blogPost: {
          findFirst: async () => {
            throw new Error("DB error");
          },
        },
      },
    });

    const handler = new GetDraftBlogPostByIdHandler(deps);
    const result = await handler.execute({ id: "draft-1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
