import { logger } from "@/lib/logger";
import { clamp } from "@/lib/game-utils";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { BlogPostService } from "@/lib/services/blog-service";
import {
  EmailService,
  EMAIL_RETRY_BATCH_SIZE,
} from "@/lib/services/email-service";
import { NewsletterService } from "@/lib/services/newsletter-service";
import { TelemetryService } from "@/lib/services/telemetry-service";
import { sanitizeError } from "@/lib/error-sanitization";
import {
  createSuccess,
  type ServiceResult,
} from "@/lib/services/service-result";

const DEFAULT_DEADLINE_MS = 8000;
const RESPONSE_RESERVE_MS = 250;

export type MaintenancePhaseName =
  "telemetry" | "newsletter" | "emailRetry" | "retention";
export type MaintenancePhaseStatus =
  "completed" | "failed" | "timed_out" | "skipped";

export interface MaintenancePhaseSummary {
  status: MaintenancePhaseStatus;
  durationMs: number;
  counts: Record<string, number | null>;
  error?: string;
}

export interface MaintenanceSummary {
  success: boolean;
  partial: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  deadlineMs: number;
  phases: Record<MaintenancePhaseName, MaintenancePhaseSummary>;
}

/** Counts one maintenance phase reports. */
export type MaintenancePhaseCounts = Record<string, number | null>;

/**
 * Result envelope an adapter returns for one phase. The error code is the
 * underlying service's code (for example `PERSISTENCE_FAILED`), so a failure
 * keeps the service's own taxonomy.
 */
export type MaintenancePhaseResult = ServiceResult<MaintenancePhaseCounts>;

export interface MaintenanceAdapters {
  syncTelemetry(batchSize: number): Promise<MaintenancePhaseResult>;
  dispatchNewsletter(now: Date): Promise<MaintenancePhaseResult>;
  processEmailRetry(now: Date): Promise<MaintenancePhaseResult>;
  runRetention(now: Date): Promise<MaintenancePhaseResult>;
}

function errorMessage(error: unknown): string {
  const sanitized = sanitizeError(error);
  return sanitized instanceof Error
    ? sanitized.message || sanitized.name
    : "Unknown maintenance phase error";
}

async function runBoundedPhase(
  name: MaintenancePhaseName,
  task: () => Promise<MaintenancePhaseResult>,
  deadlineAt: number,
  clock: () => number
): Promise<MaintenancePhaseSummary> {
  const startedAt = clock();
  const remainingMs = deadlineAt - startedAt - RESPONSE_RESERVE_MS;
  if (remainingMs <= 0) {
    return { status: "skipped", durationMs: 0, counts: {} };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${name} phase exceeded its deadline`)),
          remainingMs
        );
        timer.unref?.();
      }),
    ]);
    if (!result.success) {
      const message = result.error.message || result.error.code;
      logger.warn(
        `[maintenance:${name}] ${result.error.code}: ${message}`,
        sanitizeError(result.error.details),
        { maintenancePhase: name, errorCode: result.error.code }
      );
      return {
        status: "failed",
        durationMs: Math.max(0, clock() - startedAt),
        counts: {},
        error: message,
      };
    }
    return {
      status: "completed",
      durationMs: Math.max(0, clock() - startedAt),
      counts: result.data,
    };
  } catch (error) {
    // Deadline rejections, and throws from reads that are not on
    // ServiceResult (the email queue health query).
    const timedOut = clock() >= deadlineAt - RESPONSE_RESERVE_MS;
    logger.warn(`[maintenance:${name}] ${errorMessage(error)}`, error, {
      maintenancePhase: name,
    });
    return {
      status: timedOut ? "timed_out" : "failed",
      durationMs: Math.max(0, clock() - startedAt),
      counts: {},
      error: errorMessage(error),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function createProductionAdapters(batchSize: number): MaintenanceAdapters {
  return {
    async syncTelemetry() {
      const telemetry = await TelemetryService.syncBufferedEvents(batchSize);
      if (!telemetry.success) return telemetry;
      // Both reaction queues drain even when one fails; the phase then
      // reports the first failure.
      const reactions =
        await CaseStudyService.flushBufferedReactionsToDatabase(batchSize);
      const blogReactions =
        await BlogPostService.flushBufferedReactionsToDatabase(batchSize);
      if (!reactions.success) return reactions;
      if (!blogReactions.success) return blogReactions;
      return createSuccess({
        processed: telemetry.data.processed,
        inserted: telemetry.data.inserted,
        reactionsProcessed: reactions.data.processed,
        reactionsInserted: reactions.data.inserted,
        blogReactionsProcessed: blogReactions.data.processed,
        blogReactionsInserted: blogReactions.data.inserted,
      });
    },
    async dispatchNewsletter(now) {
      return NewsletterService.dispatchDue(now);
    },
    async processEmailRetry(now) {
      const retry = await EmailService.processRetryQueue({
        maxBatchSize: EMAIL_RETRY_BATCH_SIZE,
        now,
      });
      if (!retry.success) return retry;
      const health = await EmailService.getRetryQueueHealth(now);
      return createSuccess({
        processed: retry.data.processed,
        succeeded: retry.data.succeeded,
        failed: retry.data.failed,
        queueDepth: health.depth,
        oldestPendingAgeMs: health.oldestPendingAgeMs,
        terminalFailures: health.terminalFailures,
        retryExhausted: health.retryExhausted,
      });
    },
    async runRetention(now) {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const telemetry = await TelemetryService.rollupAndPruneRawEvents(cutoff);
      if (!telemetry.success) return telemetry;
      return createSuccess({
        ...telemetry.data,
        // Upstash removes rate-limit and other volatile keys at their TTL on
        // the provider. Scanning already-expired keys would add commands but
        // cannot find keys Redis has removed, so the bounded job records zero.
        providerExpiredKeysDeleted: 0,
      });
    },
  };
}

/**
 * Deep module for the single Vercel Hobby maintenance invocation. It isolates
 * phase failures, returns partial progress, and reserves response time before
 * the platform's ten-second function limit.
 */
export class MaintenanceService {
  static async run(options?: {
    batchSize?: number;
    deadlineMs?: number;
    now?: Date;
    clock?: () => number;
    adapters?: MaintenanceAdapters;
  }): Promise<MaintenanceSummary> {
    const clock = options?.clock || Date.now;
    const startedAtMs = clock();
    const now = options?.now || new Date(startedAtMs);
    const deadlineMs = clamp(
      options?.deadlineMs || DEFAULT_DEADLINE_MS,
      500,
      DEFAULT_DEADLINE_MS
    );
    const deadlineAt = startedAtMs + deadlineMs;
    const batchSize = clamp(options?.batchSize || 50, 1, 500);
    const adapters = options?.adapters || createProductionAdapters(batchSize);

    const phases = {} as Record<MaintenancePhaseName, MaintenancePhaseSummary>;
    phases.telemetry = await runBoundedPhase(
      "telemetry",
      () => adapters.syncTelemetry(batchSize),
      deadlineAt,
      clock
    );
    // Before emailRetry, so announcements queued now go out in this run.
    phases.newsletter = await runBoundedPhase(
      "newsletter",
      () => adapters.dispatchNewsletter(now),
      deadlineAt,
      clock
    );
    phases.emailRetry = await runBoundedPhase(
      "emailRetry",
      () => adapters.processEmailRetry(now),
      deadlineAt,
      clock
    );
    phases.retention = await runBoundedPhase(
      "retention",
      () => adapters.runRetention(now),
      deadlineAt,
      clock
    );

    const completedAtMs = clock();
    const partial = Object.values(phases).some(
      (phase) => phase.status !== "completed"
    );
    const summary: MaintenanceSummary = {
      success: !partial,
      partial,
      startedAt: new Date(startedAtMs).toISOString(),
      completedAt: new Date(completedAtMs).toISOString(),
      durationMs: Math.max(0, completedAtMs - startedAtMs),
      deadlineMs,
      phases,
    };

    logger.info(`[maintenance:summary] ${JSON.stringify(summary)}`);
    return summary;
  }
}
