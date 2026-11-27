import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { PersistedBlogPostRecord } from "../shared";
import {
  GetDraftBlogPostInputSchema,
  type GetDraftBlogPostInput,
  type GetDraftBlogPostResult,
  type GetDraftBlogPostSpec,
} from "./spec";

export interface GetDraftBlogPostPrismaPort {
  findFirst(args: {
    where: { id: string; published: false };
  }): Promise<PersistedBlogPostRecord | null>;
}

export interface GetDraftBlogPostDeps {
  blogPosts?: GetDraftBlogPostPrismaPort;
}

export class GetDraftBlogPostHandler implements GetDraftBlogPostSpec {
  private readonly blogPosts: GetDraftBlogPostPrismaPort;

  constructor(deps: GetDraftBlogPostDeps = {}) {
    this.blogPosts = deps.blogPosts ?? prisma.blogPost;
  }

  async execute(input: GetDraftBlogPostInput): Promise<GetDraftBlogPostResult> {
    const parsed = GetDraftBlogPostInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_BLOG_POST_ID",
        parsed.error.issues[0]?.message ?? "Blog draft ID is required",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    try {
      const draft = await this.blogPosts.findFirst({
        where: { id: parsed.data.id, published: false },
      });
      if (!draft) {
        return createFailure("BLOG_POST_NOT_FOUND", "Blog draft not found", {
          recoverable: false,
        });
      }
      return createSuccess(draft);
    } catch (error) {
      return createFailure("STORAGE_UNAVAILABLE", "Failed to load blog draft", {
        recoverable: true,
        details: error,
      });
    }
  }
}
