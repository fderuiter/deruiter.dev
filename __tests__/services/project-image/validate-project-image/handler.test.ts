// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ValidateProjectImageHandler } from "@/lib/services";

describe("ValidateProjectImageHandler (Logic Test)", () => {
  const handler = new ValidateProjectImageHandler();

  it("accepts valid PNG magic bytes", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const result = handler.execute({ buffer: png, mimeType: "image/png" });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported MIME types and mismatched headers without throwing", () => {
    const unsupported = handler.execute({
      buffer: Buffer.from("hello"),
      mimeType: "application/pdf",
    });
    expect(unsupported.success).toBe(false);
    if (!unsupported.success) {
      expect(unsupported.error.code).toBe("UNSUPPORTED_TYPE");
    }

    const malformed = handler.execute({
      buffer: Buffer.from("not-a-png-header"),
      mimeType: "image/png",
    });
    expect(malformed.success).toBe(false);
    if (!malformed.success) {
      expect(malformed.error.code).toBe("MALFORMED_HEADER");
    }
  });
});
