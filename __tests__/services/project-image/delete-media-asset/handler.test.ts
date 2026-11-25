// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  DeleteMediaAssetHandler,
  createFailure,
  createSuccess,
  type MediaStorageProvider,
} from "@/lib/services";

describe("DeleteMediaAssetHandler (Logic Test)", () => {
  it("deletes asset through resolved storage provider", async () => {
    const provider = fromPartial<MediaStorageProvider>({
      delete: async () => createSuccess(null),
    });
    const handler = new DeleteMediaAssetHandler({
      resolveProvider: () => createSuccess(provider),
    });

    const result = await handler.execute({ key: "projects/slug-1.png" });
    expect(result.success).toBe(true);
  });

  it("propagates STORAGE_UNCONFIGURED when provider cannot be resolved", async () => {
    const handler = new DeleteMediaAssetHandler({
      resolveProvider: () =>
        createFailure("STORAGE_UNCONFIGURED", "Blob token missing"),
    });

    const result = await handler.execute({ key: "projects/slug-1.png" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("STORAGE_UNCONFIGURED");
    }
  });
});
