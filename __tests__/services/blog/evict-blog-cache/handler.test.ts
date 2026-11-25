// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { EvictBlogCacheHandler } from "@/lib/services";

describe("EvictBlogCacheHandler (Logic Test)", () => {
  const handler = new EvictBlogCacheHandler();

  it("returns success for valid or blank string slugs", async () => {
    const valid = await handler.execute({ slug: "systems-post" });
    expect(valid.success).toBe(true);

    const blank = await handler.execute({ slug: "   " });
    expect(blank.success).toBe(true);
    if (blank.success) {
      expect(blank.data.evicted).toBe(false);
    }
  });

  it("returns INVALID_BLOG_SLUG for non-string input", async () => {
    const invalid = await handler.execute(fromAny({ slug: 42 }));
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.code).toBe("INVALID_BLOG_SLUG");
    }
  });
});
