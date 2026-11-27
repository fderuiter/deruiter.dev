// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  RunMaintenancePipelineErrorCode,
  RunMaintenancePipelineInputSchema,
} from "@/lib/services";

describe("RunMaintenancePipelineInputSchema (Contract Test)", () => {
  it("accepts optional batchSize, deadlineMs, and now date", () => {
    const parsed = RunMaintenancePipelineInputSchema.safeParse({
      batchSize: 50,
      deadlineMs: 5000,
      now: new Date("2026-01-01T00:00:00Z"),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-numeric batchSize", () => {
    const parsed = RunMaintenancePipelineInputSchema.safeParse({
      batchSize: "fifty",
    });
    expect(parsed.success).toBe(false);
    expect(RunMaintenancePipelineErrorCode.options).toContain(
      "INVALID_MAINTENANCE_INPUT"
    );
  });
});
