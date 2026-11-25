import { logger } from "@/lib/logger";
import { GetCaseStudyBySlugHandler } from "@/lib/services/case-study/get-case-study-by-slug/handler";
import type { GetCaseStudyBySlugSpec } from "@/lib/services/case-study/get-case-study-by-slug/spec";
import { UpdateCaseStudyImageHandler } from "@/lib/services/case-study/update-case-study-image/handler";
import type { UpdateCaseStudyImageSpec } from "@/lib/services/case-study/update-case-study-image/spec";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { generateId } from "@/lib/utils";
import { DeleteMediaAssetHandler } from "../delete-media-asset/handler";
import type { DeleteMediaAssetSpec } from "../delete-media-asset/spec";
import { SaveMediaAssetHandler } from "../save-media-asset/handler";
import type { SaveMediaAssetSpec } from "../save-media-asset/spec";
import {
  extractMediaKeyFromUrl,
  getExtensionForMimeType,
  sanitizeSvg,
  validateImageMagicBytes,
  validateProjectImage,
  type MediaOwnership,
} from "../shared";
import {
  UploadProjectImageInputSchema,
  type UploadProjectImageInput,
  type UploadProjectImageResult,
  type UploadProjectImageSpec,
} from "./spec";

export interface UploadProjectImageDeps {
  getCaseStudyHandler?: GetCaseStudyBySlugSpec;
  updateCaseStudyImageHandler?: UpdateCaseStudyImageSpec;
  saveMediaAssetHandler?: SaveMediaAssetSpec;
  deleteMediaAssetHandler?: DeleteMediaAssetSpec;
  sanitizeSvgFn?: (svg: string) => Promise<string>;
  keyGenerator?: (slug: string, ext: string) => string;
  ownership?: MediaOwnership;
}

/**
 * Handler for validating, sanitizing SVG XML, storing media via the active provider, updating the case study, and cleaning up prior assets.
 * Passes raw error details directly to StructuredLogger so Sentry retains full stack frames.
 */
export class UploadProjectImageHandler implements UploadProjectImageSpec {
  private readonly getCaseStudyHandler: GetCaseStudyBySlugSpec;
  private readonly updateCaseStudyImageHandler: UpdateCaseStudyImageSpec;
  private readonly saveMediaAssetHandler: SaveMediaAssetSpec;
  private readonly deleteMediaAssetHandler: DeleteMediaAssetSpec;
  private readonly sanitizeSvgFn: (svg: string) => Promise<string>;
  private readonly keyGenerator: (slug: string, ext: string) => string;
  private readonly ownership?: MediaOwnership;

  constructor(deps: UploadProjectImageDeps = {}) {
    this.getCaseStudyHandler =
      deps.getCaseStudyHandler ?? new GetCaseStudyBySlugHandler();
    this.updateCaseStudyImageHandler =
      deps.updateCaseStudyImageHandler ?? new UpdateCaseStudyImageHandler();
    this.saveMediaAssetHandler =
      deps.saveMediaAssetHandler ?? new SaveMediaAssetHandler();
    this.deleteMediaAssetHandler =
      deps.deleteMediaAssetHandler ?? new DeleteMediaAssetHandler();
    this.sanitizeSvgFn = deps.sanitizeSvgFn ?? sanitizeSvg;
    this.keyGenerator =
      deps.keyGenerator ??
      ((slug, ext) =>
        `${generateId(`project-${slug}`, { timestamp: true })}.${ext}`);
    this.ownership = deps.ownership;
  }

  async execute(
    input: UploadProjectImageInput
  ): Promise<UploadProjectImageResult> {
    if (!input || !Buffer.isBuffer(input.fileBuffer)) {
      return createFailure(
        "EMPTY_PAYLOAD",
        "Invalid image payload: File is empty or missing."
      );
    }

    const parsed = UploadProjectImageInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid project image upload input",
        { recoverable: false, details: parsed.error }
      );
    }

    const { slug, mimeType } = parsed.data;
    let { fileBuffer } = parsed.data;

    try {
      const validation = validateProjectImage(fileBuffer, mimeType);
      if (!validation.success) {
        return validation;
      }

      if (mimeType.toLowerCase() === "image/svg+xml") {
        const sanitized = await this.sanitizeSvgFn(
          fileBuffer.toString("utf-8")
        );
        fileBuffer = Buffer.from(sanitized, "utf-8");
        if (!validateImageMagicBytes(fileBuffer, mimeType)) {
          return createFailure(
            "SANITIZED_SVG_EMPTY",
            "Invalid image payload: Sanitized SVG contains no valid svg element."
          );
        }
      }

      const lookup = await this.getCaseStudyHandler.execute({
        slug,
        allowFallbackOnError: false,
      });
      if (!lookup.success) {
        return createFailure(
          "CASE_STUDY_LOOKUP_FAILED",
          `Could not read case study "${slug}" before replacing its image`,
          { details: lookup.error.details }
        );
      }

      const existing = lookup.data;
      const priorAssetUrl = existing?.hero_image_url ?? null;
      const priorKey = extractMediaKeyFromUrl(priorAssetUrl, this.ownership);

      const ext = getExtensionForMimeType(mimeType);
      const key = this.keyGenerator(slug, ext);
      const stored = await this.saveMediaAssetHandler.execute({
        key,
        buffer: fileBuffer,
        contentType: mimeType,
      });
      if (!stored.success) {
        return createFailure(
          "STORAGE_FAILED",
          "Could not store the project image asset",
          { details: stored.error }
        );
      }
      const assetUrl = stored.data;

      const persisted = await this.updateCaseStudyImageHandler.execute({
        slug,
        heroImageUrl: assetUrl,
      });
      if (!persisted.success) {
        const cleanup = await this.deleteMediaAssetHandler.execute({ key });
        if (!cleanup.success) {
          logger.warn(
            "Project image upload rollback could not clean up the new asset.",
            cleanup.error.details,
            { slug, code: cleanup.error.code }
          );
        }
        if (existing) {
          await this.updateCaseStudyImageHandler.execute({
            slug,
            heroImageUrl: priorAssetUrl,
          });
        }
        return persisted;
      }

      if (priorKey && priorKey !== key) {
        const cleanup = await this.deleteMediaAssetHandler.execute({
          key: priorKey,
        });
        if (!cleanup.success) {
          logger.warn(
            "Project image was replaced, but prior asset cleanup failed.",
            cleanup.error.details,
            { slug, code: cleanup.error.code }
          );
        }
      }

      return createSuccess({ hero_image_url: assetUrl, key });
    } catch (error) {
      return createFailure(
        "STORAGE_FAILED",
        "Unexpected error during project image upload",
        { recoverable: true, details: error }
      );
    }
  }
}
