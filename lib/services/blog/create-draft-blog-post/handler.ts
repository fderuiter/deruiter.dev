import { sanitizeContentHtmlLazy } from "@/lib/content-sanitizer-lazy";
import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { EvictBlogPostCacheHandler } from "../evict-blog-post-cache/handler";
import type { EvictBlogPostCacheSpec } from "../evict-blog-post-cache/spec";
import {
  isBlogUniqueViolation,
  type BlogPostDbRecord,
  type ContentPillar,
} from "../shared";
import {
  CreateDraftBlogPostInputSchema,
  type CreateDraftBlogPostInput,
  type CreateDraftBlogPostResult,
  type CreateDraftBlogPostSpec,
} from "./spec";

export interface CreateDraftBlogPostDeps {
  db?: {
    blogPost: {
      create(args: {
        data: {
          title: string;
          slug: string;
          dek: string;
          body: string;
          pillar: ContentPillar;
          tags: string;
          hero_image_url: string | null;
          reading_time_minutes: number;
          published: false;
        };
      }): Promise<BlogPostDbRecord>;
    };
  };
  sanitizeHtml?: (html: string) => Promise<string>;
  evictCacheHandler?: EvictBlogPostCacheSpec;
}

/**
 * Handler for sanitizing HTML lazily via DOMPurify and creating an unpublished blog draft.
 */
export class CreateDraftBlogPostHandler implements CreateDraftBlogPostSpec {
  private readonly db: NonNullable<CreateDraftBlogPostDeps["db"]>;
  private readonly sanitizeHtml: (html: string) => Promise<string>;
  private readonly evictCacheHandler: EvictBlogPostCacheSpec;

  constructor(deps: CreateDraftBlogPostDeps = {}) {
    this.db = deps.db ?? prisma;
    this.sanitizeHtml = deps.sanitizeHtml ?? sanitizeContentHtmlLazy;
    this.evictCacheHandler =
      deps.evictCacheHandler ?? new EvictBlogPostCacheHandler();
  }

  async execute(
    input: CreateDraftBlogPostInput
  ): Promise<CreateDraftBlogPostResult> {
    const parsed = CreateDraftBlogPostInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid blog draft payload",
        { recoverable: true, details: parsed.error }
      );
    }

    const data = parsed.data;
    try {
      const sanitizedBody = await this.sanitizeHtml(data.body);
      const wordCount = sanitizedBody
        .replace(/<[^>]*>/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

      const created = await this.db.blogPost.create({
        data: {
          title: data.title,
          slug: data.slug,
          dek: data.dek,
          body: sanitizedBody,
          pillar: data.pillar,
          tags: data.tags,
          hero_image_url: data.hero_image_url,
          reading_time_minutes: Math.max(1, Math.ceil(wordCount / 200)),
          published: false,
        },
      });

      await this.evictCacheHandler.execute({ slug: data.slug });
      return createSuccess(created);
    } catch (error) {
      if (isBlogUniqueViolation(error)) {
        return createFailure(
          "CONFLICT",
          "A blog post with this slug already exists",
          { recoverable: true, details: error }
        );
      }
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to create blog draft",
        { recoverable: true, details: error }
      );
    }
  }
}
