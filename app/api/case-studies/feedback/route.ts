import { NextRequest, NextResponse } from "next/server";
import { FeedbackSubmissionSchema } from "@/lib/schemas";
import {
  SendFeedbackNotificationHandler,
  SubmitCaseStudyFeedbackHandler,
  getConnectionHashFromRequest,
} from "@/lib/services";
import {
  createApiHandler,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";
import { checkSubmissionAttemptRateLimit } from "@/lib/moderation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * The offline queue sends one key per queued revision, so a replay of the
 * same request carries the same key (#3807).
 */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{1,128}$/;

export const POST = createApiHandler(
  async (req: NextRequest, { data }) => {
    try {
      const rawKey = req.headers.get("idempotency-key");
      if (rawKey !== null && !IDEMPOTENCY_KEY.test(rawKey)) {
        return NextResponse.json(
          { error: "Invalid Idempotency-Key header" },
          { status: 400 }
        );
      }
      const operationKey = rawKey ?? undefined;

      const connectionHash = await getConnectionHashFromRequest(req);

      const rateLimitCheck = checkSubmissionAttemptRateLimit(connectionHash);
      if (rateLimitCheck.isRateLimited) {
        return NextResponse.json(
          { error: "Too many submission attempts. Please try again later." },
          { status: 429 }
        );
      }

      const result = await new SubmitCaseStudyFeedbackHandler().execute({
        caseStudySlug: data.caseStudySlug,
        takeaways: data.takeaways,
        comments: data.comments,
        connectionHash,
        operationKey,
      });

      if (!result.success) {
        if (result.error.code === "RATE_LIMITED") {
          return NextResponse.json(
            { error: result.error.message },
            { status: 429 }
          );
        }
        return serviceFailureResponse(result, {
          errorMessage:
            "Feedback storage is temporarily unavailable. Your feedback remains queued for retry.",
          logContext: "Case study feedback persistence failed:",
        });
      }

      const durable = result.data.durable !== false;

      // Non-blocking notification dispatch, once per durably stored row
      if (durable && !result.data.replayed) {
        new SendFeedbackNotificationHandler()
          .execute({
            caseStudySlug: data.caseStudySlug,
            takeaways: data.takeaways,
            comments: data.comments,
            connectionHash,
            submittedAt: new Date(),
          })
          .catch((err) => {
            logger.error("Non-blocking feedback email dispatch error:", err);
          });
      }

      return NextResponse.json(
        {
          success: true,
          durable,
          message: result.data.message,
          feedback: result.data.feedback,
        },
        { status: durable ? 201 : 202 }
      );
    } catch (err) {
      logger.error("Failed to process feedback submission:", err);
      return NextResponse.json(
        { error: "Internal server error processing feedback submission" },
        { status: 500 }
      );
    }
  },
  {
    auth: "public",
    schema: FeedbackSubmissionSchema,
    type: "body",
    customJsonError: "Invalid JSON body payload",
    customValidationError: (err) => {
      const issues = (
        err as {
          issues: Array<{ path: Array<string | number>; message: string }>;
        }
      ).issues;
      const isToneViolation = issues.some(
        (i) =>
          i.message.toLowerCase().includes("tone") ||
          i.message.toLowerCase().includes("constructive") ||
          i.message.toLowerCase().includes("profanity")
      );
      return {
        error: isToneViolation
          ? "Submission rejected: Content violates community tone standards."
          : "Validation failed",
        details: zodIssueDetails(err),
      };
    },
  }
);
