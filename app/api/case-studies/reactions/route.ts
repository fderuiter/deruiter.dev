import { NextRequest, NextResponse } from "next/server";
import { ReactionSubmissionSchema } from "@/lib/schemas";
import {
  GetCaseStudyReactionsHandler,
  SubmitCaseStudyReactionHandler,
} from "@/lib/services";
import { getConnectionHashFromRequest } from "@/lib/services/privacy";
import {
  createApiHandler,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";

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
    return NextResponse.json({ success: true, ...result.data });
  },
  { auth: "public" }
);

export const POST = createApiHandler(
  async (req: NextRequest, { data }) => {
    const connectionHash = await getConnectionHashFromRequest(req);
    const result = await new SubmitCaseStudyReactionHandler().execute({
      ...data,
      connectionHash,
    });

    if (!result.success) {
      return serviceFailureResponse(result, {
        logContext: "Failed to process reaction submission:",
      });
    }

    return NextResponse.json(
      {
        success: true,
        reactionType: result.data.reactionType,
        counts: result.data.counts,
        userReactions: result.data.userReactions,
      },
      { status: 200 }
    );
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
