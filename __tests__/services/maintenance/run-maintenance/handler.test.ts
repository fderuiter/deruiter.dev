// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  RunMaintenanceHandler,
  createFailure,
  createSuccess,
  type MaintenanceAdapters,
  type RunMaintenanceInput,
} from "@/lib/services";

describe("RunMaintenanceHandler (Logic Test)", () => {
  it("executes maintenance phases with injected adapters and reports partial failures cleanly", async () => {
    let tick = 1_000;
    const adapters = fromPartial<MaintenanceAdapters>({
      syncTelemetry: async () => createSuccess({ processed: 4, inserted: 4 }),
      dispatchNewsletter: async () =>
        createFailure("DISPATCH_FAILED", "Redis unreachable"),
      processEmailRetry: async () =>
        createSuccess({ processed: 1, succeeded: 1, failed: 0 }),
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
