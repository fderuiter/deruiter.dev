import { NextResponse, NextRequest } from "next/server";
import { CaseStudySubmissionSchema } from "@/lib/schemas";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { createApiHandler } from "@/lib/route-wrapper";
import { sanitizeError } from "@/lib/error-sanitization";
import { checkRequestSubmissionRateLimit } from "@/lib/moderation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  async () => {
    try {
      const studies = await CaseStudyService.getPublishedCaseStudies();
      return NextResponse.json(studies, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      });
    } catch (err) {
      logger.error("API Case Studies search data fetch failed:", err);
      return NextResponse.json(
        { error: "Failed to load case studies telemetry data" },
        { status: 500 }
      );
    }
  },
  { auth: "public" }
);

export const POST = createApiHandler(
  async (req: NextRequest, { data }) => {
    try {
      const rateLimitCheck = checkRequestSubmissionRateLimit(req);
      if (rateLimitCheck.isRateLimited) {
        return NextResponse.json(
          { error: "Too many submission attempts. Please try again later." },
          { status: 429 }
        );
      }

      const newCaseStudy = await CaseStudyService.submitCaseStudy(data);
      return NextResponse.json(
        {
          success: true,
          data: newCaseStudy,
        },
        { status: 201 }
      );
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (
        errorObj?.code === "P2002" ||
        (typeof errorObj?.message === "string" &&
          errorObj.message.includes("Unique constraint failed"))
      ) {
        return NextResponse.json(
          {
            error: "A case study with this slug already exists",
            details: [
              {
                path: "slug",
                message: "A case study with this slug already exists",
              },
            ],
          },
          { status: 400 }
        );
      }

      const sanitized = sanitizeError(err);
      logger.error("API Case Study submission failed:", sanitized);
      return NextResponse.json(
        { error: "Failed to submit case study" },
        { status: 500 }
      );
    }
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
      const details = issues.map((issue) => ({
        path: issue.path.join(".") || "payload",
        message: issue.message,
      }));
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
