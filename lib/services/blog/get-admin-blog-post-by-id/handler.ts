import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { PersistedBlogPostRecord } from "../shared";
import {
  GetAdminBlogPostByIdInputSchema,
  type GetAdminBlogPostByIdInput,
  type GetAdminBlogPostByIdResult,
  type GetAdminBlogPostByIdSpec,
} from "./spec";

export interface GetAdminBlogPostByIdPrismaPort {
  findUnique(args: {
    where: { id: string };
  }): Promise<PersistedBlogPostRecord | null>;
}

export interface GetAdminBlogPostByIdDeps {
  blogPosts?: GetAdminBlogPostByIdPrismaPort;
}

export class GetAdminBlogPostByIdHandler implements GetAdminBlogPostByIdSpec {
  private readonly blogPosts: GetAdminBlogPostByIdPrismaPort;

  constructor(deps: GetAdminBlogPostByIdDeps = {}) {
    this.blogPosts = deps.blogPosts ?? prisma.blogPost;
  }

  async execute(
    input: GetAdminBlogPostByIdInput
  ): Promise<GetAdminBlogPostByIdResult> {
    const parsed = GetAdminBlogPostByIdInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_BLOG_POST_ID",
        parsed.error.issues[0]?.message ?? "Blog post ID is required",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    try {
      const record = await this.blogPosts.findUnique({
        where: { id: parsed.data.id },
      });
      if (!record) {
        return createFailure("BLOG_POST_NOT_FOUND", "Blog post not found", {
          recoverable: false,
        });
      }
      return createSuccess(record);
    } catch (err) {
      failBuildOnDataSourceError("BlogPostService.getBlogPostById", err);
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Blog administration storage is temporarily unavailable.",
        { recoverable: true, details: err }
      );
    }
  }
}
