import { NextRequest, NextResponse } from "next/server";
import { FeedbackSubmissionSchema } from "@/lib/schemas";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { getConnectionHashFromRequest } from "@/lib/services/privacy-service";
import { createApiHandler, zodIssueDetails } from "@/lib/route-wrapper";
import { checkSubmissionAttemptRateLimit } from "@/lib/moderation";
import { EmailService } from "@/lib/services/email-service";
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

      const result = await CaseStudyService.submitFeedback(
        data,
        connectionHash,
        operationKey
      );

      if (result.rateLimited) {
        return NextResponse.json({ error: result.message }, { status: 429 });
      }

      // Non-blocking notification dispatch, once per stored row
      if (result.success && !result.replayed) {
        EmailService.sendFeedbackNotification({
          caseStudySlug: data.caseStudySlug,
          takeaways: data.takeaways,
          comments: data.comments,
          connectionHash,
          submittedAt: new Date(),
        }).catch((err) => {
          logger.error("Non-blocking feedback email dispatch error:", err);
        });
      }

      return NextResponse.json(
        {
          success: result.success,
          message: result.message,
          feedback: result.feedback,
        },
        { status: 201 }
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
