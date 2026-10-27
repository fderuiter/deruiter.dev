// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

const redisConstructor = vi.hoisted(() => vi.fn());

vi.mock("@upstash/redis", () => ({
  Redis: function (this: Record<string, unknown>, config: unknown) {
    redisConstructor(config);
  },
}));

describe("Upstash client fetch cache mode (#3031)", () => {
  it("does not default to no-store, which would make every ISR page that reads Redis render per request", async () => {
    await import("@/lib/redis");

    expect(redisConstructor).toHaveBeenCalledTimes(1);
    const config = redisConstructor.mock.calls[0][0] as { cache?: string };
    // @upstash/redis substitutes "no-store" for a missing cache option, and a
    // no-store fetch during render marks the Next route dynamic.
    expect(config.cache).toBe("default");
  });
});
