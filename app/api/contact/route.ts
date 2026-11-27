import { NextRequest, NextResponse } from "next/server";
import { ContactSubmissionSchema } from "@/lib/schemas";
import {
  SendContactInquiryHandler,
  getConnectionHashFromRequest,
} from "@/lib/services";
import { createApiHandler, zodIssueDetails } from "@/lib/route-wrapper";
import { checkSubmissionAttemptRateLimit } from "@/lib/moderation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Minimum duration in milliseconds required between form mount and submission.
 * Human users take > 2000ms to complete fields; bots submit instantaneously.
 */
const MIN_SUBMISSION_DURATION_MS = 2000;

export const POST = createApiHandler(
  async (req: NextRequest, { data }) => {
    try {
      const connectionHash = await getConnectionHashFromRequest(req);

      // 1. Anonymous Connection-Hash Rate Limiting (5 attempts per 10 minutes)
      const rateLimitCheck = checkSubmissionAttemptRateLimit(
        connectionHash,
        5,
        600000
      );
      if (rateLimitCheck.isRateLimited) {
        return NextResponse.json(
          {
            error:
              "Too many contact submission attempts. Please try again later.",
          },
          {
            status: 429,
            headers: {
              "Retry-After": "600",
              "X-RateLimit-Limit": "5",
              "X-RateLimit-Remaining": "0",
            },
          }
        );
      }

      // 2. Invisible Honeypot Trap Check
      // If a bot fills out the hidden field, silently absorb without dispatching live emails
      if (data._gotcha && data._gotcha.trim().length > 0) {
        return NextResponse.json(
          {
            success: true,
            message: "Your message has been received! I'll be in touch soon.",
            simulated: true,
          },
          { status: 201 }
        );
      }

      // 3. Timestamp Elapsed Verification (Duration Gate)
      if (data._clientTimestamp && typeof data._clientTimestamp === "number") {
        const elapsed = Date.now() - data._clientTimestamp;
        if (elapsed < MIN_SUBMISSION_DURATION_MS) {
          // Submitted too fast for human input - treat as automated spam
          return NextResponse.json(
            {
              success: true,
              message: "Your message has been received! I'll be in touch soon.",
              simulated: true,
            },
            { status: 201 }
          );
        }
      }

      // 4. Dispatch Inbound Inquiry and Confirmation
      const result = await new SendContactInquiryHandler().execute({
        submission: data,
        connectionHash,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            // An unknown-eligibility failure (#3806) is internal detail; the
            // visitor gets the plain fallback.
            error:
              (result.error.code !== "RECIPIENT_ELIGIBILITY_UNKNOWN" &&
                result.error.message) ||
              "Unable to deliver message at this time. Please reach out directly via email.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          message: "Your message has been received! I'll be in touch soon.",
          messageId: result.data.adminDelivery.id,
          simulated: result.data.adminDelivery.simulated,
        },
        { status: 201 }
      );
    } catch (err) {
      logger.error("Failed to process contact submission:", err);
      return NextResponse.json(
        { error: "Internal server error processing contact submission" },
        { status: 500 }
      );
    }
  },
  {
    auth: "public",
    schema: ContactSubmissionSchema,
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
