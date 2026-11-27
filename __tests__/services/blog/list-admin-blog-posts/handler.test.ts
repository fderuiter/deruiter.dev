// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  ListAdminBlogPostsHandler,
  type PersistedBlogPostRecord,
} from "@/lib/services";

describe("ListAdminBlogPostsHandler (Logic Test)", () => {
  it("returns admin blog records and fails with STORAGE_UNAVAILABLE instead of empty array on DB error", async () => {
    const row = fromPartial<PersistedBlogPostRecord>({
      id: "p-1",
      slug: "admin-post",
      published: false,
    });
    const okHandler = new ListAdminBlogPostsHandler({
      blogPosts: { findMany: vi.fn().mockResolvedValue([row]) },
    });
    const ok = await okHandler.execute();
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data).toHaveLength(1);
    }

    const outageHandler = new ListAdminBlogPostsHandler({
      blogPosts: {
        findMany: vi.fn().mockRejectedValue(new Error("DB offline")),
      },
    });
    const outage = await outageHandler.execute();
    expect(outage.success).toBe(false);
    if (!outage.success) {
      expect(outage.error.code).toBe("STORAGE_UNAVAILABLE");
      expect(outage.error.recoverable).toBe(true);
    }
  });
});
