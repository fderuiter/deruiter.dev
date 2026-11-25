// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  EvictCaseStudyCacheHandler,
  type EvictCaseStudyCacheDeps,
} from "@/lib/services";

describe("EvictCaseStudyCacheHandler (Logic Test)", () => {
  it("deletes scoped Redis keys and dispatches Next.js path/tag revalidations", async () => {
    const del = vi.fn(async () => 2);
    const revalidatePathFn = vi.fn(async () => undefined);
    const revalidateTagFn = vi.fn(async () => undefined);
    const deps = fromPartial<EvictCaseStudyCacheDeps>({
      redisClient: { del },
      isRedisReady: () => true,
      revalidatePathFn,
      revalidateTagFn,
    });

    const handler = new EvictCaseStudyCacheHandler(deps);
    const result = await handler.execute({ slug: "crf" });

    expect(result).toEqual({ success: true, data: { evicted: true } });
    expect(del).toHaveBeenCalledTimes(4);
    expect(revalidatePathFn).toHaveBeenCalled();
    expect(revalidateTagFn).toHaveBeenCalled();
  });

  it("returns INVALID_INPUT for malformed input", async () => {
    const handler = new EvictCaseStudyCacheHandler();
    const result = await handler.execute(fromAny({ slug: null }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
