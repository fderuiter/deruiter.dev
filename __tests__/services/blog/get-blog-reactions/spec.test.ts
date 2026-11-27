// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetBlogReactionsErrorCode,
  GetBlogReactionsInputSchema,
} from "@/lib/services";

describe("GetBlogReactionsInputSchema (Contract Test)", () => {
  it("accepts valid slug and connectionHash", () => {
    expect(
      GetBlogReactionsInputSchema.safeParse({
        slug: "post-1",
        connectionHash: "conn-1",
      }).success
    ).toBe(true);
  });

  it("rejects empty slug", () => {
    expect(
      GetBlogReactionsInputSchema.safeParse({
        slug: "   ",
        connectionHash: "conn-1",
      }).success
    ).toBe(false);
    expect(GetBlogReactionsErrorCode.options).toContain(
      "INVALID_REACTION_QUERY"
    );
  });
});
