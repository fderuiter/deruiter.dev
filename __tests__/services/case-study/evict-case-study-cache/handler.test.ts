// @vitest-environment node
import { describe, expect, it } from "vitest";
import { EvictCaseStudyCacheHandler } from "@/lib/services";

describe("EvictCaseStudyCacheHandler (Logic Test)", () => {
  const handler = new EvictCaseStudyCacheHandler();

  it("returns success envelope when evicting valid slug", async () => {
    const result = await handler.execute({ slug: "crf-studio" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.evicted).toBe("boolean");
    }
  });

  it("returns INVALID_CASE_STUDY_SLUG on blank slug without throwing", async () => {
    const result = await handler.execute({ slug: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_CASE_STUDY_SLUG");
    }
  });
});
