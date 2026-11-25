// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ComputeTelemetryAggregateStatsInputSchema } from "@/lib/services";

describe("ComputeTelemetryAggregateStatsInputSchema (Contract Test)", () => {
  it("accepts empty or omitted input", () => {
    expect(
      ComputeTelemetryAggregateStatsInputSchema.safeParse({}).success
    ).toBe(true);
    expect(
      ComputeTelemetryAggregateStatsInputSchema.safeParse(undefined).success
    ).toBe(true);
  });

  it("rejects non-object input", () => {
    expect(
      ComputeTelemetryAggregateStatsInputSchema.safeParse("invalid").success
    ).toBe(false);
  });
});
