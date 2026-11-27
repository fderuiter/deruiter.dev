// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { ValidateProjectImageHandler } from "@/lib/services";

describe("ValidateProjectImageHandler (Logic Test)", () => {
  const handler = new ValidateProjectImageHandler();

  it("returns success for valid PNG magic bytes", () => {
    const validPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    const result = handler.execute({
      buffer: validPng,
      mimeType: "image/png",
    });
    expect(result.success).toBe(true);
  });

  it("returns typed validation failure for unsupported MIME or malformed input", () => {
    const unsupported = handler.execute({
      buffer: Buffer.from("gif-bytes"),
      mimeType: "image/bmp",
    });
    expect(unsupported.success).toBe(false);
    if (!unsupported.success) {
      expect(unsupported.error.code).toBe("UNSUPPORTED_TYPE");
    }

    const malformed = handler.execute(
      fromAny({ buffer: null, mimeType: "image/png" })
    );
    expect(malformed.success).toBe(false);
    if (!malformed.success) {
      expect(malformed.error.code).toBe("EMPTY_PAYLOAD");
    }
  });
});
