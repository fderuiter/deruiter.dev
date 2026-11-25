// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  EvictBlogPostCacheHandler,
  type EvictBlogPostCacheDeps,
} from "@/lib/services";

describe("EvictBlogPostCacheHandler (Logic Test)", () => {
  it("evicts Redis keys and triggers Next.js path and tag revalidation", async () => {
    const del = vi.fn(async () => 2);
    const revalidatePath = vi.fn(async () => undefined);
    const revalidateTag = vi.fn(async () => undefined);
    const deps = fromPartial<EvictBlogPostCacheDeps>({
      isRedisReady: () => true,
      redisClient: { del },
      revalidatePath,
      revalidateTag,
    });

    const handler = new EvictBlogPostCacheHandler(deps);
    const result = await handler.execute({ slug: "my-post" });

    expect(result).toEqual({ success: true, data: { evicted: true } });
    expect(del).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
    expect(revalidateTag).toHaveBeenCalled();
  });

  it("returns INVALID_INPUT on invalid payload", async () => {
    const handler = new EvictBlogPostCacheHandler();
    const result = await handler.execute(fromAny({ slug: null }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
