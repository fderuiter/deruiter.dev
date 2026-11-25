import { NextResponse } from "next/server";
import { validateRouteInitialization } from "@/lib/security";
import { SyncParamsSchema } from "@/lib/schemas";
import { RunMaintenancePipelineHandler } from "@/lib/services";
import {
  createApiHandler,
  serviceFailureResponse,
  zodIssueDetails,
} from "@/lib/route-wrapper";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

validateRouteInitialization();

export const GET = createApiHandler(
  async (req) => {
    try {
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

      const pipelineResult = await new RunMaintenancePipelineHandler().execute({
        batchSize: parsedQuery.data.batch,
      });
      if (!pipelineResult.success) {
        return serviceFailureResponse(pipelineResult);
      }

      const summary = pipelineResult.data;
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
    } catch (err) {
      logger.error("Failed to sync buffered telemetry events:", err);
      return NextResponse.json(
        { error: "Failed to sync events to primary database" },
        { status: 500 }
      );
    }
  },
  { auth: "cron_secret" }
);
