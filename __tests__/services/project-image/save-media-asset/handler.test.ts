// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  SaveMediaAssetHandler,
  createFailure,
  createSuccess,
  type MediaStorageProvider,
} from "@/lib/services";

describe("SaveMediaAssetHandler (Logic Test)", () => {
  it("persists buffer to active media provider and returns public URL", async () => {
    const provider = fromPartial<MediaStorageProvider>({
      upload: async () =>
        createSuccess({
          key: "projects/hero.png",
          url: "https://blob.example/projects/hero.png",
        }),
    });
    const handler = new SaveMediaAssetHandler({
      resolveProvider: () => createSuccess(provider),
    });

    const result = await handler.execute({
      key: "projects/hero.png",
      buffer: Buffer.from([1, 2, 3]),
      contentType: "image/png",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("https://blob.example/projects/hero.png");
    }
  });

  it("returns STORAGE_UNCONFIGURED when provider resolution fails", async () => {
    const handler = new SaveMediaAssetHandler({
      resolveProvider: () =>
        createFailure("STORAGE_UNCONFIGURED", "Storage backend unconfigured"),
    });

    const result = await handler.execute({
      key: "projects/hero.png",
      buffer: Buffer.from([1, 2, 3]),
      contentType: "image/png",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNCONFIGURED");
    }
  });
});
