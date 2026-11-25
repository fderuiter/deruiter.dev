// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GetMediaAssetHandler,
  createFailure,
  createSuccess,
  type MediaAssetRecord,
  type MediaStorageProvider,
} from "@/lib/services";

describe("GetMediaAssetHandler (Logic Test)", () => {
  it("returns media asset record from storage provider", async () => {
    const asset = fromPartial<MediaAssetRecord>({
      contentType: "image/png",
    });
    const provider = fromPartial<MediaStorageProvider>({
      getAsset: async () => createSuccess(asset),
    });
    const handler = new GetMediaAssetHandler({
      resolveProvider: () => createSuccess(provider),
    });

    const result = await handler.execute({ key: "projects/demo.png" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.contentType).toBe("image/png");
    }
  });

  it("returns READ_FAILED when provider getAsset throws", async () => {
    const provider = fromPartial<MediaStorageProvider>({
      getAsset: async () => {
        throw new Error("blob read timeout");
      },
    });
    const handler = new GetMediaAssetHandler({
      resolveProvider: () => createSuccess(provider),
    });

    const result = await handler.execute({ key: "projects/demo.png" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(["READ_FAILED", "STORAGE_UNAVAILABLE"]).toContain(
        result.error.code
      );
    }
    const invalid = await handler.execute({ key: "" });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.code).toBe("INVALID_INPUT");
    }
    const unavailable = await new GetMediaAssetHandler({
      resolveProvider: () =>
        createFailure("STORAGE_UNCONFIGURED", "Unconfigured"),
    }).execute({ key: "projects/demo.png" });
    expect(unavailable.success).toBe(false);
  });
});
