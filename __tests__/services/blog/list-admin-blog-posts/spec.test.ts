// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  ListAdminBlogPostsErrorCode,
  ListAdminBlogPostsInputSchema,
} from "@/lib/services";

describe("ListAdminBlogPostsInputSchema (Contract Test)", () => {
  it("accepts undefined or empty object", () => {
    expect(ListAdminBlogPostsInputSchema.safeParse(undefined).success).toBe(
      true
    );
    expect(ListAdminBlogPostsInputSchema.safeParse({}).success).toBe(true);
  });

  it("rejects primitive non-object values", () => {
    expect(
      ListAdminBlogPostsInputSchema.safeParse(fromAny("bad")).success
    ).toBe(false);
    expect(ListAdminBlogPostsErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
