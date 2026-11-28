import { NextRequest, NextResponse } from "next/server";
import { BlogPostReactionSubmissionSchema } from "@/lib/schemas";
import {
  type DuplicateBlogReactionDetails,
  GetBlogReactionsHandler,
  SubmitBlogReactionHandler,
  getConnectionHashFromRequest,
} from "@/lib/services";
import {
  createApiHandler,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";
import { checkSubmissionAttemptRateLimit } from "@/lib/moderation";
import { isRedisConfigured, redis, getScopedRedisKey } from "@/lib/redis";
import { logger } from "@/lib/logger";

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
    try {
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
          const rateLimitCheck =
            checkSubmissionAttemptRateLimit(connectionHash);
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
        blogPostSlug: data.blogPostSlug,
        reactionType: data.reactionType,
        connectionHash,
      });

      if (!result.success) {
        if (result.error.code === "BLOG_POST_NOT_FOUND") {
          return NextResponse.json(
            {
              error:
                result.error.message || "Blog post not found or not published",
            },
            { status: 404 }
          );
        }

        if (result.error.code === "RATE_LIMITED") {
          const duplicateDetails = result.error.details as
            Partial<DuplicateBlogReactionDetails> | undefined;
          const hasAuthoritativeState =
            Boolean(
              duplicateDetails?.counts &&
              typeof duplicateDetails.counts === "object"
            ) && Array.isArray(duplicateDetails?.userReactions);
          return NextResponse.json(
            {
              error: "Duplicate reaction within the sliding window",
              ...(hasAuthoritativeState
                ? {
                    counts: duplicateDetails!.counts,
                    userReactions: duplicateDetails!.userReactions,
                  }
                : {}),
            },
            { status: 429 }
          );
        }

        return serviceFailureResponse(result, {
          errorMessage:
            "Reaction storage is temporarily unavailable. Your reaction remains queued for retry.",
          logContext: "Blog post reaction persistence failed:",
        });
      }

      return NextResponse.json(
        {
          success: true,
          durable: result.data.durable,
          reactionType: result.data.reactionType,
          counts: result.data.counts,
          userReactions: result.data.userReactions,
        },
        { status: 200 }
      );
    } catch (err) {
      logger.error("Failed to process blog post reaction submission:", err);
      return NextResponse.json(
        {
          error:
            "Internal server error processing blog post reaction submission",
        },
        { status: 500 }
      );
    }
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
