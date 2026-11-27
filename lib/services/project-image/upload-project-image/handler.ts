import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { generateId } from "@/lib/utils";
import { GetCaseStudyBySlugHandler } from "../../case-study/get-case-study-by-slug/handler";
import type { GetCaseStudyBySlugResult } from "../../case-study/get-case-study-by-slug/spec";
import { UpdateCaseStudyImageHandler } from "../../case-study/update-case-study-image/handler";
import type { UpdateCaseStudyImageResult } from "../../case-study/update-case-study-image/spec";
import {
  deleteMediaAsset,
  extractMediaKeyFromUrl,
  getExtensionForMimeType,
  sanitizeSvgLazy,
  saveMediaAsset,
  validateImageMagicBytes,
  validateProjectImage,
  type MediaOwnership,
  type MediaStorageResult,
  type ProjectImageResult,
} from "../shared";
import {
  UploadProjectImageInputSchema,
  type UploadProjectImageInput,
  type UploadProjectImageSpec,
} from "./spec";

export interface UploadProjectImageDeps {
  getCaseStudyBySlug?: (slug: string) => Promise<GetCaseStudyBySlugResult>;
  updateCaseStudyImage?: (
    slug: string,
    heroImageUrl: string | null
  ) => Promise<UpdateCaseStudyImageResult>;
  saveAsset?: (
    key: string,
    buffer: Buffer,
    contentType: string
  ) => Promise<MediaStorageResult<string>>;
  deleteAsset?: (key: string) => Promise<MediaStorageResult<null>>;
  sanitizeSvg?: (svgContent: string) => Promise<string>;
  ownership?: MediaOwnership;
}

export class UploadProjectImageHandler implements UploadProjectImageSpec {
  private readonly getCaseStudyBySlug: (
    slug: string
  ) => Promise<GetCaseStudyBySlugResult>;
  private readonly updateCaseStudyImage: (
    slug: string,
    heroImageUrl: string | null
  ) => Promise<UpdateCaseStudyImageResult>;
  private readonly saveAsset: (
    key: string,
    buffer: Buffer,
    contentType: string
  ) => Promise<MediaStorageResult<string>>;
  private readonly deleteAsset: (
    key: string
  ) => Promise<MediaStorageResult<null>>;
  private readonly sanitizeSvg: (svgContent: string) => Promise<string>;
  private readonly ownership?: MediaOwnership;

  constructor(deps: UploadProjectImageDeps = {}) {
    const defaultGet = new GetCaseStudyBySlugHandler();
    this.getCaseStudyBySlug =
      deps.getCaseStudyBySlug ?? ((slug) => defaultGet.execute({ slug }));
    const defaultUpdate = new UpdateCaseStudyImageHandler();
    this.updateCaseStudyImage =
      deps.updateCaseStudyImage ??
      ((slug, heroImageUrl) => defaultUpdate.execute({ slug, heroImageUrl }));
    this.saveAsset = deps.saveAsset ?? saveMediaAsset;
    this.deleteAsset = deps.deleteAsset ?? deleteMediaAsset;
    this.sanitizeSvg = deps.sanitizeSvg ?? sanitizeSvgLazy;
    this.ownership = deps.ownership;
  }

  async execute(input: UploadProjectImageInput): Promise<ProjectImageResult> {
    const parsed = UploadProjectImageInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "EMPTY_PAYLOAD",
        parsed.error.issues[0]?.message ??
          "Invalid image payload: File is empty or missing.",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const { slug, mimeType } = parsed.data;
    let fileBuffer = parsed.data.fileBuffer;

    const validation = validateProjectImage(fileBuffer, mimeType);
    if (!validation.success) {
      return validation;
    }

    if (mimeType.toLowerCase() === "image/svg+xml") {
      try {
        const sanitized = await this.sanitizeSvg(fileBuffer.toString("utf-8"));
        fileBuffer = Buffer.from(sanitized, "utf-8");
      } catch (error) {
        return createFailure(
          "SANITIZED_SVG_EMPTY",
          "Invalid image payload: Sanitized SVG contains no valid svg element.",
          { recoverable: false, details: error }
        );
      }
      if (!validateImageMagicBytes(fileBuffer, mimeType)) {
        return createFailure(
          "SANITIZED_SVG_EMPTY",
          "Invalid image payload: Sanitized SVG contains no valid svg element.",
          { recoverable: false }
        );
      }
    }

    let existingLookup: GetCaseStudyBySlugResult;
    try {
      existingLookup = await this.getCaseStudyBySlug(slug);
    } catch (error) {
      return createFailure(
        "CASE_STUDY_LOOKUP_FAILED",
        `Could not read case study "${slug}" before replacing its image`,
        { details: error }
      );
    }
    if (!existingLookup.success) {
      return createFailure(
        "CASE_STUDY_LOOKUP_FAILED",
        `Could not read case study "${slug}" before replacing its image`,
        { details: existingLookup.error }
      );
    }

    const existing = existingLookup.data;
    const priorAssetUrl = existing?.hero_image_url ?? null;
    const priorKey = extractMediaKeyFromUrl(priorAssetUrl, this.ownership);

    const ext = getExtensionForMimeType(mimeType);
    const key = `${generateId(`project-${slug}`, { timestamp: true })}.${ext}`;

    let stored: MediaStorageResult<string>;
    try {
      stored = await this.saveAsset(key, fileBuffer, mimeType);
    } catch (error) {
      return createFailure(
        "STORAGE_FAILED",
        "Could not store the project image asset",
        { details: error }
      );
    }
    if (!stored.success) {
      return createFailure(
        "STORAGE_FAILED",
        "Could not store the project image asset",
        { details: stored.error }
      );
    }
    const assetUrl = stored.data;

    let persisted: UpdateCaseStudyImageResult;
    try {
      persisted = await this.updateCaseStudyImage(slug, assetUrl);
    } catch (error) {
      persisted = createFailure(
        "PERSISTENCE_FAILED",
        `Could not persist the hero image for case study "${slug}"`,
        { recoverable: true, details: error }
      );
    }

    if (!persisted.success) {
      try {
        const cleanup = await this.deleteAsset(key);
        if (!cleanup.success) {
          logger.warn(
            "Project image upload rollback could not clean up the new asset.",
            cleanup.error.details,
            { slug, code: cleanup.error.code }
          );
        }
      } catch (cleanupErr) {
        logger.warn(
          "Project image upload rollback could not clean up the new asset.",
          cleanupErr,
          { slug }
        );
      }

      if (existing) {
        try {
          await this.updateCaseStudyImage(slug, priorAssetUrl);
        } catch {
          // Best-effort rollback
        }
      }

      const mappedCode =
        persisted.error.code === "CASE_STUDY_NOT_FOUND"
          ? "CASE_STUDY_NOT_FOUND"
          : "PERSISTENCE_FAILED";
      return createFailure(mappedCode, persisted.error.message, {
        recoverable: persisted.error.recoverable,
        details: persisted.error.details,
      });
    }

    if (priorKey && priorKey !== key) {
      try {
        const cleanup = await this.deleteAsset(priorKey);
        if (!cleanup.success) {
          logger.warn(
            "Project image was replaced, but prior asset cleanup failed.",
            cleanup.error.details,
            { slug, code: cleanup.error.code }
          );
        }
      } catch (cleanupErr) {
        logger.warn(
          "Project image was replaced, but prior asset cleanup failed.",
          cleanupErr,
          { slug }
        );
      }
    }

    return createSuccess({ hero_image_url: assetUrl, key });
  }
}
