// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GetTelemetryAggregateStatsInputSchema } from "@/lib/services";

describe("GetTelemetryAggregateStatsInputSchema (Contract Test)", () => {
  it("accepts omitted or empty object input", () => {
    expect(GetTelemetryAggregateStatsInputSchema.safeParse({}).success).toBe(
      true
    );
    expect(
      GetTelemetryAggregateStatsInputSchema.safeParse(undefined).success
    ).toBe(true);
  });

  it("rejects non-object input", () => {
    expect(GetTelemetryAggregateStatsInputSchema.safeParse(42).success).toBe(
      false
    );
  });
});
