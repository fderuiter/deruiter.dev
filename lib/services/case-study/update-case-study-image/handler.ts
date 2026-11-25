import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { EvictCaseStudyCacheHandler } from "../evict-case-study-cache/handler";
import type { EvictCaseStudyCacheSpec } from "../evict-case-study-cache/spec";
import { mapCaseStudyDbRecord, type CaseStudyDbRowLike } from "../shared";
import {
  UpdateCaseStudyImageInputSchema,
  type UpdateCaseStudyImageInput,
  type UpdateCaseStudyImageSliceResult,
  type UpdateCaseStudyImageSpec,
} from "./spec";

export interface UpdateCaseStudyImageDeps {
  db?: {
    caseStudy: {
      findUnique(args: {
        where: { slug: string };
      }): Promise<CaseStudyDbRowLike | null>;
      update(args: {
        where: { slug: string };
        data: { hero_image_url: string | null };
      }): Promise<CaseStudyDbRowLike>;
      create(args: {
        data: {
          slug: string;
          title: string;
          primary_language: string;
          editorial_content: string;
          architectural_narrative: string;
          tags: string;
          github_url?: string;
          published: boolean;
          simulated_telemetry: boolean;
          hero_image_url: string | null;
        };
      }): Promise<CaseStudyDbRowLike>;
    };
  };
  evictCacheHandler?: EvictCaseStudyCacheSpec;
}

/**
 * Handler for persisting a case study hero image URL and evicting its cached representations.
 */
export class UpdateCaseStudyImageHandler implements UpdateCaseStudyImageSpec {
  private readonly db: NonNullable<UpdateCaseStudyImageDeps["db"]>;
  private readonly evictCacheHandler: EvictCaseStudyCacheSpec;

  constructor(deps: UpdateCaseStudyImageDeps = {}) {
    this.db = deps.db ?? prisma;
    this.evictCacheHandler =
      deps.evictCacheHandler ?? new EvictCaseStudyCacheHandler();
  }

  async execute(
    input: UpdateCaseStudyImageInput
  ): Promise<UpdateCaseStudyImageSliceResult> {
    const parsed = UpdateCaseStudyImageInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid case study image input",
        { recoverable: false, details: parsed.error }
      );
    }

    const { slug, heroImageUrl } = parsed.data;
    let updated: CaseStudyDbRowLike;
    try {
      const existing = await this.db.caseStudy.findUnique({
        where: { slug },
      });

      if (existing) {
        updated = await this.db.caseStudy.update({
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
        updated = await this.db.caseStudy.create({
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
      await this.evictCacheHandler.execute({ slug });
    } catch {
      // Cache eviction failure is non-fatal post-commit
    }

    return createSuccess(mapCaseStudyDbRecord(updated, true));
  }
}
