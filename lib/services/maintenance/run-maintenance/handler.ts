import { sanitizeError } from "@/lib/error-sanitization";
import { clamp } from "@/lib/game-utils";
import { logger } from "@/lib/logger";
import { FlushBlogReactionsHandler } from "@/lib/services/blog/flush-buffered-reactions/handler";
import type { FlushBlogReactionsSpec } from "@/lib/services/blog/flush-buffered-reactions/spec";
import { FlushCaseStudyReactionsHandler } from "@/lib/services/case-study/flush-buffered-reactions/handler";
import type { FlushCaseStudyReactionsSpec } from "@/lib/services/case-study/flush-buffered-reactions/spec";
import { GetEmailRetryQueueHealthHandler } from "@/lib/services/email/get-retry-queue-health/handler";
import type { GetEmailRetryQueueHealthSpec } from "@/lib/services/email/get-retry-queue-health/spec";
import { ProcessRetryQueueHandler } from "@/lib/services/email/process-retry-queue/handler";
import type { ProcessRetryQueueSpec } from "@/lib/services/email/process-retry-queue/spec";
import { EMAIL_RETRY_BATCH_SIZE } from "@/lib/services/email/shared";
import { DispatchDueNewsletterHandler } from "@/lib/services/newsletter/dispatch-due/handler";
import type { DispatchDueNewsletterSpec } from "@/lib/services/newsletter/dispatch-due/spec";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { RefreshTelemetryAggregateStatsHandler } from "@/lib/services/telemetry/refresh-aggregate-stats/handler";
import type { RefreshTelemetryAggregateStatsSpec } from "@/lib/services/telemetry/refresh-aggregate-stats/spec";
import { RollupAndPruneTelemetryEventsHandler } from "@/lib/services/telemetry/rollup-and-prune-events/handler";
import type { RollupAndPruneTelemetryEventsSpec } from "@/lib/services/telemetry/rollup-and-prune-events/spec";
import { SyncBufferedTelemetryEventsHandler } from "@/lib/services/telemetry/sync-buffered-events/handler";
import type { SyncBufferedTelemetryEventsSpec } from "@/lib/services/telemetry/sync-buffered-events/spec";
import {
  DEFAULT_MAINTENANCE_DEADLINE_MS,
  MAINTENANCE_RESPONSE_RESERVE_MS,
  type MaintenanceAdapters,
  type MaintenancePhaseName,
  type MaintenancePhaseResult,
  type MaintenancePhaseSummary,
  type MaintenanceSummary,
} from "../shared";
import {
  RunMaintenanceInputSchema,
  type RunMaintenanceInput,
  type RunMaintenanceResult,
  type RunMaintenanceSpec,
} from "./spec";

export interface RunMaintenanceDeps {
  syncTelemetryHandler?: SyncBufferedTelemetryEventsSpec;
  flushCaseStudyReactionsHandler?: FlushCaseStudyReactionsSpec;
  flushBlogReactionsHandler?: FlushBlogReactionsSpec;
  refreshTelemetryStatsHandler?: RefreshTelemetryAggregateStatsSpec;
  dispatchNewsletterHandler?: DispatchDueNewsletterSpec;
  processEmailRetryHandler?: ProcessRetryQueueSpec;
  getEmailQueueHealthHandler?: GetEmailRetryQueueHealthSpec;
  rollupTelemetryHandler?: RollupAndPruneTelemetryEventsSpec;
  adapters?: MaintenanceAdapters;
  clock?: () => number;
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
  const remainingMs = deadlineAt - startedAt - MAINTENANCE_RESPONSE_RESERVE_MS;
  if (remainingMs <= 0) {
    return { status: "skipped", durationMs: 0, counts: {} };
  }

  const deadlineError = new Error(`${name} phase exceeded its deadline`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(deadlineError), remainingMs);
        timer.unref?.();
      }),
    ]);
    if (!result.success) {
      const message = result.error.message || result.error.code;
      logger.warn(
        `[maintenance:${name}] ${result.error.code}: ${message}`,
        result.error.details,
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
    const timedOut = error === deadlineError;
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

/**
 * Handler for executing the bounded Vercel Hobby daily maintenance pipeline across telemetry,
 * newsletter dispatch, outbound email retry, and retention pruning phases.
 */
export class RunMaintenanceHandler implements RunMaintenanceSpec {
  private readonly syncTelemetryHandler: SyncBufferedTelemetryEventsSpec;
  private readonly flushCaseStudyReactionsHandler: FlushCaseStudyReactionsSpec;
  private readonly flushBlogReactionsHandler: FlushBlogReactionsSpec;
  private readonly refreshTelemetryStatsHandler: RefreshTelemetryAggregateStatsSpec;
  private readonly dispatchNewsletterHandler: DispatchDueNewsletterSpec;
  private readonly processEmailRetryHandler: ProcessRetryQueueSpec;
  private readonly getEmailQueueHealthHandler: GetEmailRetryQueueHealthSpec;
  private readonly rollupTelemetryHandler: RollupAndPruneTelemetryEventsSpec;
  private readonly defaultAdapters?: MaintenanceAdapters;
  private readonly defaultClock: () => number;

  constructor(deps: RunMaintenanceDeps = {}) {
    this.syncTelemetryHandler =
      deps.syncTelemetryHandler ?? new SyncBufferedTelemetryEventsHandler();
    this.flushCaseStudyReactionsHandler =
      deps.flushCaseStudyReactionsHandler ??
      new FlushCaseStudyReactionsHandler();
    this.flushBlogReactionsHandler =
      deps.flushBlogReactionsHandler ?? new FlushBlogReactionsHandler();
    this.refreshTelemetryStatsHandler =
      deps.refreshTelemetryStatsHandler ??
      new RefreshTelemetryAggregateStatsHandler();
    this.dispatchNewsletterHandler =
      deps.dispatchNewsletterHandler ?? new DispatchDueNewsletterHandler();
    this.processEmailRetryHandler =
      deps.processEmailRetryHandler ?? new ProcessRetryQueueHandler();
    this.getEmailQueueHealthHandler =
      deps.getEmailQueueHealthHandler ?? new GetEmailRetryQueueHealthHandler();
    this.rollupTelemetryHandler =
      deps.rollupTelemetryHandler ?? new RollupAndPruneTelemetryEventsHandler();
    this.defaultAdapters = deps.adapters;
    this.defaultClock = deps.clock ?? Date.now;
  }

  private createProductionAdapters(batchSize: number): MaintenanceAdapters {
    return {
      syncTelemetry: async () => {
        const telemetry = await this.syncTelemetryHandler.execute({
          batchSize,
        });
        if (!telemetry.success) return telemetry;

        const reactions = await this.flushCaseStudyReactionsHandler.execute({
          batchSize,
        });
        const blogReactions = await this.flushBlogReactionsHandler.execute({
          batchSize,
        });
        if (!reactions.success) return reactions;
        if (!blogReactions.success) return blogReactions;

        const aggregate = await this.refreshTelemetryStatsHandler.execute({});
        if (!aggregate.success) {
          logger.warn(
            `[maintenance:telemetry] ${aggregate.error.code}: ${aggregate.error.message}`,
            aggregate.error.details,
            { maintenancePhase: "telemetry", errorCode: aggregate.error.code }
          );
        }

        return createSuccess({
          aggregateProjects: aggregate.success ? aggregate.data.projects : null,
          processed: telemetry.data.processed,
          inserted: telemetry.data.inserted,
          reactionsProcessed: reactions.data.processed,
          reactionsInserted: reactions.data.inserted,
          blogReactionsProcessed: blogReactions.data.processed,
          blogReactionsInserted: blogReactions.data.inserted,
        });
      },
      dispatchNewsletter: async (now) => {
        return this.dispatchNewsletterHandler.execute({ now });
      },
      processEmailRetry: async (now) => {
        const retry = await this.processEmailRetryHandler.execute({
          maxBatchSize: EMAIL_RETRY_BATCH_SIZE,
          now,
        });
        if (!retry.success) return retry;

        const health = await this.getEmailQueueHealthHandler.execute({ now });
        if (!health.success) return health;

        return createSuccess({
          processed: retry.data.processed,
          succeeded: retry.data.succeeded,
          failed: retry.data.failed,
          deferred: retry.data.deferred,
          queueDepth: health.data.depth,
          oldestPendingAgeMs: health.data.oldestPendingAgeMs,
          terminalFailures: health.data.terminalFailures,
          retryExhausted: health.data.retryExhausted,
          eligibilityDeferred: health.data.eligibilityDeferred,
        });
      },
      runRetention: async (now) => {
        const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const telemetry = await this.rollupTelemetryHandler.execute({
          before: cutoff,
        });
        if (!telemetry.success) return telemetry;

        return createSuccess({
          ...telemetry.data,
          providerExpiredKeysDeleted: 0,
        });
      },
    };
  }

  async execute(
    input: RunMaintenanceInput = {}
  ): Promise<RunMaintenanceResult> {
    const parsed = RunMaintenanceInputSchema.safeParse({
      batchSize: input.batchSize,
      deadlineMs: input.deadlineMs,
      now: input.now,
    });
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid maintenance options",
        { recoverable: false, details: parsed.error }
      );
    }

    const clock = input.clock || this.defaultClock;
    const startedAtMs = clock();
    const now = parsed.data.now || new Date(startedAtMs);
    const deadlineMs = clamp(
      parsed.data.deadlineMs || DEFAULT_MAINTENANCE_DEADLINE_MS,
      500,
      DEFAULT_MAINTENANCE_DEADLINE_MS
    );
    const deadlineAt = startedAtMs + deadlineMs;
    const batchSize = clamp(parsed.data.batchSize || 50, 1, 500);
    const adapters =
      input.adapters ||
      this.defaultAdapters ||
      this.createProductionAdapters(batchSize);

    const phases = {} as Record<MaintenancePhaseName, MaintenancePhaseSummary>;
    phases.telemetry = await runBoundedPhase(
      "telemetry",
      () => adapters.syncTelemetry(batchSize),
      deadlineAt,
      clock
    );
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
    return createSuccess(summary);
  }
}
