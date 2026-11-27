import { NextRequest, NextResponse } from "next/server";
import { BlogDraftIdParamsSchema, BlogDraftUpdateSchema } from "@/lib/schemas";
import {
  DeleteBlogPostHandler,
  GetDraftBlogPostHandler,
  UpdateDraftBlogPostHandler,
} from "@/lib/services";
import {
  createApiHandler,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";

export const dynamic = "force-dynamic";

function validationError(error: unknown) {
  return {
    error: "Invalid blog draft request",
    details: zodIssueDetails(error, "payload"),
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

    const result = await new GetDraftBlogPostHandler().execute({
      id: parsed.id,
    });
    if (!result.success) {
      if (result.error.code === "BLOG_POST_NOT_FOUND") {
        return NextResponse.json(
          { error: "Blog draft not found" },
          { status: 404 }
        );
      }
      return serviceFailureResponse(result, {
        errorMessage: "Failed to load blog draft",
        logContext: "API admin blog draft read failed:",
      });
    }

    return NextResponse.json({ data: result.data });
  },
  { auth: "clerk_admin" }
);

export const PATCH = createApiHandler(
  async (_req: NextRequest, { data, params }) => {
    const parsed = getDraftId(params);
    if ("error" in parsed) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const result = await new UpdateDraftBlogPostHandler().execute({
      id: parsed.id,
      updates: data,
    });
    if (!result.success) {
      if (result.error.code === "BLOG_POST_NOT_FOUND") {
        return NextResponse.json(
          { error: "Blog draft not found" },
          { status: 404 }
        );
      }
      if (result.error.code === "DUPLICATE_BLOG_SLUG") {
        return serviceFailureResponse(result, {
          errorMessage: "A blog post with this slug already exists",
          details: [
            {
              path: "slug",
              message: "A blog post with this slug already exists",
            },
          ],
        });
      }
      return serviceFailureResponse(result, {
        errorMessage: "Failed to update blog draft",
        logContext: "API admin blog draft edit failed:",
      });
    }

    return NextResponse.json({ success: true, data: result.data });
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

    const result = await new DeleteBlogPostHandler().execute({
      id: parsed.id,
    });
    if (!result.success) {
      if (result.error.code === "BLOG_POST_NOT_FOUND") {
        return NextResponse.json(
          { error: "Blog draft not found" },
          { status: 404 }
        );
      }
      return serviceFailureResponse(result, {
        errorMessage: "Failed to delete blog post",
        logContext: "API admin blog deletion failed:",
      });
    }

    return NextResponse.json({ success: true, data: { id: parsed.id } });
  },
  { auth: "clerk_admin" }
);
