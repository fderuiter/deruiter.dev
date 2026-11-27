import { NextResponse } from "next/server";
import { TelemetryEventSchema } from "@/lib/schemas";
import {
  CheckTelemetryRateLimitHandler,
  GetTelemetryAggregateStatsHandler,
  RecordTelemetryEventHandler,
} from "@/lib/services";
import {
  createApiHandler,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";
import { logger } from "@/lib/logger";
import { env, isBuildPhase } from "@/lib/env";

export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  async () => {
    // Redis only: the daily maintenance run writes the aggregate (#3201).
    const statsResult = await new GetTelemetryAggregateStatsHandler().execute();
    if (!statsResult.success) {
      const cause =
        statsResult.error.details ?? new Error(statsResult.error.message);
      // Gate on the runtime, not the build (AGENTS.md section 15). Outside a
      // production runtime an unreachable Redis is expected, so it is logged
      // as a warning and flagged for the client, which then stays off
      // console.error.
      if (env.VERCEL_ENV === "production" && !isBuildPhase()) {
        logger.error("Telemetry statistics aggregate query failed:", cause);
        return NextResponse.json(
          { error: "Failed to compile aggregate portfolio telemetry" },
          { status: 500 }
        );
      }
      logger.warn(
        "Telemetry statistics are unavailable without a reachable Redis:",
        cause
      );
      return NextResponse.json(
        { error: "Failed to compile aggregate portfolio telemetry" },
        { status: 500, headers: { "X-Telemetry-Offline": "expected" } }
      );
    }

    return NextResponse.json(statsResult.data, {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=10, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  },
  { auth: "public" }
);

export const POST = createApiHandler(
  async (req, { data }) => {
    try {
      const rateLimitResult =
        await new CheckTelemetryRateLimitHandler().execute({ request: req });
      const rateLimitRes = rateLimitResult.success
        ? rateLimitResult.data
        : { limited: false, headers: undefined };

      if (rateLimitRes.limited) {
        return NextResponse.json(
          { error: "Too many requests. Please slow down rate pacing." },
          {
            status: 429,
            headers: rateLimitRes.headers,
          }
        );
      }

      const recordResult = await new RecordTelemetryEventHandler().execute(
        data
      );
      if (!recordResult.success) {
        return serviceFailureResponse(recordResult, {
          errorMessage: "Failed to record telemetry interaction event",
          logContext: "Failed to commit telemetry event log:",
        });
      }

      const { event, buffered } = recordResult.data;

      // A failed buffer write drops the event outright, so report it as
      // accepted-but-not-durable (202) rather than created (201). The client
      // must not retry a dropped analytics event, but it must not be told the
      // event was stored either.
      const response = NextResponse.json(
        { success: true, durable: buffered, event },
        { status: buffered ? 201 : 202 }
      );
      if (rateLimitRes.headers) {
        Object.entries(rateLimitRes.headers).forEach(([key, val]) => {
          response.headers.set(key, val);
        });
      }
      return response;
    } catch (err) {
      logger.error("Failed to commit telemetry event log:", err);
      return NextResponse.json(
        { error: "Failed to record telemetry interaction event" },
        { status: 500 }
      );
    }
  },
  {
    auth: "public",
    schema: TelemetryEventSchema,
    type: "body",
    customJsonError: "Invalid JSON body payload",
    customValidationError: (err) => {
      const issues = (
        err as {
          issues: Array<{ path: Array<string | number>; message: string }>;
        }
      ).issues;
      const firstIssue = issues[0];
      let errorMessage = "Validation failed";
      if (firstIssue && firstIssue.path[0] === "projectSlug") {
        errorMessage = "Missing or invalid projectSlug identifier";
      } else if (firstIssue && firstIssue.path[0] === "eventType") {
        errorMessage =
          "Missing or invalid eventType. Allowed: 'page_view', 'project_click', 'route_error', 'simulator_option_select', 'simulator_milestone_reached', 'simulator_report_copy'";
      }
      return {
        error: errorMessage,
        details: zodIssueDetails(err),
      };
    },
  }
);
