import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "../../service-result";
import type { TelemetryAggregateStats } from "../shared";
import type {
  ComputeTelemetryAggregateStatsInput,
  ComputeTelemetryAggregateStatsResult,
  ComputeTelemetryAggregateStatsSpec,
} from "./spec";

export interface TelemetryAggregateTxPort {
  telemetryEvent: {
    groupBy(args: {
      by: ["projectSlug", "eventType"];
      where: { eventType: { in: string[] } };
      _count: { id: true };
    }): Promise<
      Array<{ projectSlug: string; eventType: string; _count: { id: number } }>
    >;
  };
  telemetryDailyRollup: {
    groupBy(args: {
      by: ["projectSlug", "eventType"];
      where: { eventType: { in: string[] } };
      _sum: { count: true };
    }): Promise<
      Array<{
        projectSlug: string;
        eventType: string;
        _sum: { count: number | null };
      }>
    >;
  };
}

export interface ComputeTelemetryAggregatePrismaPort {
  $transaction<T>(
    fn: (tx: TelemetryAggregateTxPort) => Promise<T>,
    options?: { isolationLevel?: "RepeatableRead" }
  ): Promise<T>;
}

export interface ComputeTelemetryAggregateStatsDeps {
  prisma?: ComputeTelemetryAggregatePrismaPort;
}

export class ComputeTelemetryAggregateStatsHandler implements ComputeTelemetryAggregateStatsSpec {
  private readonly db: ComputeTelemetryAggregatePrismaPort;

  constructor(deps?: ComputeTelemetryAggregateStatsDeps) {
    this.db =
      deps?.prisma ??
      (prisma as unknown as ComputeTelemetryAggregatePrismaPort);
  }

  async execute(
    _input?: ComputeTelemetryAggregateStatsInput
  ): Promise<ComputeTelemetryAggregateStatsResult> {
    const formattedStats: TelemetryAggregateStats = {};

    try {
      await this.db.$transaction(
        async (transaction) => {
          const [rawStats, rollupStats] = await Promise.all([
            transaction.telemetryEvent.groupBy({
              by: ["projectSlug", "eventType"],
              where: { eventType: { in: ["page_view", "project_click"] } },
              _count: { id: true },
            }),
            transaction.telemetryDailyRollup.groupBy({
              by: ["projectSlug", "eventType"],
              where: { eventType: { in: ["page_view", "project_click"] } },
              _sum: { count: true },
            }),
          ]);

          const addStats = (slug: string, eventType: string, count: number) => {
            if (eventType !== "page_view" && eventType !== "project_click") {
              return;
            }
            if (!formattedStats[slug]) {
              formattedStats[slug] = { views: 0, clicks: 0 };
            }
            if (eventType === "page_view") {
              formattedStats[slug].views += count;
            } else {
              formattedStats[slug].clicks += count;
            }
          };

          for (const item of rawStats) {
            addStats(item.projectSlug, item.eventType, item._count.id);
          }

          for (const item of rollupStats) {
            addStats(item.projectSlug, item.eventType, item._sum.count ?? 0);
          }
        },
        { isolationLevel: "RepeatableRead" }
      );

      return createSuccess(formattedStats);
    } catch (error) {
      return createFailure(
        "AGGREGATE_FAILED",
        "Failed to compute telemetry aggregate stats from database",
        { recoverable: true, details: error }
      );
    }
  }
}
