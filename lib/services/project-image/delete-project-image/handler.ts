import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { GetCaseStudyBySlugHandler } from "../../case-study/get-case-study-by-slug/handler";
import type { GetCaseStudyBySlugResult } from "../../case-study/get-case-study-by-slug/spec";
import { UpdateCaseStudyImageHandler } from "../../case-study/update-case-study-image/handler";
import type { UpdateCaseStudyImageResult } from "../../case-study/update-case-study-image/spec";
import {
  deleteMediaAsset,
  extractMediaKeyFromUrl,
  type MediaOwnership,
  type MediaStorageResult,
} from "../shared";
import {
  DeleteProjectImageInputSchema,
  type DeleteProjectImageInput,
  type DeleteProjectImageResult,
  type DeleteProjectImageSpec,
} from "./spec";

export interface DeleteProjectImageDeps {
  getCaseStudyBySlug?: (slug: string) => Promise<GetCaseStudyBySlugResult>;
  updateCaseStudyImage?: (
    slug: string,
    heroImageUrl: null
  ) => Promise<UpdateCaseStudyImageResult>;
  deleteAsset?: (key: string) => Promise<MediaStorageResult<null>>;
  ownership?: MediaOwnership;
}

export class DeleteProjectImageHandler implements DeleteProjectImageSpec {
  private readonly getCaseStudyBySlug: (
    slug: string
  ) => Promise<GetCaseStudyBySlugResult>;
  private readonly updateCaseStudyImage: (
    slug: string,
    heroImageUrl: null
  ) => Promise<UpdateCaseStudyImageResult>;
  private readonly deleteAsset: (
    key: string
  ) => Promise<MediaStorageResult<null>>;
  private readonly ownership?: MediaOwnership;

  constructor(deps: DeleteProjectImageDeps = {}) {
    const defaultGet = new GetCaseStudyBySlugHandler();
    this.getCaseStudyBySlug =
      deps.getCaseStudyBySlug ?? ((slug) => defaultGet.execute({ slug }));
    const defaultUpdate = new UpdateCaseStudyImageHandler();
    this.updateCaseStudyImage =
      deps.updateCaseStudyImage ??
      ((slug, heroImageUrl) => defaultUpdate.execute({ slug, heroImageUrl }));
    this.deleteAsset = deps.deleteAsset ?? deleteMediaAsset;
    this.ownership = deps.ownership;
  }

  async execute(
    input: DeleteProjectImageInput
  ): Promise<DeleteProjectImageResult> {
    const parsed = DeleteProjectImageInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_PROJECT_IMAGE_SLUG",
        parsed.error.issues[0]?.message ?? "Project slug parameter is required",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const { slug } = parsed.data;

    let existingLookup: GetCaseStudyBySlugResult;
    try {
      existingLookup = await this.getCaseStudyBySlug(slug);
    } catch (error) {
      return createFailure(
        "CASE_STUDY_LOOKUP_FAILED",
        "Failed to clear project image",
        { recoverable: true, details: error }
      );
    }
    if (!existingLookup.success) {
      return createFailure(
        "CASE_STUDY_LOOKUP_FAILED",
        "Failed to clear project image",
        { recoverable: true, details: existingLookup.error }
      );
    }
    if (!existingLookup.data) {
      return createFailure(
        "CASE_STUDY_NOT_FOUND",
        `Case study with slug "${slug}" not found`,
        { recoverable: false }
      );
    }

    const priorKey = extractMediaKeyFromUrl(
      existingLookup.data.hero_image_url,
      this.ownership
    );

    let cleared: UpdateCaseStudyImageResult;
    try {
      cleared = await this.updateCaseStudyImage(slug, null);
    } catch (error) {
      return createFailure(
        "PERSISTENCE_FAILED",
        "Failed to clear project image",
        { recoverable: true, details: error }
      );
    }

    if (!cleared.success) {
      if (cleared.error.code === "CASE_STUDY_NOT_FOUND") {
        return createFailure("CASE_STUDY_NOT_FOUND", cleared.error.message, {
          recoverable: false,
        });
      }
      return createFailure(
        "PERSISTENCE_FAILED",
        "Failed to clear project image",
        { recoverable: true, details: cleared.error.details }
      );
    }

    if (priorKey) {
      try {
        const cleanup = await this.deleteAsset(priorKey);
        if (!cleanup.success) {
          logger.warn(
            "Project image reference was cleared, but media cleanup failed.",
            cleanup.error.details,
            { slug, code: cleanup.error.code }
          );
        }
      } catch (cleanupErr) {
        logger.warn(
          "Project image reference was cleared, but media cleanup failed.",
          cleanupErr,
          { slug }
        );
      }
    }

    return createSuccess({ slug, hero_image_url: null });
  }
}
