import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { EvictBlogPostCacheHandler } from "../evict-blog-post-cache/handler";
import type { EvictBlogPostCacheSpec } from "../evict-blog-post-cache/spec";
import { isPrismaRecordNotFound, type BlogPostDbRecord } from "../shared";
import {
  DeleteBlogPostInputSchema,
  type DeleteBlogPostInput,
  type DeleteBlogPostResult,
  type DeleteBlogPostSpec,
} from "./spec";

export interface DeleteBlogPostDeps {
  db?: {
    blogPost: {
      findUnique(args: {
        where: { id: string };
      }): Promise<BlogPostDbRecord | null>;
      delete(args: { where: { id: string } }): Promise<BlogPostDbRecord>;
    };
  };
  evictCacheHandler?: EvictBlogPostCacheSpec;
}

/**
 * Handler for deleting a blog post or draft by ID and invalidating its Redis and ISR caches.
 */
export class DeleteBlogPostHandler implements DeleteBlogPostSpec {
  private readonly db: NonNullable<DeleteBlogPostDeps["db"]>;
  private readonly evictCacheHandler: EvictBlogPostCacheSpec;

  constructor(deps: DeleteBlogPostDeps = {}) {
    this.db = deps.db ?? prisma;
    this.evictCacheHandler =
      deps.evictCacheHandler ?? new EvictBlogPostCacheHandler();
  }

  async execute(input: DeleteBlogPostInput): Promise<DeleteBlogPostResult> {
    const parsed = DeleteBlogPostInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid blog post ID",
        { recoverable: false, details: parsed.error }
      );
    }

    const { id } = parsed.data;
    try {
      const existing = await this.db.blogPost.findUnique({
        where: { id },
      });
      if (!existing) {
        return createFailure("NOT_FOUND", `Blog post "${id}" not found`, {
          recoverable: false,
        });
      }

      await this.db.blogPost.delete({
        where: { id },
      });

      await this.evictCacheHandler.execute({ slug: existing.slug });
      return createSuccess(existing);
    } catch (error) {
      if (isPrismaRecordNotFound(error)) {
        return createFailure("NOT_FOUND", `Blog post "${id}" not found`, {
          recoverable: false,
          details: error,
        });
      }
      return createFailure(
        "STORAGE_UNAVAILABLE",
        `Failed to delete blog post "${id}"`,
        { recoverable: true, details: error }
      );
    }
  }
}
