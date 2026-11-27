// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GetMediaAssetErrorCode,
  GetMediaAssetInputSchema,
} from "@/lib/services";

describe("GetMediaAssetInputSchema (Contract Test)", () => {
  it("accepts non-empty media key", () => {
    const parsed = GetMediaAssetInputSchema.safeParse({
      key: "projects/crf-studio/hero.png",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty key", () => {
    const parsed = GetMediaAssetInputSchema.safeParse({ key: "" });
    expect(parsed.success).toBe(false);
    expect(GetMediaAssetErrorCode.options).toContain("INVALID_MEDIA_KEY");
  });
});
