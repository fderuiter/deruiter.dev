import {
  getMediaStorageProvider,
  type MediaStorageProvider,
  type MediaStorageResult,
} from "@/lib/services/media-storage";
import { createFailure } from "@/lib/services/service-result";
import { guardMediaProviderCall } from "../shared";
import {
  DeleteMediaAssetInputSchema,
  type DeleteMediaAssetInput,
  type DeleteMediaAssetResult,
  type DeleteMediaAssetSpec,
} from "./spec";

export interface DeleteMediaAssetDeps {
  resolveProvider?: () => MediaStorageResult<MediaStorageProvider>;
}

/**
 * Handler for deleting a stored media asset by key from the configured provider.
 */
export class DeleteMediaAssetHandler implements DeleteMediaAssetSpec {
  private readonly resolveProvider: () => MediaStorageResult<MediaStorageProvider>;

  constructor(deps: DeleteMediaAssetDeps = {}) {
    this.resolveProvider = deps.resolveProvider ?? getMediaStorageProvider;
  }

  async execute(input: DeleteMediaAssetInput): Promise<DeleteMediaAssetResult> {
    const parsed = DeleteMediaAssetInputSchema.safeParse(input);
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
      return await guardMediaProviderCall(
        "DELETE_FAILED",
        "Could not delete the media asset",
        () => provider.data.delete(key)
      );
    } catch (error) {
      return createFailure(
        "DELETE_FAILED",
        "Could not delete the media asset",
        { recoverable: true, details: error }
      );
    }
  }
}
