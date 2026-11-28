import { NextRequest, NextResponse } from "next/server";
import { ReactionSubmissionSchema } from "@/lib/schemas";
import {
  GetCaseStudyReactionsHandler,
  SubmitCaseStudyReactionHandler,
  getConnectionHashFromRequest,
} from "@/lib/services";
import {
  createApiHandler,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug") || searchParams.get("caseStudySlug");

    if (!slug) {
      return NextResponse.json(
        { error: "Missing required query parameter 'slug' or 'caseStudySlug'" },
        { status: 400 }
      );
    }

    const connectionHash = await getConnectionHashFromRequest(req);
    const result = await new GetCaseStudyReactionsHandler().execute({
      slug,
      connectionHash,
    });
    if (!result.success) {
      return serviceFailureResponse(result);
    }
    return NextResponse.json({
      success: true,
      ...result.data,
    });
  },
  { auth: "public" }
);

export const POST = createApiHandler(
  async (req: NextRequest, { data }) => {
    try {
      const connectionHash = await getConnectionHashFromRequest(req);
      const result = await new SubmitCaseStudyReactionHandler().execute({
        caseStudySlug: data.caseStudySlug,
        reactionType: data.reactionType,
        connectionHash,
      });

      if (!result.success) {
        return serviceFailureResponse(result, {
          errorMessage:
            "Reaction storage is temporarily unavailable. Your reaction remains queued for retry.",
          logContext: "Case study reaction persistence failed:",
        });
      }

      const durable = result.data.durable !== false;

      return NextResponse.json(
        {
          success: true,
          durable,
          reactionType: result.data.reactionType,
          counts: result.data.counts,
          userReactions: result.data.userReactions,
        },
        { status: durable ? 200 : 202 }
      );
    } catch (err) {
      logger.error("Failed to process reaction submission:", err);
      return NextResponse.json(
        { error: "Internal server error processing reaction submission" },
        { status: 500 }
      );
    }
  },
  {
    auth: "public",
    schema: ReactionSubmissionSchema,
    type: "body",
    customJsonError: "Invalid JSON body payload",
    customValidationError: (err) => {
      return {
        error: "Validation failed",
        details: zodIssueDetails(err),
      };
    },
  }
);
