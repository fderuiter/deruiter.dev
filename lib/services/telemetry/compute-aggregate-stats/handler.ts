import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { TelemetryAggregateStats } from "../shared";
import {
  ComputeTelemetryAggregateStatsInputSchema,
  type ComputeTelemetryAggregateStatsInput,
  type ComputeTelemetryAggregateStatsResult,
  type ComputeTelemetryAggregateStatsSpec,
} from "./spec";

export interface TelemetryAggregateDbTransaction {
  telemetryEvent: {
    groupBy(args: {
      by: ["projectSlug", "eventType"];
      where: { eventType: { in: string[] } };
      _count: { id: true };
    }): Promise<
      Array<{
        projectSlug: string;
        eventType: string;
        _count: { id: number };
      }>
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

export interface ComputeTelemetryAggregateStatsDbLike {
  $transaction<T>(
    fn: (tx: TelemetryAggregateDbTransaction) => Promise<T>,
    options?: { isolationLevel?: "RepeatableRead" }
  ): Promise<T>;
}

export interface ComputeTelemetryAggregateStatsDeps {
  db?: ComputeTelemetryAggregateStatsDbLike;
}

/**
 * Handler for computing aggregate views and clicks from PostgreSQL raw events and rollups.
 * Invoked exclusively by scheduled maintenance, never on public visitor read paths.
 */
export class ComputeTelemetryAggregateStatsHandler implements ComputeTelemetryAggregateStatsSpec {
  private readonly db: ComputeTelemetryAggregateStatsDbLike;

  constructor(deps: ComputeTelemetryAggregateStatsDeps = {}) {
    this.db =
      deps.db ?? (prisma as unknown as ComputeTelemetryAggregateStatsDbLike);
  }

  async execute(
    input: ComputeTelemetryAggregateStatsInput = {}
  ): Promise<ComputeTelemetryAggregateStatsResult> {
    const parsed = ComputeTelemetryAggregateStatsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        "Invalid aggregate computation input",
        { recoverable: false, details: parsed.error }
      );
    }

    try {
      const formattedStats: TelemetryAggregateStats = {};

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
        "Failed to compute telemetry aggregate statistics from database",
        { recoverable: true, details: error }
      );
    }
  }
}
