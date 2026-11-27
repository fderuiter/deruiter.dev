// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetBlogRssFeedErrorCode,
  GetBlogRssFeedInputSchema,
} from "@/lib/services";

describe("GetBlogRssFeedInputSchema (Contract Test)", () => {
  it("accepts empty object or valid baseUrl", () => {
    expect(GetBlogRssFeedInputSchema.safeParse({}).success).toBe(true);
    expect(
      GetBlogRssFeedInputSchema.safeParse({
        baseUrl: "https://deruiter.dev",
      }).success
    ).toBe(true);
  });

  it("rejects malformed baseUrl", () => {
    expect(
      GetBlogRssFeedInputSchema.safeParse({ baseUrl: "not-a-url" }).success
    ).toBe(false);
    expect(GetBlogRssFeedErrorCode.options).toContain("INVALID_RSS_FEED_INPUT");
  });
});
