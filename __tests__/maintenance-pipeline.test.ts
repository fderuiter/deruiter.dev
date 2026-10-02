// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  MaintenanceService,
  type MaintenancePhaseResult,
} from "@/lib/services/maintenance-service";
import { GET, maxDuration } from "@/app/api/cron/maintenance/route";
import { logger } from "@/lib/logger";
import { createFailure, createSuccess } from "@/lib/services/service-result";
import { TelemetryService } from "@/lib/services/telemetry-service";
import { CaseStudyService } from "@/lib/services/case-study-service";
import { BlogPostService } from "@/lib/services/blog-service";
import { NewsletterService } from "@/lib/services/newsletter-service";
import { EmailService } from "@/lib/services/email-service";

type PhaseTask = () => Promise<MaintenancePhaseResult>;

function adapters(
  overrides?: Partial<{
    syncTelemetry: PhaseTask;
    dispatchNewsletter: PhaseTask;
    processEmailRetry: PhaseTask;
    runRetention: PhaseTask;
  }>
) {
  return {
    syncTelemetry:
      overrides?.syncTelemetry ||
      vi.fn().mockResolvedValue(createSuccess({ processed: 4, inserted: 4 })),
    dispatchNewsletter:
      overrides?.dispatchNewsletter ||
      vi.fn().mockResolvedValue(createSuccess({ queued: 0, capacity: 10 })),
    processEmailRetry:
      overrides?.processEmailRetry ||
      vi
        .fn()
        .mockResolvedValue(
          createSuccess({ processed: 1, succeeded: 1, failed: 0 })
        ),
    runRetention:
      overrides?.runRetention ||
      vi
        .fn()
        .mockResolvedValue(
          createSuccess({ rollupsUpserted: 2, rawEventsDeleted: 20 })
        ),
  };
}

describe("unified maintenance pipeline (#714)", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("executes every phase sequentially and returns structured counts", async () => {
    const calls: string[] = [];
    const result = await MaintenanceService.run({
      now: new Date("2026-09-13T00:00:00.000Z"),
      adapters: adapters({
        syncTelemetry: vi.fn(async () => {
          calls.push("telemetry");
          return createSuccess({ processed: 4, inserted: 4 });
        }),
        dispatchNewsletter: vi.fn(async () => {
          calls.push("newsletter");
          return createSuccess({ queued: 3, capacity: 10 });
        }),
        processEmailRetry: vi.fn(async () => {
          calls.push("emailRetry");
          return createSuccess({ processed: 1, succeeded: 1, failed: 0 });
        }),
        runRetention: vi.fn(async () => {
          calls.push("retention");
          return createSuccess({ rollupsUpserted: 2, rawEventsDeleted: 20 });
        }),
      }),
    });

    // Newsletter runs before emailRetry so its queued mail goes out the same run.
    expect(calls).toEqual([
      "telemetry",
      "newsletter",
      "emailRetry",
      "retention",
    ]);
    expect(result.phases.newsletter.counts.queued).toBe(3);
    expect(result.success).toBe(true);
    expect(result.partial).toBe(false);
    expect(result.deadlineMs).toBe(8000);
    expect(result.phases.telemetry.counts.processed).toBe(4);
    expect(result.phases.emailRetry.counts.succeeded).toBe(1);
    expect(result.phases.retention.counts.rawEventsDeleted).toBe(20);
  });

  it("isolates a thrown phase error and continues with later maintenance", async () => {
    const emailRetry = vi
      .fn()
      .mockResolvedValue(createSuccess({ processed: 0 }));
    const retention = vi
      .fn()
      .mockResolvedValue(createSuccess({ rawEventsDeleted: 0 }));
    const result = await MaintenanceService.run({
      adapters: adapters({
        syncTelemetry: vi.fn().mockRejectedValue(new Error("redis offline")),
        processEmailRetry: emailRetry,
        runRetention: retention,
      }),
    });

    expect(result.success).toBe(false);
    expect(result.partial).toBe(true);
    expect(result.phases.telemetry.status).toBe("failed");
    expect(result.phases.telemetry.error).toContain("redis offline");
    expect(emailRetry).toHaveBeenCalledOnce();
    expect(retention).toHaveBeenCalledOnce();
  });

  it("records a returned failure result as a failed phase (#1532)", async () => {
    const warn = vi.spyOn(logger, "warn");
    const retention = vi
      .fn()
      .mockResolvedValue(createSuccess({ rawEventsDeleted: 0 }));
    const result = await MaintenanceService.run({
      adapters: adapters({
        dispatchNewsletter: vi
          .fn()
          .mockResolvedValue(
            createFailure(
              "ENQUEUE_FAILED",
              "Could not enqueue a newsletter dispatch email"
            )
          ),
        runRetention: retention,
      }),
    });

    expect(result.success).toBe(false);
    expect(result.partial).toBe(true);
    expect(result.phases.newsletter).toMatchObject({
      status: "failed",
      counts: {},
      error: "Could not enqueue a newsletter dispatch email",
    });
    expect(result.phases.telemetry.status).toBe("completed");
    expect(result.phases.emailRetry.status).toBe("completed");
    expect(retention).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[maintenance:newsletter] ENQUEUE_FAILED"),
      undefined,
      expect.objectContaining({
        maintenancePhase: "newsletter",
        errorCode: "ENQUEUE_FAILED",
      })
    );
  });

  it("skips remaining work when the response reserve reaches the deadline", async () => {
    let currentTime = 1_000;
    const retention = vi
      .fn()
      .mockResolvedValue(createSuccess({ rawEventsDeleted: 0 }));
    const result = await MaintenanceService.run({
      deadlineMs: 500,
      clock: () => currentTime,
      adapters: adapters({
        syncTelemetry: vi.fn(async () => {
          currentTime += 260;
          return createSuccess({ processed: 1 });
        }),
        processEmailRetry: vi.fn(async () => {
          currentTime += 10;
          return createSuccess({ processed: 0 });
        }),
        runRetention: retention,
      }),
    });

    expect(result.durationMs).toBe(260);
    expect(result.phases.telemetry.status).toBe("completed");
    expect(result.phases.newsletter.status).toBe("skipped");
    expect(result.phases.emailRetry.status).toBe("skipped");
    expect(result.phases.retention.status).toBe("skipped");
    expect(retention).not.toHaveBeenCalled();
  });

  describe("production adapters (#1532)", () => {
    const counts = createSuccess({ processed: 2, inserted: 2 });
    const empty = createSuccess({ processed: 0, inserted: 0 });

    function stubOtherPhases() {
      vi.spyOn(NewsletterService, "dispatchDue").mockResolvedValue(
        createSuccess({
          openDispatches: 0,
          queued: 0,
          skippedSuppressed: 0,
          completedDispatches: 0,
          capacity: 10,
        })
      );
      vi.spyOn(EmailService, "processRetryQueue").mockResolvedValue(
        createSuccess({ processed: 0, succeeded: 0, failed: 0 })
      );
      vi.spyOn(EmailService, "getRetryQueueHealth").mockResolvedValue({
        depth: 0,
        oldestPendingAgeMs: null,
        terminalFailures: 0,
        retryExhausted: 0,
      });
      vi.spyOn(TelemetryService, "rollupAndPruneRawEvents").mockResolvedValue(
        createSuccess({ rollupsUpserted: 0, rawEventsDeleted: 0 })
      );
    }

    it("reports every counter when all services succeed", async () => {
      stubOtherPhases();
      vi.spyOn(TelemetryService, "syncBufferedEvents").mockResolvedValue(
        counts
      );
      vi.spyOn(
        CaseStudyService,
        "flushBufferedReactionsToDatabase"
      ).mockResolvedValue(counts);
      vi.spyOn(
        BlogPostService,
        "flushBufferedReactionsToDatabase"
      ).mockResolvedValue(createSuccess({ processed: 1, inserted: 1 }));

      const result = await MaintenanceService.run();

      expect(result.success).toBe(true);
      expect(result.phases.telemetry.counts).toEqual({
        processed: 2,
        inserted: 2,
        reactionsProcessed: 2,
        reactionsInserted: 2,
        blogReactionsProcessed: 1,
        blogReactionsInserted: 1,
      });
      expect(result.phases.retention.counts).toEqual({
        rollupsUpserted: 0,
        rawEventsDeleted: 0,
        providerExpiredKeysDeleted: 0,
      });
    });

    it("fails the phase on a reaction flush failure after draining both queues", async () => {
      stubOtherPhases();
      vi.spyOn(TelemetryService, "syncBufferedEvents").mockResolvedValue(
        counts
      );
      vi.spyOn(
        CaseStudyService,
        "flushBufferedReactionsToDatabase"
      ).mockResolvedValue(
        createFailure(
          "PERSISTENCE_FAILED",
          "Buffered case study reactions could not be written to the database"
        )
      );
      const blogFlush = vi
        .spyOn(BlogPostService, "flushBufferedReactionsToDatabase")
        .mockResolvedValue(counts);

      const result = await MaintenanceService.run();

      expect(blogFlush).toHaveBeenCalledOnce();
      expect(result.partial).toBe(true);
      expect(result.phases.telemetry).toMatchObject({
        status: "failed",
        error:
          "Buffered case study reactions could not be written to the database",
      });
      expect(result.phases.retention.status).toBe("completed");
    });

    it("stops the telemetry phase at a sync failure without flushing reactions", async () => {
      stubOtherPhases();
      vi.spyOn(TelemetryService, "syncBufferedEvents").mockResolvedValue(
        createFailure(
          "QUEUE_UNAVAILABLE",
          "Telemetry buffer could not be read from Redis"
        )
      );
      const caseStudyFlush = vi.spyOn(
        CaseStudyService,
        "flushBufferedReactionsToDatabase"
      );

      const result = await MaintenanceService.run();

      expect(caseStudyFlush).not.toHaveBeenCalled();
      expect(result.phases.telemetry.status).toBe("failed");
      expect(result.phases.newsletter.status).toBe("completed");
    });

    it("records newsletter, email retry and retention failures from their results", async () => {
      stubOtherPhases();
      vi.spyOn(TelemetryService, "syncBufferedEvents").mockResolvedValue(empty);
      vi.spyOn(
        CaseStudyService,
        "flushBufferedReactionsToDatabase"
      ).mockResolvedValue(empty);
      vi.spyOn(
        BlogPostService,
        "flushBufferedReactionsToDatabase"
      ).mockResolvedValue(empty);
      vi.spyOn(NewsletterService, "dispatchDue").mockResolvedValue(
        createFailure(
          "DISPATCH_FAILED",
          "Newsletter dispatch phase could not complete"
        )
      );
      vi.spyOn(EmailService, "processRetryQueue").mockResolvedValue(
        createFailure(
          "QUEUE_LEASE_FAILED",
          "Could not lease due rows from the outbound email queue"
        )
      );
      const health = vi.spyOn(EmailService, "getRetryQueueHealth");
      vi.spyOn(TelemetryService, "rollupAndPruneRawEvents").mockResolvedValue(
        createFailure(
          "RETENTION_FAILED",
          "Telemetry rollup and prune transaction failed"
        )
      );

      const result = await MaintenanceService.run();

      expect(result.phases.telemetry.status).toBe("completed");
      expect(result.phases.newsletter.status).toBe("failed");
      expect(result.phases.emailRetry).toMatchObject({
        status: "failed",
        error: "Could not lease due rows from the outbound email queue",
      });
      expect(health).not.toHaveBeenCalled();
      expect(result.phases.retention.status).toBe("failed");
    });
  });

  it("rejects an unauthorized cron request before invoking the runner", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "maintenance-secret");
    const run = vi.spyOn(MaintenanceService, "run");
    const response = await GET(
      new NextRequest("https://www.deruiter.dev/api/cron/maintenance")
    );

    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs an authenticated request with validated batch input", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "maintenance-secret");
    const run = vi.spyOn(MaintenanceService, "run").mockResolvedValue({
      success: true,
      partial: false,
      startedAt: "2026-09-13T00:00:00.000Z",
      completedAt: "2026-09-13T00:00:00.100Z",
      durationMs: 100,
      deadlineMs: 8000,
      phases: {
        telemetry: { status: "completed", durationMs: 10, counts: {} },
        newsletter: { status: "completed", durationMs: 10, counts: {} },
        emailRetry: { status: "completed", durationMs: 10, counts: {} },
        retention: { status: "completed", durationMs: 10, counts: {} },
      },
    });
    const response = await GET(
      new NextRequest(
        "https://www.deruiter.dev/api/cron/maintenance?batch=25",
        { headers: { authorization: "Bearer maintenance-secret" } }
      )
    );

    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith({ batchSize: 25, deadlineMs: 7000 });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      partial: false,
      deadlineMs: 8000,
    });
  });

  it("declares a platform maxDuration within the eight-second budget (#848)", () => {
    expect(maxDuration).toBeLessThanOrEqual(8);
  });

  it("reports a partial run as a 500 with an error-level log (#848)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "maintenance-secret");
    const error = vi.spyOn(logger, "error").mockImplementation(() => ({
      level: "error",
      message: "",
      timestamp: "",
    }));
    vi.spyOn(MaintenanceService, "run").mockResolvedValue({
      success: false,
      partial: true,
      startedAt: "2026-09-13T00:00:00.000Z",
      completedAt: "2026-09-13T00:00:07.000Z",
      durationMs: 7000,
      deadlineMs: 7000,
      phases: {
        telemetry: {
          status: "failed",
          durationMs: 10,
          counts: {},
          error: "connect ECONNREFUSED",
        },
        newsletter: { status: "completed", durationMs: 10, counts: {} },
        emailRetry: { status: "completed", durationMs: 10, counts: {} },
        retention: { status: "skipped", durationMs: 0, counts: {} },
      },
    });

    const response = await GET(
      new NextRequest("https://www.deruiter.dev/api/cron/maintenance", {
        headers: { authorization: "Bearer maintenance-secret" },
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ partial: true });
    expect(error).toHaveBeenCalledWith(
      "[maintenance] Daily run did not complete: telemetry:failed, retention:skipped",
      undefined,
      expect.objectContaining({
        maintenanceSummary: expect.objectContaining({ partial: true }),
      })
    );
  });
});
