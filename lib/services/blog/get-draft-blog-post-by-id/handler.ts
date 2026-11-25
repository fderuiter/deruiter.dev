import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { BlogPostDbRecord } from "../shared";
import {
  GetDraftBlogPostByIdInputSchema,
  type GetDraftBlogPostByIdInput,
  type GetDraftBlogPostByIdResult,
  type GetDraftBlogPostByIdSpec,
} from "./spec";

export interface GetDraftBlogPostByIdDeps {
  db?: {
    blogPost: {
      findFirst(args: {
        where: { id: string; published: false };
      }): Promise<BlogPostDbRecord | null>;
    };
  };
}

/**
 * Handler for retrieving an unpublished blog draft by ID without static fallbacks.
 */
export class GetDraftBlogPostByIdHandler implements GetDraftBlogPostByIdSpec {
  private readonly db: NonNullable<GetDraftBlogPostByIdDeps["db"]>;

  constructor(deps: GetDraftBlogPostByIdDeps = {}) {
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: GetDraftBlogPostByIdInput
  ): Promise<GetDraftBlogPostByIdResult> {
    const parsed = GetDraftBlogPostByIdInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid blog draft ID",
        { recoverable: false, details: parsed.error }
      );
    }

    const { id } = parsed.data;
    try {
      const draft = await this.db.blogPost.findFirst({
        where: { id, published: false },
      });
      if (!draft) {
        return createFailure("NOT_FOUND", `Blog draft "${id}" not found`, {
          recoverable: false,
        });
      }
      return createSuccess(draft);
    } catch (error) {
      return createFailure(
        "STORAGE_UNAVAILABLE",
        `Failed to load blog draft "${id}"`,
        { recoverable: true, details: error }
      );
    }
  }
}
