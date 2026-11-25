import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { BlogPostDbRecord } from "../shared";
import {
  GetDraftBlogPostsInputSchema,
  type GetDraftBlogPostsInput,
  type GetDraftBlogPostsResult,
  type GetDraftBlogPostsSpec,
} from "./spec";

export interface GetDraftBlogPostsDeps {
  db?: {
    blogPost: {
      findMany(args: {
        where: { published: false };
        orderBy: Array<{ updated_at?: "asc" | "desc"; id?: "asc" | "desc" }>;
        skip: number;
        take: number;
      }): Promise<BlogPostDbRecord[]>;
      count(args: { where: { published: false } }): Promise<number>;
    };
  };
}

/**
 * Handler for retrieving paginated unpublished blog drafts from PostgreSQL.
 */
export class GetDraftBlogPostsHandler implements GetDraftBlogPostsSpec {
  private readonly db: NonNullable<GetDraftBlogPostsDeps["db"]>;

  constructor(deps: GetDraftBlogPostsDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: GetDraftBlogPostsInput
  ): Promise<GetDraftBlogPostsResult> {
    const parsed = GetDraftBlogPostsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid pagination parameters",
        { recoverable: false, details: parsed.error }
      );
    }

    const { page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    try {
      const [drafts, total] = await Promise.all([
        this.db.blogPost.findMany({
          where: { published: false },
          orderBy: [{ updated_at: "desc" }, { id: "asc" }],
          skip,
          take: pageSize,
        }),
        this.db.blogPost.count({ where: { published: false } }),
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
