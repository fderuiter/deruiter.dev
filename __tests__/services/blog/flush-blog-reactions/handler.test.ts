// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { FlushBlogReactionsHandler } from "@/lib/services";

describe("FlushBlogReactionsHandler (Logic Test)", () => {
  it("returns zero counts when Redis is unconfigured", async () => {
    const handler = new FlushBlogReactionsHandler({
      reactions: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    });

    const result = await handler.execute({ batchSize: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ processed: 0, inserted: 0 });
    }
  });
});
