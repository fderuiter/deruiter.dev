import {
  getMediaStorageProvider,
  type MediaStorageProvider,
  type MediaStorageResult,
} from "@/lib/services/media-storage";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { guardMediaProviderCall } from "../shared";
import {
  SaveMediaAssetInputSchema,
  type SaveMediaAssetInput,
  type SaveMediaAssetResult,
  type SaveMediaAssetSpec,
} from "./spec";

export interface SaveMediaAssetDeps {
  resolveProvider?: () => MediaStorageResult<MediaStorageProvider>;
}

/**
 * Handler for saving a media buffer through the configured media storage provider.
 */
export class SaveMediaAssetHandler implements SaveMediaAssetSpec {
  private readonly resolveProvider: () => MediaStorageResult<MediaStorageProvider>;

  constructor(deps: SaveMediaAssetDeps = {}) {
    this.resolveProvider = deps.resolveProvider ?? getMediaStorageProvider;
  }

  async execute(input: SaveMediaAssetInput): Promise<SaveMediaAssetResult> {
    const parsed = SaveMediaAssetInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid media asset input",
        { recoverable: false, details: parsed.error }
      );
    }

    const { key, buffer, contentType } = parsed.data;
    try {
      const provider = this.resolveProvider();
      if (!provider.success) return provider;
      const uploaded = await guardMediaProviderCall(
        "UPLOAD_FAILED",
        "Could not store the media asset",
        () => provider.data.upload(buffer, key, contentType)
      );
      return uploaded.success ? createSuccess(uploaded.data.url) : uploaded;
    } catch (error) {
      return createFailure("UPLOAD_FAILED", "Could not store the media asset", {
        recoverable: true,
        details: error,
      });
    }
  }
}
