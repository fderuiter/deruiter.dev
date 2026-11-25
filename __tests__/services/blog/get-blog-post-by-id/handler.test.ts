// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GetBlogPostByIdHandler,
  type BlogPostDbRecord,
  type GetBlogPostByIdDeps,
} from "@/lib/services";

describe("GetBlogPostByIdHandler (Logic Test)", () => {
  it("returns post record when found", async () => {
    const post = fromPartial<BlogPostDbRecord>({
      id: "post-1",
      slug: "found-post",
      title: "Found Post",
    });
    const deps = fromPartial<GetBlogPostByIdDeps>({
      db: { blogPost: { findUnique: async () => post } },
    });

    const handler = new GetBlogPostByIdHandler(deps);
    const result = await handler.execute({ id: "post-1" });
    expect(result).toEqual({ success: true, data: post });
  });

  it("distinguishes NOT_FOUND from STORAGE_UNAVAILABLE", async () => {
    const notFoundHandler = new GetBlogPostByIdHandler(
      fromPartial<GetBlogPostByIdDeps>({
        db: { blogPost: { findUnique: async () => null } },
      })
    );
    const missing = await notFoundHandler.execute({ id: "missing" });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.code).toBe("NOT_FOUND");

    const outageHandler = new GetBlogPostByIdHandler(
      fromPartial<GetBlogPostByIdDeps>({
        db: {
          blogPost: {
            findUnique: async () => {
              throw new Error("DB timeout");
            },
          },
        },
      })
    );
    const outage = await outageHandler.execute({ id: "post-1" });
    expect(outage.success).toBe(false);
    if (!outage.success) expect(outage.error.code).toBe("STORAGE_UNAVAILABLE");
  });
});
