// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { ValidateProjectImageInputSchema } from "@/lib/services";

describe("ValidateProjectImageInputSchema (Contract Test)", () => {
  it("accepts Buffer and mimeType", () => {
    const parsed = ValidateProjectImageInputSchema.safeParse({
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      mimeType: "image/png",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-Buffer payloads", () => {
    const parsed = ValidateProjectImageInputSchema.safeParse({
      buffer: fromAny("plain-string"),
      mimeType: "image/png",
    });
    expect(parsed.success).toBe(false);
  });
});
