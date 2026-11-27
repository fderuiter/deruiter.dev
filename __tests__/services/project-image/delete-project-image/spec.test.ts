// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DeleteProjectImageErrorCode,
  DeleteProjectImageInputSchema,
} from "@/lib/services";

describe("DeleteProjectImageInputSchema (Contract Test)", () => {
  it("accepts non-empty project slug", () => {
    const parsed = DeleteProjectImageInputSchema.safeParse({
      slug: "crf-studio",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects blank slug", () => {
    const parsed = DeleteProjectImageInputSchema.safeParse({
      slug: "   ",
    });
    expect(parsed.success).toBe(false);
    expect(DeleteProjectImageErrorCode.options).toContain(
      "INVALID_PROJECT_IMAGE_SLUG"
    );
  });
});
