import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getScopedRedisKey, redis } from "@/lib/redis";
import { createFailure, createSuccess } from "../../service-result";
import {
  BUFFER_ENQUEUE_TIMEOUT_MS,
  type BufferedTelemetryEvent,
} from "../shared";
import {
  RecordTelemetryEventInputSchema,
  type RecordTelemetryEventInput,
  type RecordTelemetryEventResult,
  type RecordTelemetryEventSpec,
} from "./spec";

const ENQUEUE_TIMEOUT = Symbol("buffer-enqueue-timeout");

export interface TelemetryBufferPipelinePort {
  lpush(key: string, ...elements: unknown[]): unknown;
  expire(key: string, seconds: number): unknown;
  exec(): Promise<unknown[]>;
}

export interface RecordTelemetryEventRedisPort {
  pipeline(): TelemetryBufferPipelinePort;
}

export interface RecordTelemetryEventDeps {
  redis?: RecordTelemetryEventRedisPort;
  isPlaywrightTest?: () => boolean;
  randomUUID?: () => string;
}

export class RecordTelemetryEventHandler implements RecordTelemetryEventSpec {
  private readonly redisClient: RecordTelemetryEventRedisPort;
  private readonly isPlaywrightFn: () => boolean;
  private readonly uuidFn: () => string;

  constructor(deps?: RecordTelemetryEventDeps) {
    this.redisClient = deps?.redis ?? redis;
    this.isPlaywrightFn =
      deps?.isPlaywrightTest ?? (() => env.PLAYWRIGHT_TEST === "true");
    this.uuidFn = deps?.randomUUID ?? (() => crypto.randomUUID());
  }

  async execute(
    input: RecordTelemetryEventInput
  ): Promise<RecordTelemetryEventResult> {
    const parsed = RecordTelemetryEventInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid telemetry event payload", {
        recoverable: false,
        details: parsed.error,
      });
    }

    const eventData: BufferedTelemetryEvent = {
      id: this.uuidFn(),
      projectSlug: parsed.data.projectSlug,
      eventType: parsed.data.eventType,
      createdAt: new Date(),
    };

    if (this.isPlaywrightFn()) {
      return createSuccess({ event: eventData, buffered: true });
    }

    try {
      const bufferKey = getScopedRedisKey("telemetry_buffer");
      const p = this.redisClient.pipeline();
      p.lpush(bufferKey, eventData);
      p.expire(bufferKey, 48 * 60 * 60);

      let execTimer: ReturnType<typeof setTimeout> | undefined;
      const execTimeoutPromise = new Promise<typeof ENQUEUE_TIMEOUT>(
        (resolve) => {
          execTimer = setTimeout(
            () => resolve(ENQUEUE_TIMEOUT),
            BUFFER_ENQUEUE_TIMEOUT_MS
          );
          execTimer.unref?.();
        }
      );

      let raced: unknown[] | typeof ENQUEUE_TIMEOUT;
      try {
        raced = await Promise.race([p.exec(), execTimeoutPromise]);
      } finally {
        if (execTimer) clearTimeout(execTimer);
      }

      if (raced === ENQUEUE_TIMEOUT) {
        logger.warn(
          "Telemetry buffer enqueue timed out; event dropped (non-durable 202):",
          { timeoutMs: BUFFER_ENQUEUE_TIMEOUT_MS }
        );
        return createSuccess({ event: eventData, buffered: false });
      }

      const [listLength] = raced;
      if (Number(listLength) > 1000) {
        logger.error(
          "ALERT: Secondary telemetry buffer occupancy exceeds threshold."
        );
      }

      return createSuccess({ event: eventData, buffered: true });
    } catch (err) {
      logger.error("Failed to commit telemetry event to Redis buffer:", err);
      return createSuccess({ event: eventData, buffered: false });
    }
  }
}
