import { sanitizeContentHtmlLazy } from "@/lib/content-sanitizer-lazy";
import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { EvictCaseStudyCacheHandler } from "../evict-case-study-cache/handler";
import type { EvictCaseStudyCacheSpec } from "../evict-case-study-cache/spec";
import { isUniqueViolation, type CaseStudyDbRowLike } from "../shared";
import {
  SubmitCaseStudyInputSchema,
  type SubmitCaseStudyInput,
  type SubmitCaseStudyResult,
  type SubmitCaseStudySpec,
} from "./spec";

export interface SubmitCaseStudyDeps {
  db?: {
    caseStudy: {
      create(args: {
        data: {
          title: string;
          slug: string;
          primary_language: string;
          editorial_content: string;
          architectural_narrative: string;
          tags: string;
          github_url: string | null;
          published: boolean;
          simulated_telemetry: boolean;
        };
      }): Promise<CaseStudyDbRowLike>;
    };
  };
  sanitizeHtml?: (html: string) => Promise<string>;
  evictCacheHandler?: EvictCaseStudyCacheSpec;
}

/**
 * Handler for sanitizing editorial HTML via lazy DOMPurify and creating an unpublished case study draft.
 */
export class SubmitCaseStudyHandler implements SubmitCaseStudySpec {
  private readonly db: NonNullable<SubmitCaseStudyDeps["db"]>;
  private readonly sanitizeHtml: (html: string) => Promise<string>;
  private readonly evictCacheHandler: EvictCaseStudyCacheSpec;

  constructor(deps: SubmitCaseStudyDeps = {}) {
    this.db = deps.db ?? prisma;
    this.sanitizeHtml = deps.sanitizeHtml ?? sanitizeContentHtmlLazy;
    this.evictCacheHandler =
      deps.evictCacheHandler ?? new EvictCaseStudyCacheHandler();
  }

  async execute(input: SubmitCaseStudyInput): Promise<SubmitCaseStudyResult> {
    const parsed = SubmitCaseStudyInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid case study submission",
        { recoverable: true, details: parsed.error }
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
      const sanitizedEditorial = await this.sanitizeHtml(editorial_content);
      const sanitizedNarrative = await this.sanitizeHtml(
        architectural_narrative
      );

      const created = await this.db.caseStudy.create({
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

      await this.evictCacheHandler.execute({ slug });
      return createSuccess(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        isUniqueViolation(error) ||
        message.includes("Unique constraint failed")
      ) {
        return createFailure(
          "DUPLICATE_SLUG",
          "A case study with this slug already exists",
          { recoverable: true, details: error }
        );
      }

      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Could not persist draft case study",
        { recoverable: true, details: error }
      );
    }
  }
}
