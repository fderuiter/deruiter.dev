import { NextResponse, NextRequest } from "next/server";
import { CaseStudySubmissionSchema } from "@/lib/schemas";
import {
  GetPublishedCaseStudiesHandler,
  SubmitCaseStudyHandler,
} from "@/lib/services";
import {
  createApiHandler,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";
import { checkRequestSubmissionRateLimit } from "@/lib/moderation";

export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  async () => {
    const result = await new GetPublishedCaseStudiesHandler().execute();
    if (!result.success) {
      return serviceFailureResponse(result, {
        status: 500,
        errorMessage: "Failed to load case studies telemetry data",
        logContext: "API Case Studies search data fetch failed:",
      });
    }
    return NextResponse.json(result.data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  },
  { auth: "public" }
);

export const POST = createApiHandler(
  async (req: NextRequest, { data }) => {
    const rateLimitCheck = checkRequestSubmissionRateLimit(req);
    if (rateLimitCheck.isRateLimited) {
      return NextResponse.json(
        { error: "Too many submission attempts. Please try again later." },
        { status: 429 }
      );
    }

    const result = await new SubmitCaseStudyHandler().execute(data);
    if (!result.success) {
      if (result.error.code === "DUPLICATE_SLUG") {
        return serviceFailureResponse(result, {
          status: 400,
          errorMessage: "A case study with this slug already exists",
          details: [
            {
              path: "slug",
              message: "A case study with this slug already exists",
            },
          ],
        });
      }
      return serviceFailureResponse(result, {
        status: 500,
        errorMessage: "Failed to submit case study",
        logContext: "API Case Study submission failed:",
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      { status: 201 }
    );
  },
  {
    schema: CaseStudySubmissionSchema,
    type: "body",
    customJsonError: "Invalid JSON payload",
    customValidationError: (err) => {
      const issues = (
        err as {
          issues: Array<{ path: Array<string | number>; message: string }>;
        }
      ).issues;
      const details = zodIssueDetails(err, "payload");
      const isToneViolation = issues.some(
        (i) =>
          i.message.toLowerCase().includes("tone") ||
          i.message.toLowerCase().includes("constructive") ||
          i.message.toLowerCase().includes("profanity")
      );
      return {
        error: isToneViolation
          ? "Submission rejected: Content violates community tone standards."
          : "Missing or invalid case study submission fields",
        details,
      };
    },
    auth: "clerk_admin",
  }
);
