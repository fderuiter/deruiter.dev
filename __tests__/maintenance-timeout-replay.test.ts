// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MaintenanceService,
  type MaintenanceAdapters,
  type MaintenancePhaseResult,
} from "@/lib/services/maintenance-service";
import { createSuccess } from "@/lib/services/service-result";

/**
 * A bounded phase stops waiting at its deadline, but Promise.race does not
 * cancel the task (#3809). These tests drive the coordinator with fake timers
 * and synthetic adapters to pin what a timed-out phase may and may not claim.
 */

interface Deferred {
  promise: Promise<MaintenancePhaseResult>;
  resolve: (value: MaintenancePhaseResult) => void;
  reject: (error: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: Deferred["resolve"];
  let reject!: Deferred["reject"];
  const promise = new Promise<MaintenancePhaseResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function quickAdapters(
  overrides: Partial<MaintenanceAdapters> = {}
): MaintenanceAdapters {
  return {
    syncTelemetry: vi.fn(async () => createSuccess({ processed: 1 })),
    dispatchNewsletter: vi.fn(async () => createSuccess({ queued: 0 })),
    processEmailRetry: vi.fn(async () => createSuccess({ processed: 0 })),
    runRetention: vi.fn(async () => createSuccess({ rawEventsDeleted: 0 })),
    ...overrides,
  };
}

describe("maintenance phases that outlive their deadline (#3809)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports a slow phase as timed out with no counts, and skips every later phase", async () => {
    const slow = deferred();
    const later = quickAdapters({ syncTelemetry: () => slow.promise });
    const run = MaintenanceService.run({ deadlineMs: 1000, adapters: later });

    await vi.advanceTimersByTimeAsync(750);
    const summary = await run;

    expect(summary.success).toBe(false);
    expect(summary.partial).toBe(true);
    expect(summary.phases.telemetry).toMatchObject({
      status: "timed_out",
      counts: {},
    });
    // The deadline fires at the response reserve, so no later phase starts
    // while the slow one may still be writing.
    expect(summary.phases.newsletter.status).toBe("skipped");
    expect(summary.phases.emailRetry.status).toBe("skipped");
    expect(summary.phases.retention.status).toBe("skipped");
    expect(later.dispatchNewsletter).not.toHaveBeenCalled();
    expect(later.processEmailRetry).not.toHaveBeenCalled();
    expect(later.runRetention).not.toHaveBeenCalled();
  });

  it("a late completion cannot change the summary already returned", async () => {
    const slow = deferred();
    const run = MaintenanceService.run({
      deadlineMs: 1000,
      adapters: quickAdapters({ syncTelemetry: () => slow.promise }),
    });
    await vi.advanceTimersByTimeAsync(750);
    const summary = await run;
    const snapshot = structuredClone(summary);

    slow.resolve(createSuccess({ processed: 50, inserted: 50 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(summary).toEqual(snapshot);
    expect(summary.phases.telemetry.counts).toEqual({});
  });

  it("a late rejection after the deadline is absorbed, not left unhandled", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const slow = deferred();
      const run = MaintenanceService.run({
        deadlineMs: 1000,
        adapters: quickAdapters({ syncTelemetry: () => slow.promise }),
      });
      await vi.advanceTimersByTimeAsync(750);
      await run;

      slow.reject(new Error("write cut short"));
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("classifies a deadline by the timer, even when the injected clock has not moved", async () => {
    // The clock a caller injects can lag the timers. A phase whose deadline
    // fired is still running, so it must read as timed out, never as an
    // established failure.
    const slow = deferred();
    const run = MaintenanceService.run({
      deadlineMs: 1000,
      clock: () => 1_000_000,
      adapters: quickAdapters({ syncTelemetry: () => slow.promise }),
    });
    await vi.advanceTimersByTimeAsync(750);
    const summary = await run;

    expect(summary.phases.telemetry.status).toBe("timed_out");
  });

  it("reports a phase's own error as failed, even when it arrives after the deadline window", async () => {
    // Synchronous work can hold the event loop past the deadline, so the
    // task's own rejection settles before the timer runs. The task finished,
    // so the outcome is known: it failed.
    let now = 1_000_000;
    const summary = await MaintenanceService.run({
      deadlineMs: 1000,
      clock: () => now,
      adapters: quickAdapters({
        syncTelemetry: async () => {
          now += 2_000;
          throw new Error("connection refused");
        },
      }),
    });

    expect(summary.phases.telemetry).toMatchObject({
      status: "failed",
      error: "connection refused",
    });
  });

  it("an overlapping invocation re-runs claimed work, so each adapter must be replay safe", async () => {
    // Invocation 1 times out while its write is still in flight; invocation
    // 2 starts before that write lands. The coordinator has no lock, so the
    // synthetic store sees both, and only an idempotent write keeps it right.
    const store = new Map<string, number>();
    const pending = deferred();
    let calls = 0;
    const syncTelemetry = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        const result = await pending.promise;
        store.set("event-1", 1);
        return result;
      }
      store.set("event-1", 1);
      return createSuccess({ processed: 1 });
    });

    const first = MaintenanceService.run({
      deadlineMs: 1000,
      adapters: quickAdapters({ syncTelemetry }),
    });
    await vi.advanceTimersByTimeAsync(750);
    const firstSummary = await first;

    const secondSummary = await MaintenanceService.run({
      deadlineMs: 1000,
      adapters: quickAdapters({ syncTelemetry }),
    });
    pending.resolve(createSuccess({ processed: 1 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(firstSummary.phases.telemetry.status).toBe("timed_out");
    expect(secondSummary.phases.telemetry.status).toBe("completed");
    expect(syncTelemetry).toHaveBeenCalledTimes(2);
    expect([...store.entries()]).toEqual([["event-1", 1]]);
  });
});
