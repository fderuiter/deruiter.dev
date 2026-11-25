import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { prisma } from "@/lib/db";
import { env, isBuildPhase } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { BlogPostDbRecord } from "../shared";
import {
  GetAllBlogPostsAdminInputSchema,
  type GetAllBlogPostsAdminInput,
  type GetAllBlogPostsAdminResult,
  type GetAllBlogPostsAdminSpec,
} from "./spec";

export interface GetAllBlogPostsAdminDeps {
  db?: {
    blogPost: {
      findMany(args: {
        orderBy: Array<{ updated_at?: "asc" | "desc"; id?: "asc" | "desc" }>;
      }): Promise<BlogPostDbRecord[]>;
    };
  };
}

/**
 * Handler for retrieving all persisted blog posts ordered by update timestamp.
 * Surfaces `STORAGE_UNAVAILABLE` on Prisma outages instead of returning a silent empty list.
 */
export class GetAllBlogPostsAdminHandler implements GetAllBlogPostsAdminSpec {
  private readonly db: NonNullable<GetAllBlogPostsAdminDeps["db"]>;

  constructor(deps: GetAllBlogPostsAdminDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: GetAllBlogPostsAdminInput = {}
  ): Promise<GetAllBlogPostsAdminResult> {
    const parsed = GetAllBlogPostsAdminInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid admin blog list input", {
        recoverable: false,
        details: parsed.error,
      });
    }

    try {
      const posts = await this.db.blogPost.findMany({
        orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      });
      return createSuccess(posts);
    } catch (err) {
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.warn(
          "BlogPostService.getAllBlogPostsAdmin: Database query failed:",
          err
        );
      }
      failBuildOnDataSourceError("BlogPostService.getAllBlogPostsAdmin", err);
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Failed to load administrative blog posts",
        { recoverable: true, details: err }
      );
    }
  }
}
