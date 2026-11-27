import {
  getMediaStorageProvider,
  type MediaStorageProvider,
} from "@/lib/services/media-storage";
import {
  createFailure,
  createSuccess,
  type ServiceResult,
} from "@/lib/services/service-result";
import { guardMediaProviderCall, type MediaStorageErrorCode } from "../shared";
import {
  GetMediaAssetInputSchema,
  type GetMediaAssetInput,
  type GetMediaAssetResult,
  type GetMediaAssetSpec,
} from "./spec";

export interface GetMediaAssetDeps {
  resolveProvider?: () => ServiceResult<
    MediaStorageProvider,
    MediaStorageErrorCode
  >;
}

export class GetMediaAssetHandler implements GetMediaAssetSpec {
  private readonly resolveProvider: () => ServiceResult<
    MediaStorageProvider,
    MediaStorageErrorCode
  >;

  constructor(deps: GetMediaAssetDeps = {}) {
    this.resolveProvider = deps.resolveProvider ?? getMediaStorageProvider;
  }

  async execute(input: GetMediaAssetInput): Promise<GetMediaAssetResult> {
    const parsed = GetMediaAssetInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_MEDIA_KEY",
        parsed.error.issues[0]?.message ?? "Media asset key is required",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const provider = this.resolveProvider();
    if (!provider.success) return provider;
    const reader = provider.data;
    if (!reader.getAsset) return createSuccess(null);

    return guardMediaProviderCall(
      "READ_FAILED",
      "Could not read the media asset",
      () => reader.getAsset!(parsed.data.key)
    );
  }
}
