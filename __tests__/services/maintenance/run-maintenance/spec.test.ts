// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RunMaintenanceInputSchema } from "@/lib/services";

describe("RunMaintenanceInputSchema (Contract Test)", () => {
  it("accepts optional bounded batchSize, deadlineMs, and now", () => {
    expect(
      RunMaintenanceInputSchema.safeParse({
        batchSize: 250,
        deadlineMs: 7000,
        now: new Date("2026-11-25T00:00:00Z"),
      }).success
    ).toBe(true);
    expect(RunMaintenanceInputSchema.safeParse(undefined).success).toBe(true);
  });

  it("rejects non-finite numeric parameters", () => {
    expect(
      RunMaintenanceInputSchema.safeParse({ batchSize: Number.NaN }).success
    ).toBe(false);
  });
});
