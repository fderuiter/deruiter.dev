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

export interface MaintenanceAdapters {
  syncTelemetry(batchSize: number): Promise<Record<string, number | null>>;
  dispatchNewsletter(now: Date): Promise<Record<string, number | null>>;
  processEmailRetry(now: Date): Promise<Record<string, number | null>>;
  runRetention(now: Date): Promise<Record<string, number | null>>;
}

function errorMessage(error: unknown): string {
  const sanitized = sanitizeError(error);
  return sanitized instanceof Error
    ? sanitized.message || sanitized.name
    : "Unknown maintenance phase error";
}

async function runBoundedPhase(
  name: MaintenancePhaseName,
  task: () => Promise<Record<string, number | null>>,
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
    const counts = await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${name} phase exceeded its deadline`)),
          remainingMs
        );
        timer.unref?.();
      }),
    ]);
    return {
      status: "completed",
      durationMs: Math.max(0, clock() - startedAt),
      counts,
    };
  } catch (error) {
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
      const reactions =
        await CaseStudyService.flushBufferedReactionsToDatabase(batchSize);
      const blogReactions =
        await BlogPostService.flushBufferedReactionsToDatabase(batchSize);
      return {
        processed: telemetry.processed,
        inserted: telemetry.inserted,
        reactionsProcessed: reactions.processed,
        reactionsInserted: reactions.inserted,
        blogReactionsProcessed: blogReactions.processed,
        blogReactionsInserted: blogReactions.inserted,
      };
    },
    async dispatchNewsletter(now) {
      return NewsletterService.dispatchDue(now);
    },
    async processEmailRetry(now) {
      const retry = await EmailService.processRetryQueue({
        maxBatchSize: EMAIL_RETRY_BATCH_SIZE,
        now,
      });
      const health = await EmailService.getRetryQueueHealth(now);
      return {
        processed: retry.processed,
        succeeded: retry.succeeded,
        failed: retry.failed,
        queueDepth: health.depth,
        oldestPendingAgeMs: health.oldestPendingAgeMs,
        terminalFailures: health.terminalFailures,
        retryExhausted: health.retryExhausted,
      };
    },
    async runRetention(now) {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const telemetry = await TelemetryService.rollupAndPruneRawEvents(cutoff);
      return {
        ...telemetry,
        // Upstash removes rate-limit and other volatile keys at their TTL on
        // the provider. Scanning already-expired keys would add commands but
        // cannot find keys Redis has removed, so the bounded job records zero.
        providerExpiredKeysDeleted: 0,
      };
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
