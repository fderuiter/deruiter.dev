import { sanitizeContentHtmlLazy } from "@/lib/content-sanitizer-lazy";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { EvictBlogPostCacheHandler } from "../evict-blog-post-cache/handler";
import type { EvictBlogPostCacheSpec } from "../evict-blog-post-cache/spec";
import { GetBlogPostByIdHandler } from "../get-blog-post-by-id/handler";
import type { GetBlogPostByIdSpec } from "../get-blog-post-by-id/spec";
import { GetDraftBlogPostByIdHandler } from "../get-draft-blog-post-by-id/handler";
import type { GetDraftBlogPostByIdSpec } from "../get-draft-blog-post-by-id/spec";
import {
  isBlogUniqueViolation,
  type BlogPostDbRecord,
  type ContentPillar,
} from "../shared";
import {
  UpdateDraftBlogPostInputSchema,
  type UpdateDraftBlogPostInput,
  type UpdateDraftBlogPostResult,
  type UpdateDraftBlogPostSpec,
} from "./spec";

export interface UpdateDraftBlogPostDeps {
  db?: {
    blogPost: {
      updateManyAndReturn(args: {
        where: { id: string; published?: false };
        data: Record<string, unknown>;
      }): Promise<BlogPostDbRecord[]>;
    };
  };
  getDraftByIdHandler?: GetDraftBlogPostByIdSpec;
  getByIdHandler?: GetBlogPostByIdSpec;
  evictCacheHandler?: EvictBlogPostCacheSpec;
  sanitizeHtml?: (html: string) => Promise<string>;
  queueAnnouncement?: (blogPostId: string) => Promise<void>;
}

/**
 * Handler for updating a blog post or draft, handling draft-to-published transitions and cache invalidation.
 */
export class UpdateDraftBlogPostHandler implements UpdateDraftBlogPostSpec {
  private readonly db: NonNullable<UpdateDraftBlogPostDeps["db"]>;
  private readonly getDraftByIdHandler: GetDraftBlogPostByIdSpec;
  private readonly getByIdHandler: GetBlogPostByIdSpec;
  private readonly evictCacheHandler: EvictBlogPostCacheSpec;
  private readonly sanitizeHtml: (html: string) => Promise<string>;
  private readonly queueAnnouncement?: (blogPostId: string) => Promise<void>;

  constructor(deps: UpdateDraftBlogPostDeps = {}) {
    this.db = deps.db ?? prisma;
    this.getDraftByIdHandler =
      deps.getDraftByIdHandler ?? new GetDraftBlogPostByIdHandler();
    this.getByIdHandler = deps.getByIdHandler ?? new GetBlogPostByIdHandler();
    this.evictCacheHandler =
      deps.evictCacheHandler ?? new EvictBlogPostCacheHandler();
    this.sanitizeHtml = deps.sanitizeHtml ?? sanitizeContentHtmlLazy;
    this.queueAnnouncement = deps.queueAnnouncement;
  }

  async execute(
    input: UpdateDraftBlogPostInput
  ): Promise<UpdateDraftBlogPostResult> {
    const parsed = UpdateDraftBlogPostInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid blog post update input",
        { recoverable: true, details: parsed.error }
      );
    }

    const { id, patch } = parsed.data;

    try {
      let existing: BlogPostDbRecord | null = null;
      const draftRes = await this.getDraftByIdHandler.execute({ id });
      if (draftRes.success) {
        existing = draftRes.data;
      } else if (draftRes.error.code === "STORAGE_UNAVAILABLE") {
        return createFailure("STORAGE_UNAVAILABLE", draftRes.error.message, {
          recoverable: true,
          details: draftRes.error.details,
        });
      } else {
        const anyRes = await this.getByIdHandler.execute({ id });
        if (anyRes.success) {
          existing = anyRes.data;
        } else if (anyRes.error.code === "STORAGE_UNAVAILABLE") {
          return createFailure("STORAGE_UNAVAILABLE", anyRes.error.message, {
            recoverable: true,
            details: anyRes.error.details,
          });
        }
      }

      if (!existing) {
        return createFailure("NOT_FOUND", `Blog post "${id}" not found`, {
          recoverable: false,
        });
      }

      const data: {
        title?: string;
        slug?: string;
        dek?: string;
        body?: string;
        pillar?: ContentPillar;
        tags?: string;
        hero_image_url?: string | null;
        reading_time_minutes?: number;
        published?: boolean;
      } = {};

      if (patch.title !== undefined) data.title = patch.title;
      if (patch.slug !== undefined) data.slug = patch.slug;
      if (patch.dek !== undefined) data.dek = patch.dek;
      if (patch.pillar !== undefined) data.pillar = patch.pillar;
      if (patch.tags !== undefined) data.tags = patch.tags.join(", ");
      if (patch.published !== undefined) data.published = patch.published;
      if (patch.heroImageUrl !== undefined) {
        data.hero_image_url = patch.heroImageUrl;
      }
      if (patch.body !== undefined) {
        const sanitizedBody = await this.sanitizeHtml(patch.body);
        const wordCount = sanitizedBody
          .replace(/<[^>]*>/g, " ")
          .trim()
          .split(/\s+/)
          .filter(Boolean).length;
        data.body = sanitizedBody;
        data.reading_time_minutes = Math.max(1, Math.ceil(wordCount / 200));
      }

      let updated: BlogPostDbRecord | undefined;
      if (!existing.published) {
        const [res] = await this.db.blogPost.updateManyAndReturn({
          where: { id, published: false },
          data,
        });
        updated = res;
      }
      if (!updated) {
        const [res] = await this.db.blogPost.updateManyAndReturn({
          where: { id },
          data,
        });
        updated = res;
      }

      if (!updated) {
        return createFailure("NOT_FOUND", `Blog post "${id}" not found`, {
          recoverable: false,
        });
      }

      if (!existing.published && updated.published) {
        try {
          if (this.queueAnnouncement) {
            await this.queueAnnouncement(updated.id);
          } else {
            const { QueuePostAnnouncementHandler } =
              await import("@/lib/services/newsletter/queue-post-announcement/handler");
            const announcementRes =
              await new QueuePostAnnouncementHandler().execute({
                blogPostId: updated.id,
              });
            if (!announcementRes.success) {
              logger.error(
                "Failed to queue the newsletter announcement:",
                announcementRes.error.details ?? announcementRes.error.message
              );
            }
          }
        } catch (err) {
          logger.error("Failed to queue the newsletter announcement:", err);
        }
      }

      const slugs = new Set([existing.slug, updated.slug]);
      await Promise.all(
        [...slugs].map((slug) => this.evictCacheHandler.execute({ slug }))
      );
      return createSuccess(updated);
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
        `Failed to update blog post "${id}"`,
        { recoverable: true, details: error }
      );
    }
  }
}
