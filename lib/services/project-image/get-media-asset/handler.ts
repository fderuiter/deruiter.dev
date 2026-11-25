import {
  getMediaStorageProvider,
  type MediaStorageProvider,
  type MediaStorageResult,
} from "@/lib/services/media-storage";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { guardMediaProviderCall } from "../shared";
import {
  GetMediaAssetInputSchema,
  type GetMediaAssetInput,
  type GetMediaAssetResult,
  type GetMediaAssetSpec,
} from "./spec";

export interface GetMediaAssetDeps {
  resolveProvider?: () => MediaStorageResult<MediaStorageProvider>;
}

/**
 * Handler for reading a stored media asset by key from the configured provider.
 */
export class GetMediaAssetHandler implements GetMediaAssetSpec {
  private readonly resolveProvider: () => MediaStorageResult<MediaStorageProvider>;

  constructor(deps: GetMediaAssetDeps = {}) {
    this.resolveProvider = deps.resolveProvider ?? getMediaStorageProvider;
  }

  async execute(input: GetMediaAssetInput): Promise<GetMediaAssetResult> {
    const parsed = GetMediaAssetInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid media asset key",
        { recoverable: false, details: parsed.error }
      );
    }

    const { key } = parsed.data;
    try {
      const provider = this.resolveProvider();
      if (!provider.success) return provider;
      const reader = provider.data;
      if (!reader.getAsset) return createSuccess(null);
      return await guardMediaProviderCall(
        "READ_FAILED",
        "Could not read the media asset",
        () => reader.getAsset!(key)
      );
    } catch (error) {
      return createFailure("READ_FAILED", "Could not read the media asset", {
        recoverable: true,
        details: error,
      });
    }
  }
}
