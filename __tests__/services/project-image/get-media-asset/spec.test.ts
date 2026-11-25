// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GetMediaAssetInputSchema } from "@/lib/services";

describe("GetMediaAssetInputSchema (Contract Test)", () => {
  it("accepts non-empty media key", () => {
    expect(
      GetMediaAssetInputSchema.safeParse({ key: "projects/slug-1.webp" })
        .success
    ).toBe(true);
  });

  it("rejects empty media key", () => {
    expect(GetMediaAssetInputSchema.safeParse({ key: "" }).success).toBe(false);
  });
});
