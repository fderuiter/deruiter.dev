import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { EvictCaseStudyCacheHandler } from "../evict-case-study-cache/handler";
import {
  mapCaseStudyRecordToData,
  type RawCaseStudyRecord,
  type UpdateCaseStudyImageResult,
} from "../shared";
import {
  UpdateCaseStudyImageInputSchema,
  type UpdateCaseStudyImageInput,
  type UpdateCaseStudyImageSpec,
} from "./spec";

export interface UpdateCaseStudyImagePrismaPort {
  findUnique(args: {
    where: { slug: string };
  }): Promise<RawCaseStudyRecord | null>;
  update(args: {
    where: { slug: string };
    data: { hero_image_url: string | null };
  }): Promise<RawCaseStudyRecord>;
  create(args: {
    data: {
      slug: string;
      title: string;
      primary_language: string;
      editorial_content: string;
      architectural_narrative: string;
      tags: string;
      github_url: string;
      published: true;
      simulated_telemetry: boolean;
      hero_image_url: string | null;
    };
  }): Promise<RawCaseStudyRecord>;
}

export interface UpdateCaseStudyImageDeps {
  caseStudies?: UpdateCaseStudyImagePrismaPort;
  evictCache?: (slug: string) => Promise<unknown>;
}

export class UpdateCaseStudyImageHandler implements UpdateCaseStudyImageSpec {
  private readonly caseStudies: UpdateCaseStudyImagePrismaPort;
  private readonly evictCache: (slug: string) => Promise<unknown>;

  constructor(deps: UpdateCaseStudyImageDeps = {}) {
    this.caseStudies = deps.caseStudies ?? prisma.caseStudy;
    const defaultEvict = new EvictCaseStudyCacheHandler();
    this.evictCache =
      deps.evictCache ?? ((slug) => defaultEvict.execute({ slug }));
  }

  async execute(
    input: UpdateCaseStudyImageInput
  ): Promise<UpdateCaseStudyImageResult> {
    const parsed = UpdateCaseStudyImageInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_CASE_STUDY_IMAGE_INPUT",
        parsed.error.issues[0]?.message ?? "Slug is required",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const { slug, heroImageUrl } = parsed.data;
    let updated: RawCaseStudyRecord;

    try {
      const existing = await this.caseStudies.findUnique({
        where: { slug },
      });

      if (existing) {
        updated = await this.caseStudies.update({
          where: { slug },
          data: { hero_image_url: heroImageUrl },
        });
      } else {
        const fallback = FALLBACK_CASE_STUDIES.find((f) => f.slug === slug);
        if (!fallback) {
          return createFailure(
            "CASE_STUDY_NOT_FOUND",
            `Case study with slug "${slug}" not found`,
            { recoverable: false }
          );
        }
        updated = await this.caseStudies.create({
          data: {
            slug: fallback.slug,
            title: fallback.title,
            primary_language: fallback.primary_language,
            editorial_content: fallback.editorial_content,
            architectural_narrative: fallback.architectural_narrative,
            tags: fallback.tags,
            github_url: fallback.github_url,
            published: true,
            simulated_telemetry: fallback.simulated_telemetry,
            hero_image_url: heroImageUrl,
          },
        });
      }
    } catch (error) {
      return createFailure(
        "PERSISTENCE_FAILED",
        `Could not persist the hero image for case study "${slug}"`,
        { recoverable: true, details: error }
      );
    }

    try {
      await this.evictCache(slug);
    } catch {
      // Cache eviction failures are non-fatal once image persistence succeeds
    }

    return createSuccess(
      mapCaseStudyRecordToData(updated, { preserveNullHeroImage: true })
    );
  }
}
