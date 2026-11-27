import { prisma } from "@/lib/db";
import { createFailure, createSuccess } from "../../service-result";
import {
  RollupAndPruneTelemetryInputSchema,
  type RollupAndPruneTelemetryInput,
  type RollupAndPruneTelemetryResult,
  type RollupAndPruneTelemetrySpec,
} from "./spec";

export interface RollupAndPruneTxPort {
  $executeRaw(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<number>;
}

export interface RollupAndPrunePrismaPort {
  $transaction<T>(fn: (tx: RollupAndPruneTxPort) => Promise<T>): Promise<T>;
}

export interface RollupAndPruneTelemetryDeps {
  prisma?: RollupAndPrunePrismaPort;
}

export class RollupAndPruneTelemetryHandler implements RollupAndPruneTelemetrySpec {
  private readonly db: RollupAndPrunePrismaPort;

  constructor(deps?: RollupAndPruneTelemetryDeps) {
    this.db = deps?.prisma ?? (prisma as unknown as RollupAndPrunePrismaPort);
  }

  async execute(
    input: RollupAndPruneTelemetryInput
  ): Promise<RollupAndPruneTelemetryResult> {
    const parsed = RollupAndPruneTelemetryInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "RETENTION_FAILED",
        "Invalid telemetry retention cutoff date",
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
