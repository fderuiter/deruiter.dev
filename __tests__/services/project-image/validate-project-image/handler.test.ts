// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  MAX_PROJECT_IMAGE_SIZE_BYTES,
  ValidateProjectImageHandler,
  blobStoreIdFromToken,
  createSuccess,
  extractMediaKeyFromUrl,
  getExtensionForMimeType,
  guardMediaProviderCall,
  sanitizeSvg,
  validateImageMagicBytes,
} from "@/lib/services";

describe("ValidateProjectImageHandler (Logic Test)", () => {
  const handler = new ValidateProjectImageHandler();

  it("accepts valid magic bytes across supported image formats", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(
      handler.execute({ buffer: png, mimeType: "image/png" }).success
    ).toBe(true);

    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateImageMagicBytes(jpg, "image/jpeg")).toBe(true);

    const gif = Buffer.from("GIF89a1234", "ascii");
    expect(validateImageMagicBytes(gif, "image/gif")).toBe(true);

    const webp = Buffer.from("RIFF0000WEBP", "ascii");
    expect(validateImageMagicBytes(webp, "image/webp")).toBe(true);

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(validateImageMagicBytes(svg, "image/svg+xml")).toBe(true);

    const avif = Buffer.from("0000ftypavif0000", "ascii");
    expect(validateImageMagicBytes(avif, "image/avif")).toBe(true);
    expect(validateImageMagicBytes(Buffer.alloc(0), "image/png")).toBe(false);
  });

  it("rejects empty, oversized, unsupported, and malformed image payloads", () => {
    const empty = handler.execute({
      buffer: Buffer.alloc(0),
      mimeType: "image/png",
    });
    expect(empty.success).toBe(false);

    const huge = handler.execute({
      buffer: Buffer.alloc(MAX_PROJECT_IMAGE_SIZE_BYTES + 1),
      mimeType: "image/png",
    });
    expect(huge.success).toBe(false);

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

  it("covers extension mapping, SVG sanitization, blob ownership URL parsing, and provider error guard", async () => {
    expect(getExtensionForMimeType("image/jpeg")).toBe("jpg");
    expect(getExtensionForMimeType("image/png")).toBe("png");
    expect(getExtensionForMimeType("image/webp")).toBe("webp");
    expect(getExtensionForMimeType("image/gif")).toBe("gif");
    expect(getExtensionForMimeType("image/svg+xml")).toBe("svg");
    expect(getExtensionForMimeType("image/avif")).toBe("avif");
    expect(getExtensionForMimeType("application/octet-stream")).toBe("bin");

    const cleanedSvg = await sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" onload="evil()"/></svg>'
    );
    expect(cleanedSvg).toContain("<svg");
    expect(cleanedSvg).not.toContain("onload");

    expect(blobStoreIdFromToken(null)).toBeNull();
    expect(blobStoreIdFromToken("invalid_token")).toBeNull();
    expect(blobStoreIdFromToken("vercel_blob_rw_abc123_secret")).toBe("abc123");

    const ownership = {
      siteOrigin: "https://deruiter.dev",
      blobStoreId: "abc123",
    };
    expect(extractMediaKeyFromUrl("", ownership)).toBeNull();
    expect(extractMediaKeyFromUrl("/api/media/hero.png", ownership)).toBe(
      "hero.png"
    );
    expect(
      extractMediaKeyFromUrl("/api/media/nested/path", ownership)
    ).toBeNull();
    expect(extractMediaKeyFromUrl("/other-path", ownership)).toBeNull();
    expect(extractMediaKeyFromUrl("bare-asset-key", ownership)).toBe(
      "bare-asset-key"
    );
    expect(
      extractMediaKeyFromUrl(
        "https://deruiter.dev/api/media/hero.png",
        ownership
      )
    ).toBe("hero.png");
    expect(
      extractMediaKeyFromUrl(
        "https://other.example/api/media/hero.png",
        ownership
      )
    ).toBeNull();
    expect(
      extractMediaKeyFromUrl(
        "https://abc123.public.blob.vercel-storage.com/hero.png",
        ownership
      )
    ).toBe("https://abc123.public.blob.vercel-storage.com/hero.png");

    const okGuard = await guardMediaProviderCall(
      "READ_FAILED",
      "Read failed",
      async () => createSuccess("ok")
    );
    expect(okGuard.success).toBe(true);

    const errGuard = await guardMediaProviderCall(
      "READ_FAILED",
      "Read failed",
      async () => {
        throw new Error("Provider timeout");
      }
    );
    expect(errGuard.success).toBe(false);
  });
});
