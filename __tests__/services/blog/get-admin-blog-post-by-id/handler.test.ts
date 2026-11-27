// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  GetAdminBlogPostByIdHandler,
  type PersistedBlogPostRecord,
} from "@/lib/services";

describe("GetAdminBlogPostByIdHandler (Logic Test)", () => {
  it("returns persisted blog post by ID and surfaces STORAGE_UNAVAILABLE instead of masking DB outages", async () => {
    const record = fromPartial<PersistedBlogPostRecord>({
      id: "post-1",
      slug: "my-post",
      title: "My Post",
      published: true,
    });
    const okHandler = new GetAdminBlogPostByIdHandler({
      blogPosts: { findUnique: vi.fn().mockResolvedValue(record) },
    });
    const ok = await okHandler.execute({ id: "post-1" });
    expect(ok.success).toBe(true);

    const outageHandler = new GetAdminBlogPostByIdHandler({
      blogPosts: {
        findUnique: vi
          .fn()
          .mockRejectedValue(new Error("DB connection failed")),
      },
    });
    const outage = await outageHandler.execute({ id: "post-1" });
    expect(outage.success).toBe(false);
    if (!outage.success) {
      expect(outage.error.code).toBe("STORAGE_UNAVAILABLE");
      expect(outage.error.recoverable).toBe(true);
    }
  });
});
