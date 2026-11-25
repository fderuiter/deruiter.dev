// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RollupAndPruneTelemetryEventsInputSchema } from "@/lib/services";

describe("RollupAndPruneTelemetryEventsInputSchema (Contract Test)", () => {
  it("accepts valid Date cutoff", () => {
    expect(
      RollupAndPruneTelemetryEventsInputSchema.safeParse({
        before: new Date("2026-10-01T00:00:00Z"),
      }).success
    ).toBe(true);
  });

  it("rejects non-Date cutoff values", () => {
    expect(
      RollupAndPruneTelemetryEventsInputSchema.safeParse({
        before: "2026-10-01",
      }).success
    ).toBe(false);
  });
});
