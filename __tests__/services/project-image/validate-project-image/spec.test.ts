// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ValidateProjectImageInputSchema } from "@/lib/services";

describe("ValidateProjectImageInputSchema (Contract Test)", () => {
  it("accepts Buffer and mimeType", () => {
    expect(
      ValidateProjectImageInputSchema.safeParse({
        buffer: Buffer.from([0xff, 0xd8, 0xff]),
        mimeType: "image/jpeg",
      }).success
    ).toBe(true);
  });

  it("rejects non-Buffer input", () => {
    expect(
      ValidateProjectImageInputSchema.safeParse({
        buffer: [1, 2, 3],
        mimeType: "image/jpeg",
      }).success
    ).toBe(false);
  });
});
