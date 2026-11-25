import { NextResponse } from "next/server";
import { createApiHandler, serviceFailureResponse } from "@/lib/route-wrapper";
import { SyncParamsSchema } from "@/lib/schemas";
import { validateRouteInitialization } from "@/lib/security";
import { RunMaintenanceHandler } from "@/lib/services";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Platform ceiling for the daily cron, in seconds (AGENTS.md section 22:
 * the maintenance pass runs within eight seconds). Next reads this literal
 * from the build output, so it cannot be derived from another constant.
 */
export const maxDuration = 8;

/**
 * Time kept back from the pipeline's own deadline for cold start, auth and
 * serializing the summary, so the run ends with a response instead of the
 * platform killing it at maxDuration.
 */
const PLATFORM_HEADROOM_MS = 1000;

validateRouteInitialization();

export const GET = createApiHandler(
  async (_req, { data }) => {
    const runResult = await new RunMaintenanceHandler().execute({
      batchSize: data.batch,
      deadlineMs: maxDuration * 1000 - PLATFORM_HEADROOM_MS,
    });

    if (!runResult.success) {
      return serviceFailureResponse(runResult, {
        logContext: "[maintenance] Invalid maintenance options:",
      });
    }

    const summary = runResult.data;

    // A partial run leaves work behind (buffered telemetry expires on a
    // rolling TTL), so it must not pass silently: log at error level, which
    // reaches Sentry, and answer 500 so the Vercel cron log records a failed
    // invocation. The summary still names every phase's outcome.
    if (summary.partial) {
      const incomplete = Object.entries(summary.phases)
        .filter(([, phase]) => phase.status !== "completed")
        .map(([name, phase]) => `${name}:${phase.status}`);
      logger.error(
        `[maintenance] Daily run did not complete: ${incomplete.join(", ")}`,
        undefined,
        { maintenanceSummary: summary }
      );
      return NextResponse.json(summary, { status: 500 });
    }

    return NextResponse.json(summary, { status: 200 });
  },
  { schema: SyncParamsSchema, type: "query", auth: "cron_secret" }
);
