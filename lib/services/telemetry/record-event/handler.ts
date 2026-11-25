import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  BUFFER_ENQUEUE_TIMEOUT_MS,
  BufferEnqueueTimeoutError,
  type BufferedTelemetryEvent,
} from "../shared";
import {
  RecordTelemetryEventInputSchema,
  type RecordTelemetryEventInput,
  type RecordTelemetryEventResult,
  type RecordTelemetryEventSpec,
} from "./spec";

export interface TelemetryBufferPipelineLike {
  lpush(key: string, value: BufferedTelemetryEvent): unknown;
  expire(key: string, seconds: number): unknown;
  exec(): Promise<unknown[]>;
}

export interface TelemetryBufferRedisLike {
  pipeline(): TelemetryBufferPipelineLike;
}

export interface RecordTelemetryEventDeps {
  redisClient?: TelemetryBufferRedisLike;
  idGenerator?: () => string;
  now?: () => Date;
  timeoutMs?: number;
}

/**
 * Handler for pushing an interaction telemetry event into the Upstash Redis buffer queue.
 * Reports `buffered: false` when Redis times out or fails so callers return a non-durable 202.
 */
export class RecordTelemetryEventHandler implements RecordTelemetryEventSpec {
  private readonly redisClient: TelemetryBufferRedisLike;
  private readonly idGenerator: () => string;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(deps: RecordTelemetryEventDeps = {}) {
    this.redisClient = deps.redisClient ?? redis;
    this.idGenerator = deps.idGenerator ?? (() => crypto.randomUUID());
    this.now = deps.now ?? (() => new Date());
    this.timeoutMs = deps.timeoutMs ?? BUFFER_ENQUEUE_TIMEOUT_MS;
  }

  async execute(
    input: RecordTelemetryEventInput
  ): Promise<RecordTelemetryEventResult> {
    const parsed = RecordTelemetryEventInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid telemetry event input",
        { recoverable: false, details: parsed.error }
      );
    }

    try {
      const eventData: BufferedTelemetryEvent = {
        id: this.idGenerator(),
        projectSlug: parsed.data.projectSlug,
        eventType: parsed.data.eventType,
        createdAt: this.now(),
      };

      if (env.PLAYWRIGHT_TEST === "true") {
        return createSuccess({ event: eventData, buffered: true });
      }

      try {
        const bufferKey = getScopedRedisKey("telemetry_buffer");
        const p = this.redisClient.pipeline();
        p.lpush(bufferKey, eventData);
        p.expire(bufferKey, 48 * 60 * 60);

        let execTimer: ReturnType<typeof setTimeout> | undefined;
        const execTimeoutPromise = new Promise<never>((_, reject) => {
          execTimer = setTimeout(() => {
            reject(new BufferEnqueueTimeoutError(this.timeoutMs));
          }, this.timeoutMs);
          execTimer.unref?.();
        });

        let listLength: unknown;
        try {
          const [len] = await Promise.race([p.exec(), execTimeoutPromise]);
          listLength = len;
        } finally {
          if (execTimer) clearTimeout(execTimer);
        }

        if (Number(listLength) > 1000) {
          logger.error(
            "ALERT: Secondary telemetry buffer occupancy exceeds threshold."
          );
        }
      } catch (err) {
        if (err instanceof BufferEnqueueTimeoutError) {
          logger.warn(
            "Telemetry buffer enqueue timed out; event dropped (non-durable 202):",
            { timeoutMs: this.timeoutMs }
          );
          return createSuccess({ event: eventData, buffered: false });
        }
        logger.error("Failed to commit telemetry event to Redis buffer:", err);
        return createSuccess({ event: eventData, buffered: false });
      }

      return createSuccess({ event: eventData, buffered: true });
    } catch (error) {
      return createFailure(
        "RECORD_EVENT_FAILED",
        "Failed to record telemetry interaction event",
        { recoverable: true, details: error }
      );
    }
  }
}
