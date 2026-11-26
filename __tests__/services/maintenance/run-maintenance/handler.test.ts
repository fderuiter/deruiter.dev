// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  RunMaintenanceHandler,
  createFailure,
  createSuccess,
  type MaintenanceAdapters,
  type RunMaintenanceDeps,
  type RunMaintenanceInput,
} from "@/lib/services";

describe("RunMaintenanceHandler (Logic Test)", () => {
  it("executes maintenance phases with injected adapters and reports partial failures cleanly", async () => {
    let tick = 1_000;
    const adapters = fromPartial<MaintenanceAdapters>({
      syncTelemetry: async () => createSuccess({ processed: 4, inserted: 4 }),
      dispatchNewsletter: async () =>
        createFailure("DISPATCH_FAILED", "Redis unreachable"),
      processEmailRetry: async () => {
        throw new Error("Unexpected retry crash");
      },
      runRetention: async () =>
        createSuccess({ rollupsUpserted: 2, rawEventsDeleted: 10 }),
    });

    const handler = new RunMaintenanceHandler({
      adapters,
      clock: () => {
        tick += 10;
        return tick;
      },
    });

    const result = await handler.execute({ batchSize: 100, deadlineMs: 8000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(false);
      expect(result.data.partial).toBe(true);
      expect(result.data.phases.telemetry.status).toBe("completed");
      expect(result.data.phases.newsletter.status).toBe("failed");
      expect(result.data.phases.emailRetry.status).toBe("failed");
    }
  });

  it("wires default production slice handlers and skips phases once deadline reserve is exhausted", async () => {
    const deps = fromPartial<RunMaintenanceDeps>({
      syncTelemetryHandler: {
        execute: async () => createSuccess({ processed: 2, inserted: 2 }),
      },
      flushCaseStudyReactionsHandler: {
        execute: async () => createSuccess({ processed: 1, inserted: 1 }),
      },
      flushBlogReactionsHandler: {
        execute: async () => createSuccess({ processed: 1, inserted: 1 }),
      },
      refreshTelemetryStatsHandler: {
        execute: async () =>
          createFailure("AGGREGATE_FAILED", "Non-fatal aggregate warning"),
      },
      dispatchNewsletterHandler: {
        execute: async () =>
          createSuccess({
            openDispatches: 0,
            queued: 0,
            skippedSuppressed: 0,
            completedDispatches: 0,
            capacity: 25,
          }),
      },
      processEmailRetryHandler: {
        execute: async () =>
          createSuccess({
            processed: 1,
            succeeded: 1,
            failed: 0,
            deferred: 0,
          }),
      },
      getEmailQueueHealthHandler: {
        execute: async () =>
          createSuccess({
            depth: 0,
            oldestPendingAgeMs: null,
            terminalFailures: 0,
            retryExhausted: 0,
            eligibilityDeferred: 0,
          }),
      },
      rollupTelemetryHandler: {
        execute: async () =>
          createSuccess({ rollupsUpserted: 1, rawEventsDeleted: 3 }),
      },
      clock: () => 5_000,
    });

    const handler = new RunMaintenanceHandler(deps);
    const fullRun = await handler.execute({ deadlineMs: 8_000 });
    expect(fullRun.success).toBe(true);
    if (fullRun.success) {
      expect(fullRun.data.success).toBe(true);
      expect(fullRun.data.phases.telemetry.status).toBe("completed");
      expect(fullRun.data.phases.emailRetry.status).toBe("completed");
      expect(fullRun.data.phases.retention.status).toBe("completed");
    }

    let jumpingClock = 1_000;
    const skippedRun = await handler.execute({
      deadlineMs: 500,
      clock: () => {
        jumpingClock += 1_000;
        return jumpingClock;
      },
    });
    expect(skippedRun.success).toBe(true);
    if (skippedRun.success) {
      expect(skippedRun.data.phases.telemetry.status).toBe("skipped");
    }
  });

  it("returns INVALID_INPUT failure on malformed batchSize", async () => {
    const handler = new RunMaintenanceHandler();
    const result = await handler.execute(
      fromPartial<RunMaintenanceInput>({ batchSize: Number.POSITIVE_INFINITY })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
