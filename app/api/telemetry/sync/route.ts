import { NextResponse } from "next/server";
import { validateRouteInitialization } from "@/lib/security";
import { SyncParamsSchema } from "@/lib/schemas";
import { RunMaintenanceHandler } from "@/lib/services";
import {
  createApiHandler,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";

export const dynamic = "force-dynamic";

validateRouteInitialization();

export const GET = createApiHandler(
  async (req) => {
    const url = new URL(req.url);
    const batchParam = url.searchParams.get("batch");
    const parsedQuery = SyncParamsSchema.safeParse({
      batch: batchParam !== null ? batchParam : undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: zodIssueDetails(parsedQuery.error),
        },
        { status: 400 }
      );
    }

    const runResult = await new RunMaintenanceHandler().execute({
      batchSize: parsedQuery.data.batch,
    });

    if (!runResult.success) {
      return serviceFailureResponse(runResult, {
        errorMessage: "Failed to sync events to primary database",
        logContext: "Failed to sync buffered telemetry events:",
      });
    }

    const summary = runResult.data;
    const telemetry = summary.phases.telemetry;

    if (telemetry.status !== "completed") {
      return NextResponse.json(
        {
          error: "Failed to sync events to primary database",
          maintenance: summary,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      processed: telemetry.counts.processed || 0,
      inserted: telemetry.counts.inserted || 0,
      reactions: {
        processed: telemetry.counts.reactionsProcessed || 0,
        inserted: telemetry.counts.reactionsInserted || 0,
      },
      maintenance: summary,
    });
  },
  { auth: "cron_secret" }
);
