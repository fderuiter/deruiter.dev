// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  ListDraftBlogPostsHandler,
  type PersistedBlogPostRecord,
} from "@/lib/services";

describe("ListDraftBlogPostsHandler (Logic Test)", () => {
  it("returns paginated drafts and total count", async () => {
    const draft = fromPartial<PersistedBlogPostRecord>({
      id: "d-1",
      slug: "draft-1",
      published: false,
    });
    const handler = new ListDraftBlogPostsHandler({
      blogPosts: {
        findMany: vi.fn().mockResolvedValue([draft]),
        count: vi.fn().mockResolvedValue(1),
      },
    });

    const result = await handler.execute({ page: 1, pageSize: 20 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(1);
      expect(result.data.drafts).toHaveLength(1);
    }
  });

  it("returns INVALID_PAGINATION or STORAGE_UNAVAILABLE without throwing", async () => {
    const handler = new ListDraftBlogPostsHandler({
      blogPosts: {
        findMany: vi.fn().mockRejectedValue(new Error("DB error")),
        count: vi.fn(),
      },
    });

    const invalid = await handler.execute({ page: 0, pageSize: 10 });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.code).toBe("INVALID_PAGINATION");
    }

    const dbFail = await handler.execute({ page: 1, pageSize: 10 });
    expect(dbFail.success).toBe(false);
    if (!dbFail.success) {
      expect(dbFail.error.code).toBe("STORAGE_UNAVAILABLE");
    }
  });
});
