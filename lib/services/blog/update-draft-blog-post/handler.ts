import type { ContentPillar } from "@/lib/blog/types";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { QueuePostAnnouncementHandler } from "../../newsletter/queue-post-announcement/handler";
import { EvictBlogCacheHandler } from "../evict-blog-cache/handler";
import {
  computeReadingTimeMinutes,
  isBlogUniqueViolation,
  type PersistedBlogPostRecord,
} from "../shared";
import {
  UpdateDraftBlogPostInputSchema,
  type UpdateDraftBlogPostInput,
  type UpdateDraftBlogPostResult,
  type UpdateDraftBlogPostSpec,
} from "./spec";

export interface UpdateDraftBlogPostPrismaPort {
  findFirst(args: {
    where: { id: string; published: false };
  }): Promise<PersistedBlogPostRecord | null>;
  findUnique(args: {
    where: { id: string };
  }): Promise<PersistedBlogPostRecord | null>;
  updateManyAndReturn(args: {
    where: { id: string; published?: false };
    data: {
      title?: string;
      slug?: string;
      dek?: string;
      body?: string;
      pillar?: ContentPillar;
      tags?: string;
      hero_image_url?: string | null;
      reading_time_minutes?: number;
      published?: boolean;
    };
  }): Promise<PersistedBlogPostRecord[]>;
}

export interface UpdateDraftBlogPostDeps {
  blogPosts?: UpdateDraftBlogPostPrismaPort;
  evictCache?: (slug: string) => Promise<unknown>;
  queuePostAnnouncement?: (blogPostId: string) => Promise<unknown>;
  sanitizeHtml?: (html: string) => Promise<string>;
}

export class UpdateDraftBlogPostHandler implements UpdateDraftBlogPostSpec {
  private readonly blogPosts: UpdateDraftBlogPostPrismaPort;
  private readonly evictCache: (slug: string) => Promise<unknown>;
  private readonly queuePostAnnouncement: (
    blogPostId: string
  ) => Promise<unknown>;
  private readonly sanitizeHtml?: (html: string) => Promise<string>;

  constructor(deps: UpdateDraftBlogPostDeps = {}) {
    this.blogPosts = deps.blogPosts ?? prisma.blogPost;
    const defaultEvict = new EvictBlogCacheHandler();
    this.evictCache =
      deps.evictCache ?? ((slug) => defaultEvict.execute({ slug }));
    const defaultQueueAnnouncement = new QueuePostAnnouncementHandler();
    this.queuePostAnnouncement =
      deps.queuePostAnnouncement ??
      (async (blogPostId) => {
        try {
          const res = await defaultQueueAnnouncement.execute({ blogPostId });
          if (!res.success) {
            logger.error(
              "Failed to queue the newsletter announcement:",
              res.error.details ?? res.error.message
            );
          }
          return res;
        } catch (err) {
          logger.error("Failed to queue the newsletter announcement:", err);
          return null;
        }
      });
    this.sanitizeHtml = deps.sanitizeHtml;
  }

  async execute(
    input: UpdateDraftBlogPostInput
  ): Promise<UpdateDraftBlogPostResult> {
    if (
      input?.updates &&
      typeof input.updates === "object" &&
      Object.values(input.updates).every((value) => value === undefined)
    ) {
      return createFailure(
        "EMPTY_DRAFT_UPDATE",
        "At least one blog draft field must be provided",
        { recoverable: false }
      );
    }

    const parsed = UpdateDraftBlogPostInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_BLOG_DRAFT_UPDATE",
        parsed.error.issues[0]?.message ?? "Invalid blog draft update",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const { id, updates } = parsed.data;

    try {
      let existing = await this.blogPosts.findFirst({
        where: { id, published: false },
      });
      if (!existing) {
        existing = await this.blogPosts.findUnique({ where: { id } });
      }
      if (!existing) {
        return createFailure("BLOG_POST_NOT_FOUND", "Blog draft not found", {
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

      if (updates.title !== undefined) data.title = updates.title;
      if (updates.slug !== undefined) data.slug = updates.slug;
      if (updates.dek !== undefined) data.dek = updates.dek;
      if (updates.pillar !== undefined) data.pillar = updates.pillar;
      if (updates.tags !== undefined) data.tags = updates.tags.join(", ");
      if (updates.published !== undefined) data.published = updates.published;
      if (updates.heroImageUrl !== undefined) {
        data.hero_image_url = updates.heroImageUrl;
      }
      if (updates.body !== undefined) {
        const sanitize =
          this.sanitizeHtml ??
          (await import("@/lib/content-sanitizer-lazy"))
            .sanitizeContentHtmlLazy;
        const sanitizedBody = await sanitize(updates.body);
        data.body = sanitizedBody;
        data.reading_time_minutes = computeReadingTimeMinutes(sanitizedBody);
      }

      let updated: PersistedBlogPostRecord | undefined;
      if (!existing.published) {
        const [res] = await this.blogPosts.updateManyAndReturn({
          where: { id, published: false },
          data,
        });
        updated = res;
      }
      if (!updated) {
        const [res] = await this.blogPosts.updateManyAndReturn({
          where: { id },
          data,
        });
        updated = res;
      }

      if (!updated) {
        return createFailure("BLOG_POST_NOT_FOUND", "Blog draft not found", {
          recoverable: false,
        });
      }

      if (!existing.published && updated.published) {
        try {
          await this.queuePostAnnouncement(updated.id);
        } catch (err) {
          logger.error("Failed to queue the newsletter announcement:", err);
        }
      }

      const slugs = new Set([existing.slug, updated.slug]);
      await Promise.all([...slugs].map((slug) => this.evictCache(slug)));

      return createSuccess(updated);
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
        "Failed to update blog draft",
        { recoverable: true, details: error }
      );
    }
  }
}
