import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { EvictCaseStudyCacheHandler } from "../evict-case-study-cache/handler";
import { isPrismaUniqueViolation, type RawCaseStudyRecord } from "../shared";
import {
  CreateCaseStudyDraftInputSchema,
  type CreateCaseStudyDraftInput,
  type CreateCaseStudyDraftResult,
  type CreateCaseStudyDraftSpec,
} from "./spec";

export interface CreateCaseStudyDraftPrismaPort {
  create(args: {
    data: {
      title: string;
      slug: string;
      primary_language: string;
      editorial_content: string;
      architectural_narrative: string;
      tags: string;
      github_url: string | null;
      published: false;
      simulated_telemetry: false;
    };
  }): Promise<RawCaseStudyRecord>;
}

export interface CreateCaseStudyDraftDeps {
  caseStudies?: CreateCaseStudyDraftPrismaPort;
  evictCache?: (slug: string) => Promise<unknown>;
  sanitizeHtml?: (html: string) => Promise<string>;
}

export class CreateCaseStudyDraftHandler implements CreateCaseStudyDraftSpec {
  private readonly caseStudies: CreateCaseStudyDraftPrismaPort;
  private readonly evictCache: (slug: string) => Promise<unknown>;
  private readonly sanitizeHtml?: (html: string) => Promise<string>;

  constructor(deps: CreateCaseStudyDraftDeps = {}) {
    this.caseStudies = deps.caseStudies ?? prisma.caseStudy;
    const defaultEvict = new EvictCaseStudyCacheHandler();
    this.evictCache =
      deps.evictCache ?? ((slug) => defaultEvict.execute({ slug }));
    this.sanitizeHtml = deps.sanitizeHtml;
  }

  async execute(
    input: CreateCaseStudyDraftInput
  ): Promise<CreateCaseStudyDraftResult> {
    const parsed = CreateCaseStudyDraftInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_CASE_STUDY_DRAFT",
        parsed.error.issues[0]?.message ?? "Invalid case study draft payload",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const {
      title,
      slug,
      primary_language,
      editorial_content,
      architectural_narrative,
      tags,
      github_url,
    } = parsed.data;

    try {
      const sanitize =
        this.sanitizeHtml ??
        (await import("@/lib/content-sanitizer-lazy")).sanitizeContentHtmlLazy;
      const sanitizedEditorial = await sanitize(editorial_content);
      const sanitizedNarrative = await sanitize(architectural_narrative);

      const created = await this.caseStudies.create({
        data: {
          title,
          slug,
          primary_language,
          editorial_content: sanitizedEditorial,
          architectural_narrative: sanitizedNarrative,
          tags,
          github_url: github_url || null,
          published: false,
          simulated_telemetry: false,
        },
      });

      await this.evictCache(slug);
      return createSuccess(created);
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        return createFailure(
          "DUPLICATE_CASE_STUDY_SLUG",
          `A case study with slug "${slug}" already exists`,
          { recoverable: false, details: error }
        );
      }
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Case study persistence is temporarily unavailable",
        { recoverable: true, details: error }
      );
    }
  }
}
