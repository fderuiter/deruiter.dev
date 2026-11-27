// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { ComputeTelemetryAggregateStatsInputSchema } from "@/lib/services";

describe("ComputeTelemetryAggregateStatsInputSchema (Contract Test)", () => {
  it("accepts undefined or empty object", () => {
    expect(
      ComputeTelemetryAggregateStatsInputSchema.safeParse(undefined).success
    ).toBe(true);
    expect(
      ComputeTelemetryAggregateStatsInputSchema.safeParse({}).success
    ).toBe(true);
  });

  it("rejects primitive non-object input", () => {
    expect(
      ComputeTelemetryAggregateStatsInputSchema.safeParse(fromAny("invalid"))
        .success
    ).toBe(false);
  });
});
