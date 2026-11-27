// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BlogReactionFlushErrorCode,
  FlushBlogReactionsInputSchema,
} from "@/lib/services";

describe("FlushBlogReactionsInputSchema (Contract Test)", () => {
  it("accepts optional bounded batchSize", () => {
    expect(FlushBlogReactionsInputSchema.safeParse({}).success).toBe(true);
    expect(
      FlushBlogReactionsInputSchema.safeParse({ batchSize: 100 }).success
    ).toBe(true);
  });

  it("rejects non-positive batchSize", () => {
    expect(
      FlushBlogReactionsInputSchema.safeParse({ batchSize: 0 }).success
    ).toBe(false);
    expect(BlogReactionFlushErrorCode.options).toContain("PERSISTENCE_FAILED");
  });
});
