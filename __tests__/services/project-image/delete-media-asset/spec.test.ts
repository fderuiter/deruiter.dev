// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DeleteMediaAssetInputSchema } from "@/lib/services";

describe("DeleteMediaAssetInputSchema (Contract Test)", () => {
  it("accepts non-empty asset key", () => {
    expect(
      DeleteMediaAssetInputSchema.safeParse({ key: "projects/demo-hero.png" })
        .success
    ).toBe(true);
  });

  it("rejects empty asset key", () => {
    expect(DeleteMediaAssetInputSchema.safeParse({ key: "" }).success).toBe(
      false
    );
  });
});
