import { NextRequest, NextResponse } from "next/server";
import {
  BlogDraftCreateSchema,
  BlogDraftPaginationSchema,
} from "@/lib/schemas";
import {
  CreateDraftBlogPostHandler,
  ListDraftBlogPostsHandler,
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

export const GET = createApiHandler(
  async (_req: NextRequest, { data }) => {
    const result = await new ListDraftBlogPostsHandler().execute(data);
    if (!result.success) {
      return serviceFailureResponse(result, {
        errorMessage: "Failed to load blog drafts",
        logContext: "API admin blog draft list failed:",
      });
    }

    return NextResponse.json({
      data: result.data.drafts,
      pagination: {
        page: data.page,
        pageSize: data.pageSize,
        total: result.data.total,
      },
    });
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
    const result = await new CreateDraftBlogPostHandler().execute(data);
    if (!result.success) {
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
        errorMessage: "Failed to create blog draft",
        logContext: "API admin blog draft creation failed:",
      });
    }

    return NextResponse.json(
      { success: true, data: result.data },
      { status: 201 }
    );
  },
  {
    schema: BlogDraftCreateSchema,
    type: "body",
    customJsonError: "Invalid JSON payload",
    customValidationError: validationError,
    auth: "clerk_admin",
  }
);
