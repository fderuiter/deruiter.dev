import type { ContentPillar } from "@/lib/blog/types";
import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { EvictBlogCacheHandler } from "../evict-blog-cache/handler";
import {
  computeReadingTimeMinutes,
  isBlogUniqueViolation,
  type PersistedBlogPostRecord,
} from "../shared";
import {
  CreateDraftBlogPostInputSchema,
  type CreateDraftBlogPostInput,
  type CreateDraftBlogPostResult,
  type CreateDraftBlogPostSpec,
} from "./spec";

export interface CreateDraftBlogPostPrismaPort {
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
  }): Promise<PersistedBlogPostRecord>;
}

export interface CreateDraftBlogPostDeps {
  blogPosts?: CreateDraftBlogPostPrismaPort;
  evictCache?: (slug: string) => Promise<unknown>;
  sanitizeHtml?: (html: string) => Promise<string>;
}

export class CreateDraftBlogPostHandler implements CreateDraftBlogPostSpec {
  private readonly blogPosts: CreateDraftBlogPostPrismaPort;
  private readonly evictCache: (slug: string) => Promise<unknown>;
  private readonly sanitizeHtml?: (html: string) => Promise<string>;

  constructor(deps: CreateDraftBlogPostDeps = {}) {
    this.blogPosts = deps.blogPosts ?? prisma.blogPost;
    const defaultEvict = new EvictBlogCacheHandler();
    this.evictCache =
      deps.evictCache ?? ((slug) => defaultEvict.execute({ slug }));
    this.sanitizeHtml = deps.sanitizeHtml;
  }

  async execute(
    input: CreateDraftBlogPostInput
  ): Promise<CreateDraftBlogPostResult> {
    const parsed = CreateDraftBlogPostInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_BLOG_DRAFT",
        parsed.error.issues[0]?.message ?? "Invalid blog draft request",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const data = parsed.data;

    try {
      const sanitize =
        this.sanitizeHtml ??
        (await import("@/lib/content-sanitizer-lazy")).sanitizeContentHtmlLazy;
      const sanitizedBody = await sanitize(data.body);

      const created = await this.blogPosts.create({
        data: {
          title: data.title,
          slug: data.slug,
          dek: data.dek,
          body: sanitizedBody,
          pillar: data.pillar,
          tags: data.tags,
          hero_image_url: data.hero_image_url,
          reading_time_minutes: computeReadingTimeMinutes(sanitizedBody),
          published: false,
        },
      });

      await this.evictCache(data.slug);
      return createSuccess(created);
    } catch (error) {
      if (isBlogUniqueViolation(error)) {
        return createFailure(
          "DUPLICATE_BLOG_SLUG",
          "A blog post with this slug already exists",
          { recoverable: false, details: error }
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
