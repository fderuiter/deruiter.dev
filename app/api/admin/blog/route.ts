import { NextRequest, NextResponse } from "next/server";
import {
  BlogDraftCreateSchema,
  BlogDraftPaginationSchema,
} from "@/lib/schemas";
import { BlogPostService } from "@/lib/services/blog-service";
import { createApiHandler } from "@/lib/route-wrapper";
import { sanitizeError } from "@/lib/error-sanitization";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function validationError(error: unknown) {
  const issues = (
    error as {
      issues: Array<{ path: Array<string | number>; message: string }>;
    }
  ).issues;
  return {
    error: "Invalid blog draft request",
    details: issues.map((issue) => ({
      path: issue.path.join(".") || "payload",
      message: issue.message,
    })),
  };
}

export const GET = createApiHandler(
  async (_req: NextRequest, { data }) => {
    try {
      const { drafts, total } = await BlogPostService.getDraftBlogPosts(data);
      return NextResponse.json({
        data: drafts,
        pagination: { page: data.page, pageSize: data.pageSize, total },
      });
    } catch (error) {
      logger.error("API admin blog draft list failed:", sanitizeError(error));
      return NextResponse.json(
        { error: "Failed to load blog drafts" },
        { status: 500 }
      );
    }
  },
  {
    schema: BlogDraftPaginationSchema,
    type: "query",
    customValidationError: validationError,
    auth: "clerk_admin",
  }
);

export const POST = createApiHandler(
  async (_req: NextRequest, { data }) => {
    try {
      const created = await BlogPostService.createDraftBlogPost(data);
      return NextResponse.json(
        { success: true, data: created },
        { status: 201 }
      );
    } catch (error: unknown) {
      const details = error as { code?: string; message?: string };
      if (
        details.code === "P2002" ||
        (typeof details.message === "string" &&
          details.message.includes("Unique constraint failed"))
      ) {
        return NextResponse.json(
          {
            error: "A blog post with this slug already exists",
            details: [
              {
                path: "slug",
                message: "A blog post with this slug already exists",
              },
            ],
          },
          { status: 409 }
        );
      }

      logger.error(
        "API admin blog draft creation failed:",
        sanitizeError(error)
      );
      return NextResponse.json(
        { error: "Failed to create blog draft" },
        { status: 500 }
      );
    }
  },
  {
    schema: BlogDraftCreateSchema,
    type: "body",
    customJsonError: "Invalid JSON payload",
    customValidationError: validationError,
    auth: "clerk_admin",
  }
);
