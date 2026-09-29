/* jscpd:ignore-start */
import { NextRequest, NextResponse } from "next/server";
import { FeedbackSubmissionSchema } from "@/lib/schemas";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { getConnectionHashFromRequest } from "@/lib/services/privacy-service";
import { createApiHandler } from "@/lib/route-wrapper";
import { checkSubmissionAttemptRateLimit } from "@/lib/moderation";
import { EmailService } from "@/lib/services/email-service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = createApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || searchParams.get("caseStudySlug");

  if (!slug) {
    return NextResponse.json(
      { error: "Missing required query parameter 'slug' or 'caseStudySlug'" },
      { status: 400 }
    );
  }

  const connectionHash = await getConnectionHashFromRequest(req);
  const result = await CaseStudyService.getFeedback(slug, connectionHash);
  return NextResponse.json(result);
});

export const POST = createApiHandler(
  async (req: NextRequest, { data }) => {
    try {
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
        connectionHash
      );

      if (result.rateLimited) {
        return NextResponse.json({ error: result.message }, { status: 429 });
      }

      // Non-blocking notification dispatch
      if (result.success) {
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
        details: issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      };
    },
  }
);
/* jscpd:ignore-end */
