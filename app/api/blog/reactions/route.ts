import { NextRequest, NextResponse } from "next/server";
import { BlogPostReactionSubmissionSchema } from "@/lib/schemas";
import {
  GetBlogReactionsHandler,
  SubmitBlogReactionHandler,
  type DuplicateBlogReactionDetails,
} from "@/lib/services";
import { getConnectionHashFromRequest } from "@/lib/services/privacy";
import {
  createApiHandler,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";
import { checkSubmissionAttemptRateLimit } from "@/lib/moderation";
import { isRedisConfigured, redis, getScopedRedisKey } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug") || searchParams.get("blogPostSlug");

    if (!slug) {
      return NextResponse.json(
        { error: "Missing required query parameter 'slug' or 'blogPostSlug'" },
        { status: 400 }
      );
    }

    const connectionHash = await getConnectionHashFromRequest(req);
    const result = await new GetBlogReactionsHandler().execute({
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
    const connectionHash = await getConnectionHashFromRequest(req);

    if (isRedisConfigured()) {
      try {
        const rateKey = getScopedRedisKey(`blog:ratelimit:${connectionHash}`);
        const attempts = await redis.incr(rateKey);
        if (attempts === 1) {
          await redis.expire(rateKey, 60);
        }
        if (attempts > 10) {
          return NextResponse.json(
            {
              error: "Too many submission attempts. Please try again later.",
            },
            { status: 429 }
          );
        }
      } catch {
        const rateLimitCheck = checkSubmissionAttemptRateLimit(connectionHash);
        if (rateLimitCheck.isRateLimited) {
          return NextResponse.json(
            {
              error: "Too many submission attempts. Please try again later.",
            },
            { status: 429 }
          );
        }
      }
    } else {
      const rateLimitCheck = checkSubmissionAttemptRateLimit(connectionHash);
      if (rateLimitCheck.isRateLimited) {
        return NextResponse.json(
          { error: "Too many submission attempts. Please try again later." },
          { status: 429 }
        );
      }
    }

    const result = await new SubmitBlogReactionHandler().execute({
      ...data,
      connectionHash,
    });

    if (!result.success) {
      if (result.error.code === "RATE_LIMITED") {
        const details = result.error.details as
          DuplicateBlogReactionDetails | undefined;
        return serviceFailureResponse(result, {
          extraBody: details
            ? {
                counts: details.counts,
                userReactions: details.userReactions,
              }
            : undefined,
        });
      }

      return serviceFailureResponse(result, {
        logContext: "Failed to process blog post reaction submission:",
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
    schema: BlogPostReactionSubmissionSchema,
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
