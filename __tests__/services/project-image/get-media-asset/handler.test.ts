// @vitest-environment node
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import type { MediaStorageProvider } from "@/lib/services/media-storage";
import { GetMediaAssetHandler, createSuccess } from "@/lib/services";

describe("GetMediaAssetHandler (Logic Test)", () => {
  it("reads asset record from resolved media storage provider", async () => {
    const record = {
      buffer: Buffer.from("image-bytes"),
      contentType: "image/png",
    };
    const provider = fromPartial<MediaStorageProvider>({
      getAsset: vi.fn().mockResolvedValue(createSuccess(record)),
    });
    const handler = new GetMediaAssetHandler({
      resolveProvider: () => createSuccess(provider),
    });

    const result = await handler.execute({ key: "projects/demo/hero.png" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.contentType).toBe("image/png");
    }
  });

  it("returns INVALID_MEDIA_KEY or READ_FAILED when provider rejects", async () => {
    const invalidHandler = new GetMediaAssetHandler();
    const invalid = await invalidHandler.execute({ key: "   " });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.code).toBe("INVALID_MEDIA_KEY");
    }

    const throwingProvider = fromPartial<MediaStorageProvider>({
      getAsset: vi.fn().mockRejectedValue(new Error("disk read failure")),
    });
    const failingHandler = new GetMediaAssetHandler({
      resolveProvider: () => createSuccess(throwingProvider),
    });
    const failed = await failingHandler.execute({
      key: "projects/demo/hero.png",
    });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error.code).toBe("READ_FAILED");
      expect(failed.error.recoverable).toBe(true);
    }
  });
});
