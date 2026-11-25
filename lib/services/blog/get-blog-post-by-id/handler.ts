import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { BlogPostDbRecord } from "../shared";
import {
  GetBlogPostByIdInputSchema,
  type GetBlogPostByIdInput,
  type GetBlogPostByIdResult,
  type GetBlogPostByIdSpec,
} from "./spec";

export interface GetBlogPostByIdDeps {
  db?: {
    blogPost: {
      findUnique(args: {
        where: { id: string };
      }): Promise<BlogPostDbRecord | null>;
    };
  };
}

/**
 * Handler for retrieving a persisted blog post by ID.
 * Distinguishes `NOT_FOUND` (HTTP 404) from `STORAGE_UNAVAILABLE` (HTTP 503) so database outages never look like missing posts.
 */
export class GetBlogPostByIdHandler implements GetBlogPostByIdSpec {
  private readonly db: NonNullable<GetBlogPostByIdDeps["db"]>;

  constructor(deps: GetBlogPostByIdDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(input: GetBlogPostByIdInput): Promise<GetBlogPostByIdResult> {
    const parsed = GetBlogPostByIdInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid blog post ID",
        { recoverable: false, details: parsed.error }
      );
    }

    const { id } = parsed.data;
    try {
      const post = await this.db.blogPost.findUnique({
        where: { id },
      });
      if (!post) {
        return createFailure("NOT_FOUND", `Blog post "${id}" not found`, {
          recoverable: false,
        });
      }
      return createSuccess(post);
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          `BlogPostService.getBlogPostById: Database query failed for ID "${id}":`,
          err
        );
      }
      failBuildOnDataSourceError("BlogPostService.getBlogPostById", err);
      return createFailure(
        "STORAGE_UNAVAILABLE",
        `Failed to load blog post "${id}"`,
        { recoverable: true, details: err }
      );
    }
  }
}
