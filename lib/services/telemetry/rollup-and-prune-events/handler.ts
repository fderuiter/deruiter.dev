import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  RollupAndPruneTelemetryEventsInputSchema,
  type RollupAndPruneTelemetryEventsInput,
  type RollupAndPruneTelemetryEventsResult,
  type RollupAndPruneTelemetryEventsSpec,
} from "./spec";

export interface TelemetryRetentionTxLike {
  $executeRaw(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<number>;
}

export interface TelemetryRetentionDbLike {
  $transaction<T>(fn: (tx: TelemetryRetentionTxLike) => Promise<T>): Promise<T>;
}

export interface RollupAndPruneTelemetryEventsDeps {
  db?: TelemetryRetentionDbLike;
}

/**
 * Handler for rolling raw telemetry events into TelemetryDailyRollup and deleting pruned rows in one transaction.
 */
export class RollupAndPruneTelemetryEventsHandler implements RollupAndPruneTelemetryEventsSpec {
  private readonly db: TelemetryRetentionDbLike;

  constructor(deps: RollupAndPruneTelemetryEventsDeps = {}) {
    this.db = deps.db ?? (prisma as unknown as TelemetryRetentionDbLike);
  }

  async execute(
    input: RollupAndPruneTelemetryEventsInput
  ): Promise<RollupAndPruneTelemetryEventsResult> {
    const parsed = RollupAndPruneTelemetryEventsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid cutoff date",
        { recoverable: false, details: parsed.error }
      );
    }

    const { before } = parsed.data;
    try {
      const counts = await this.db.$transaction(async (transaction) => {
        const rollupsUpserted = await transaction.$executeRaw`
          INSERT INTO "TelemetryDailyRollup"
            ("day", "projectSlug", "eventType", "count", "createdAt", "updatedAt")
          SELECT
            date_trunc('day', "createdAt")::date,
            "projectSlug",
            "eventType",
            COUNT(*)::integer,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          FROM "TelemetryEvent"
          WHERE "createdAt" < ${before}
          GROUP BY date_trunc('day', "createdAt")::date, "projectSlug", "eventType"
          ON CONFLICT ("day", "projectSlug", "eventType")
          DO UPDATE SET
            "count" = "TelemetryDailyRollup"."count" + EXCLUDED."count",
            "updatedAt" = CURRENT_TIMESTAMP
        `;

        const rawEventsDeleted = await transaction.$executeRaw`
          DELETE FROM "TelemetryEvent" WHERE "createdAt" < ${before}
        `;

        return { rollupsUpserted, rawEventsDeleted };
      });
      return createSuccess(counts);
    } catch (error) {
      return createFailure(
        "RETENTION_FAILED",
        "Telemetry rollup and prune transaction failed",
        { details: error }
      );
    }
  }
}
