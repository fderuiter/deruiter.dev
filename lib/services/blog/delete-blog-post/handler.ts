import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { EvictBlogCacheHandler } from "../evict-blog-cache/handler";
import type { PersistedBlogPostRecord } from "../shared";
import {
  DeleteBlogPostInputSchema,
  type DeleteBlogPostInput,
  type DeleteBlogPostResult,
  type DeleteBlogPostSpec,
} from "./spec";

export interface DeleteBlogPostPrismaPort {
  findUnique(args: {
    where: { id: string };
  }): Promise<PersistedBlogPostRecord | null>;
  delete(args: { where: { id: string } }): Promise<unknown>;
}

export interface DeleteBlogPostDeps {
  blogPosts?: DeleteBlogPostPrismaPort;
  evictCache?: (slug: string) => Promise<unknown>;
}

export class DeleteBlogPostHandler implements DeleteBlogPostSpec {
  private readonly blogPosts: DeleteBlogPostPrismaPort;
  private readonly evictCache: (slug: string) => Promise<unknown>;

  constructor(deps: DeleteBlogPostDeps = {}) {
    this.blogPosts = deps.blogPosts ?? prisma.blogPost;
    const defaultEvict = new EvictBlogCacheHandler();
    this.evictCache =
      deps.evictCache ?? ((slug) => defaultEvict.execute({ slug }));
  }

  async execute(input: DeleteBlogPostInput): Promise<DeleteBlogPostResult> {
    const parsed = DeleteBlogPostInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_BLOG_POST_ID",
        parsed.error.issues[0]?.message ?? "Blog post ID is required",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    try {
      const existing = await this.blogPosts.findUnique({
        where: { id: parsed.data.id },
      });
      if (!existing) {
        return createFailure("BLOG_POST_NOT_FOUND", "Blog draft not found", {
          recoverable: false,
        });
      }

      await this.blogPosts.delete({ where: { id: parsed.data.id } });
      await this.evictCache(existing.slug);
      return createSuccess(existing);
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to delete blog post",
        { recoverable: true, details: error }
      );
    }
  }
}
