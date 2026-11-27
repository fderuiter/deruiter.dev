import { sanitizeError } from "@/lib/error-sanitization";
import { clamp } from "@/lib/game-utils";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { FlushBlogReactionsHandler } from "../../blog/flush-blog-reactions/handler";
import { FlushCaseStudyReactionsHandler } from "../../case-study/flush-case-study-reactions/handler";
import { GetRetryQueueHealthHandler } from "../../email/get-retry-queue-health/handler";
import { ProcessRetryQueueHandler } from "../../email/process-retry-queue/handler";
import { EMAIL_RETRY_BATCH_SIZE } from "../../email/shared";
import { DispatchNewsletterAnnouncementsHandler } from "../../newsletter/dispatch-due/handler";
import { RefreshTelemetryAggregateStatsHandler } from "../../telemetry/refresh-aggregate-stats/handler";
import { RollupAndPruneTelemetryHandler } from "../../telemetry/rollup-and-prune-events/handler";
import { SyncBufferedEventsHandler } from "../../telemetry/sync-buffered-events/handler";
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
  RunMaintenancePipelineInputSchema,
  type RunMaintenancePipelineInput,
  type RunMaintenancePipelineResult,
  type RunMaintenancePipelineSpec,
} from "./spec";

function formatResponseErrorMessage(error: unknown): string {
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
    const responseMessage = formatResponseErrorMessage(error);
    logger.warn(`[maintenance:${name}] ${responseMessage}`, error, {
      maintenancePhase: name,
    });
    return {
      status: timedOut ? "timed_out" : "failed",
      durationMs: Math.max(0, clock() - startedAt),
      counts: {},
      error: responseMessage,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface RunMaintenancePipelineDeps {
  createAdapters?: (batchSize: number) => MaintenanceAdapters;
}

function createDefaultProductionAdapters(
  batchSize: number
): MaintenanceAdapters {
  const syncTelemetryEvents = new SyncBufferedEventsHandler();
  const flushCaseStudyReactions = new FlushCaseStudyReactionsHandler();
  const flushBlogReactions = new FlushBlogReactionsHandler();
  const refreshAggregate = new RefreshTelemetryAggregateStatsHandler();
  const dispatchNewsletter = new DispatchNewsletterAnnouncementsHandler();
  const processEmailRetry = new ProcessRetryQueueHandler();
  const getRetryHealth = new GetRetryQueueHealthHandler();
  const rollupTelemetry = new RollupAndPruneTelemetryHandler();

  return {
    async syncTelemetry() {
      try {
        const telemetry = await syncTelemetryEvents.execute({ batchSize });
        if (!telemetry.success) return telemetry;

        const reactions = await flushCaseStudyReactions.execute({ batchSize });
        const blogReactions = await flushBlogReactions.execute({ batchSize });
        if (!reactions.success) return reactions;
        if (!blogReactions.success) return blogReactions;

        const aggregate = await refreshAggregate.execute();
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
      } catch (error) {
        return createFailure(
          "TELEMETRY_PHASE_FAILED",
          formatResponseErrorMessage(error),
          { recoverable: true, details: error }
        );
      }
    },
    async dispatchNewsletter(now) {
      try {
        return await dispatchNewsletter.execute({ now });
      } catch (error) {
        return createFailure(
          "NEWSLETTER_PHASE_FAILED",
          formatResponseErrorMessage(error),
          { recoverable: true, details: error }
        );
      }
    },
    async processEmailRetry(now) {
      try {
        const retry = await processEmailRetry.execute({
          maxBatchSize: EMAIL_RETRY_BATCH_SIZE,
          now,
        });
        if (!retry.success) return retry;

        const health = await getRetryHealth.execute({ now });
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
      } catch (error) {
        return createFailure(
          "EMAIL_RETRY_PHASE_FAILED",
          formatResponseErrorMessage(error),
          { recoverable: true, details: error }
        );
      }
    },
    async runRetention(now) {
      try {
        const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const telemetry = await rollupTelemetry.execute({ before: cutoff });
        if (!telemetry.success) return telemetry;
        return createSuccess({
          ...telemetry.data,
          providerExpiredKeysDeleted: 0,
        });
      } catch (error) {
        return createFailure(
          "RETENTION_PHASE_FAILED",
          formatResponseErrorMessage(error),
          { recoverable: true, details: error }
        );
      }
    },
  };
}

export class RunMaintenancePipelineHandler implements RunMaintenancePipelineSpec {
  private readonly createAdapters: (batchSize: number) => MaintenanceAdapters;

  constructor(deps: RunMaintenancePipelineDeps = {}) {
    this.createAdapters =
      deps.createAdapters ?? createDefaultProductionAdapters;
  }

  async execute(
    input: RunMaintenancePipelineInput = {}
  ): Promise<RunMaintenancePipelineResult> {
    const parsed = RunMaintenancePipelineInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_MAINTENANCE_INPUT",
        parsed.error.issues[0]?.message ?? "Invalid maintenance pipeline input",
        { recoverable: false, details: parsed.error.issues }
      );
    }

    try {
      const options = parsed.data;
      const clock = options.clock || Date.now;
      const startedAtMs = clock();
      const now = options.now || new Date(startedAtMs);
      const deadlineMs = clamp(
        options.deadlineMs || DEFAULT_MAINTENANCE_DEADLINE_MS,
        500,
        DEFAULT_MAINTENANCE_DEADLINE_MS
      );
      const deadlineAt = startedAtMs + deadlineMs;
      const batchSize = clamp(options.batchSize || 50, 1, 500);
      const adapters = options.adapters || this.createAdapters(batchSize);

      const phases = {} as Record<
        MaintenancePhaseName,
        MaintenancePhaseSummary
      >;
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
    } catch (error) {
      return createFailure(
        "MAINTENANCE_PIPELINE_FAILED",
        formatResponseErrorMessage(error),
        { recoverable: true, details: error }
      );
    }
  }
}
