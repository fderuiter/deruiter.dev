import { NextRequest, NextResponse } from "next/server";
import { ContactSubmissionSchema } from "@/lib/schemas";
import { SendContactInquiryHandler } from "@/lib/services";
import { getConnectionHashFromRequest } from "@/lib/services/privacy";
import {
  createApiHandler,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";
import { checkSubmissionAttemptRateLimit } from "@/lib/moderation";

export const dynamic = "force-dynamic";

/**
 * Minimum duration in milliseconds required between form mount and submission.
 * Human users take > 2000ms to complete fields; bots submit instantaneously.
 */
const MIN_SUBMISSION_DURATION_MS = 2000;

export const POST = createApiHandler(
  async (req: NextRequest, { data }) => {
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
      // An unknown-eligibility or storage failure (#3806) is internal detail;
      // the visitor gets the plain fallback.
      const isInternal =
        result.error.code === "RECIPIENT_ELIGIBILITY_UNKNOWN" ||
        result.error.code === "STORAGE_UNAVAILABLE" ||
        result.error.code === "TRANSPORT_UNCONFIGURED";
      const publicError =
        (!isInternal && result.error.message) ||
        "Unable to deliver message at this time. Please reach out directly via email.";
      const status =
        result.error.code === "STORAGE_UNAVAILABLE" ||
        result.error.code === "RECIPIENT_ELIGIBILITY_UNKNOWN"
          ? 503
          : 500;
      return serviceFailureResponse(result, {
        status,
        errorMessage: publicError,
        logContext: "Failed to process contact submission:",
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your message has been received! I'll be in touch soon.",
        messageId: result.data.messageId,
        simulated: result.data.simulated,
      },
      { status: 201 }
    );
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
