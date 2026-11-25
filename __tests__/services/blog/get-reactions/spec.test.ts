// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetBlogReactionsErrorCode,
  GetBlogReactionsInputSchema,
} from "@/lib/services";

describe("GetBlogReactions Spec (Contract Test)", () => {
  it("accepts non-empty slug and connectionHash", () => {
    expect(
      GetBlogReactionsInputSchema.safeParse({
        slug: "post-1",
        connectionHash: "hash-1",
      }).success
    ).toBe(true);
  });

  it("rejects empty slug with INVALID_INPUT", () => {
    expect(
      GetBlogReactionsInputSchema.safeParse({
        slug: "",
        connectionHash: "hash-1",
      }).success
    ).toBe(false);
    expect(GetBlogReactionsErrorCode.options).toContain("INVALID_INPUT");
  });
});
