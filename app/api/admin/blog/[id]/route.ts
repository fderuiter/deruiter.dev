import { NextRequest, NextResponse } from "next/server";
import { BlogDraftIdParamsSchema, BlogDraftUpdateSchema } from "@/lib/schemas";
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

function duplicateSlugResponse() {
  return {
    error: "A blog post with this slug already exists",
    details: [
      {
        path: "slug",
        message: "A blog post with this slug already exists",
      },
    ],
  };
}

function getDraftId(params: Record<string, string | string[] | undefined>) {
  const parsed = BlogDraftIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { error: validationError(parsed.error) };
  }
  return { id: parsed.data.id };
}

export const GET = createApiHandler(
  async (_req: NextRequest, { params }) => {
    const parsed = getDraftId(params);
    if ("error" in parsed) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    try {
      const draft = await BlogPostService.getDraftBlogPostById(parsed.id);
      if (!draft) {
        return NextResponse.json(
          { error: "Blog draft not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ data: draft });
    } catch (error) {
      logger.error("API admin blog draft read failed:", sanitizeError(error));
      return NextResponse.json(
        { error: "Failed to load blog draft" },
        { status: 500 }
      );
    }
  },
  { auth: "clerk_admin" }
);

export const PATCH = createApiHandler(
  async (_req: NextRequest, { data, params }) => {
    const parsed = getDraftId(params);
    if ("error" in parsed) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    try {
      const updated = await BlogPostService.updateDraftBlogPost(
        parsed.id,
        data
      );
      if (!updated) {
        return NextResponse.json(
          { error: "Blog draft not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: updated });
    } catch (error: unknown) {
      const details = error as { code?: string; message?: string };
      if (
        details.code === "P2002" ||
        (typeof details.message === "string" &&
          details.message.includes("Unique constraint failed"))
      ) {
        return NextResponse.json(duplicateSlugResponse(), { status: 409 });
      }

      logger.error("API admin blog draft edit failed:", sanitizeError(error));
      return NextResponse.json(
        { error: "Failed to update blog draft" },
        { status: 500 }
      );
    }
  },
  {
    schema: BlogDraftUpdateSchema,
    type: "body",
    customJsonError: "Invalid JSON payload",
    customValidationError: validationError,
    auth: "clerk_admin",
  }
);

export const DELETE = createApiHandler(
  async (_req: NextRequest, { params }) => {
    const parsed = getDraftId(params);
    if ("error" in parsed) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    try {
      const deleted = await BlogPostService.deleteBlogPost(parsed.id);
      if (!deleted) {
        return NextResponse.json(
          { error: "Blog draft not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: { id: parsed.id } });
    } catch (error) {
      logger.error("API admin blog deletion failed:", sanitizeError(error));
      return NextResponse.json(
        { error: "Failed to delete blog post" },
        { status: 500 }
      );
    }
  },
  { auth: "clerk_admin" }
);
