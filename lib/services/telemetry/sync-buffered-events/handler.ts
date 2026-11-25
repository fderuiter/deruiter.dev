import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import type { BufferedTelemetryEvent } from "../shared";
import {
  SyncBufferedTelemetryEventsInputSchema,
  type SyncBufferedTelemetryEventsInput,
  type SyncBufferedTelemetryEventsResult,
  type SyncBufferedTelemetryEventsSpec,
} from "./spec";

export interface TelemetrySyncPipelineLike {
  lmove(
    source: string,
    destination: string,
    whereFrom: "left" | "right",
    whereTo: "left" | "right"
  ): unknown;
  expire(key: string, seconds: number): unknown;
  lrem(key: string, count: number, element: unknown): unknown;
  exec(): Promise<unknown[]>;
}

export interface TelemetrySyncRedisLike {
  lrange<T = unknown>(key: string, start: number, stop: number): Promise<T[]>;
  pipeline(): TelemetrySyncPipelineLike;
}

export interface TelemetrySyncDbLike {
  telemetryEvent: {
    createMany(args: {
      data: Array<{
        id: string;
        projectSlug: string;
        eventType: string;
        createdAt: Date;
      }>;
      skipDuplicates: boolean;
    }): Promise<{ count: number }>;
  };
}

export interface SyncBufferedTelemetryEventsDeps {
  redisClient?: TelemetrySyncRedisLike;
  db?: TelemetrySyncDbLike;
}

/**
 * Handler for draining buffered telemetry events from Redis via atomic LMOVE and persisting to PostgreSQL.
 */
export class SyncBufferedTelemetryEventsHandler implements SyncBufferedTelemetryEventsSpec {
  private readonly redisClient: TelemetrySyncRedisLike;
  private readonly db: TelemetrySyncDbLike;

  constructor(deps: SyncBufferedTelemetryEventsDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.db = deps.db ?? prisma;
  }

  async execute(
    input: SyncBufferedTelemetryEventsInput
  ): Promise<SyncBufferedTelemetryEventsResult> {
    const parsed = SyncBufferedTelemetryEventsInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid batch size",
        { recoverable: false, details: parsed.error }
      );
    }

    const { batchSize } = parsed.data;
    const bufferKey = getScopedRedisKey("telemetry_buffer");
    const processingKey = getScopedRedisKey("telemetry_processing");

    let events: BufferedTelemetryEvent[];
    try {
      const existingProcessing =
        await this.redisClient.lrange<BufferedTelemetryEvent>(
          processingKey,
          0,
          -1
        );
      events = Array.isArray(existingProcessing) ? existingProcessing : [];

      if (events.length < batchSize) {
        const needed = batchSize - events.length;
        const p = this.redisClient.pipeline();
        for (let i = 0; i < needed; i++) {
          p.lmove(bufferKey, processingKey, "right", "left");
        }
        p.expire(processingKey, 48 * 60 * 60);
        const moveResults = await p.exec();

        const newlyMoved = moveResults.filter(
          (item): item is BufferedTelemetryEvent =>
            item !== null && typeof item === "object" && "id" in item
        );

        events = [...events, ...newlyMoved];
      }
    } catch (queueErr) {
      return createFailure(
        "QUEUE_UNAVAILABLE",
        "Telemetry buffer could not be read from Redis",
        { details: queueErr }
      );
    }

    if (events.length === 0) {
      return createSuccess({ processed: 0, inserted: 0 });
    }

    let createResult: { count: number };
    try {
      createResult = await this.db.telemetryEvent.createMany({
        data: events.map((e) => ({
          id: e.id,
          projectSlug: e.projectSlug,
          eventType: e.eventType,
          createdAt: new Date(e.createdAt),
        })),
        skipDuplicates: true,
      });
    } catch (dbErr) {
      logger.warn(
        "Primary database write failed during sync. Telemetry event batch remains intact in processing queue.",
        dbErr
      );
      return createFailure(
        "PERSISTENCE_FAILED",
        "Telemetry batch could not be written to the database",
        { details: dbErr }
      );
    }

    try {
      const ack = this.redisClient.pipeline();
      for (const event of events) {
        ack.lrem(processingKey, 1, event);
      }
      await ack.exec();
    } catch (ackErr) {
      return createFailure(
        "ACKNOWLEDGEMENT_FAILED",
        "Telemetry batch was persisted but not acknowledged; the next run replays it idempotently",
        { details: ackErr }
      );
    }

    return createSuccess({
      processed: events.length,
      inserted: createResult.count,
    });
  }
}
