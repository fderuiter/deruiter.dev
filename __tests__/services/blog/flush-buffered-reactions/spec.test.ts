// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BlogReactionFlushErrorCode,
  FlushBlogReactionsInputSchema,
} from "@/lib/services";

describe("FlushBlogReactions Spec (Contract Test)", () => {
  it("defaults batchSize to 500", () => {
    const parsed = FlushBlogReactionsInputSchema.safeParse(undefined);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.batchSize).toBe(500);
    }
  });

  it("rejects batchSize over 5000 and defines flush error codes", () => {
    const parsed = FlushBlogReactionsInputSchema.safeParse({ batchSize: 5001 });
    expect(parsed.success).toBe(false);
    expect(BlogReactionFlushErrorCode.options).toEqual(
      expect.arrayContaining([
        "PERSISTENCE_FAILED",
        "FLUSH_FAILED",
        "INVALID_INPUT",
      ])
    );
  });
});
