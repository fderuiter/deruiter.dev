// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";
import {
  RunMaintenancePipelineHandler,
  createFailure,
  createSuccess,
  type MaintenanceAdapters,
} from "@/lib/services";

describe("RunMaintenancePipelineHandler (Logic Test)", () => {
  it("executes all four maintenance phases and aggregates counts", async () => {
    const adapters: MaintenanceAdapters = {
      syncTelemetry: vi
        .fn()
        .mockResolvedValue(createSuccess({ syncedEvents: 5 })),
      dispatchNewsletter: vi.fn().mockResolvedValue(createSuccess({ sent: 2 })),
      processEmailRetry: vi
        .fn()
        .mockResolvedValue(createSuccess({ delivered: 1 })),
      runRetention: vi
        .fn()
        .mockResolvedValue(createSuccess({ rawEventsDeleted: 10 })),
    };

    const handler = new RunMaintenancePipelineHandler();
    const result = await handler.execute({
      batchSize: 25,
      deadlineMs: 4000,
      now: new Date("2026-02-01T00:00:00Z"),
      adapters,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(true);
      expect(result.data.partial).toBe(false);
      expect(result.data.phases.telemetry.status).toBe("completed");
      expect(result.data.phases.newsletter.counts.sent).toBe(2);
    }
  });

  it("marks partial failure when a phase returns failure and rejects invalid input", async () => {
    const handler = new RunMaintenancePipelineHandler();
    const invalid = await handler.execute(fromAny({ batchSize: "bad" }));
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.code).toBe("INVALID_MAINTENANCE_INPUT");
    }

    const adapters: MaintenanceAdapters = {
      syncTelemetry: vi
        .fn()
        .mockResolvedValue(createFailure("QUEUE_UNAVAILABLE", "Redis down")),
      dispatchNewsletter: vi.fn().mockResolvedValue(createSuccess({ sent: 0 })),
      processEmailRetry: vi
        .fn()
        .mockResolvedValue(createSuccess({ delivered: 0 })),
      runRetention: vi
        .fn()
        .mockResolvedValue(createSuccess({ rawEventsDeleted: 0 })),
    };

    const partial = await handler.execute({ adapters, deadlineMs: 4000 });
    expect(partial.success).toBe(true);
    if (partial.success) {
      expect(partial.data.partial).toBe(true);
      expect(partial.data.phases.telemetry.status).toBe("failed");
    }
  });
});
