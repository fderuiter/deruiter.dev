import { failBuildOnDataSourceError } from "@/lib/build-integrity";
import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { PersistedBlogPostRecord } from "../shared";
import type {
  ListAdminBlogPostsInput,
  ListAdminBlogPostsResult,
  ListAdminBlogPostsSpec,
} from "./spec";

export interface ListAdminBlogPostsPrismaPort {
  findMany(args: {
    orderBy: [{ updated_at: "desc" }, { id: "asc" }];
  }): Promise<PersistedBlogPostRecord[]>;
}

export interface ListAdminBlogPostsDeps {
  blogPosts?: ListAdminBlogPostsPrismaPort;
}

export class ListAdminBlogPostsHandler implements ListAdminBlogPostsSpec {
  private readonly blogPosts: ListAdminBlogPostsPrismaPort;

  constructor(deps: ListAdminBlogPostsDeps = {}) {
    this.blogPosts = deps.blogPosts ?? prisma.blogPost;
  }

  async execute(
    _input?: ListAdminBlogPostsInput
  ): Promise<ListAdminBlogPostsResult> {
    try {
      const records = await this.blogPosts.findMany({
        orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      });
      return createSuccess(records);
    } catch (err) {
      failBuildOnDataSourceError("BlogPostService.getAllBlogPostsAdmin", err);
      return createFailure(
        "STORAGE_UNAVAILABLE",
        "Blog administration storage is temporarily unavailable.",
        { recoverable: true, details: err }
      );
    }
  }
}
