import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { PersistedBlogPostRecord } from "../shared";
import {
  ListDraftBlogPostsInputSchema,
  type ListDraftBlogPostsInput,
  type ListDraftBlogPostsResult,
  type ListDraftBlogPostsSpec,
} from "./spec";

export interface ListDraftBlogPostsPrismaPort {
  findMany(args: {
    where: { published: false };
    orderBy: [{ updated_at: "desc" }, { id: "asc" }];
    skip: number;
    take: number;
  }): Promise<PersistedBlogPostRecord[]>;
  count(args: { where: { published: false } }): Promise<number>;
}

export interface ListDraftBlogPostsDeps {
  blogPosts?: ListDraftBlogPostsPrismaPort;
}

export class ListDraftBlogPostsHandler implements ListDraftBlogPostsSpec {
  private readonly blogPosts: ListDraftBlogPostsPrismaPort;

  constructor(deps: ListDraftBlogPostsDeps = {}) {
    this.blogPosts = deps.blogPosts ?? prisma.blogPost;
  }

  async execute(
    input: ListDraftBlogPostsInput
  ): Promise<ListDraftBlogPostsResult> {
    const parsed = ListDraftBlogPostsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_PAGINATION",
        parsed.error.issues[0]?.message ?? "Invalid pagination parameters",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    const { page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    try {
      const [drafts, total] = await Promise.all([
        this.blogPosts.findMany({
          where: { published: false },
          orderBy: [{ updated_at: "desc" }, { id: "asc" }],
          skip,
          take: pageSize,
        }),
        this.blogPosts.count({ where: { published: false } }),
      ]);

      return createSuccess({ drafts, total });
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to load blog drafts",
        { recoverable: true, details: error }
      );
    }
  }
}
