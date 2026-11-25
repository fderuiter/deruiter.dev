// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SaveMediaAssetInputSchema } from "@/lib/services";

describe("SaveMediaAssetInputSchema (Contract Test)", () => {
  it("accepts valid key, Buffer, and contentType", () => {
    expect(
      SaveMediaAssetInputSchema.safeParse({
        key: "projects/hero.png",
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        contentType: "image/png",
      }).success
    ).toBe(true);
  });

  it("rejects non-Buffer payloads", () => {
    expect(
      SaveMediaAssetInputSchema.safeParse({
        key: "projects/hero.png",
        buffer: "not-a-buffer",
        contentType: "image/png",
      }).success
    ).toBe(false);
  });
});
