// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { RefreshTelemetryAggregateStatsInputSchema } from "@/lib/services";

describe("RefreshTelemetryAggregateStatsInputSchema (Contract Test)", () => {
  it("accepts undefined or empty object", () => {
    expect(
      RefreshTelemetryAggregateStatsInputSchema.safeParse(undefined).success
    ).toBe(true);
    expect(
      RefreshTelemetryAggregateStatsInputSchema.safeParse({}).success
    ).toBe(true);
  });

  it("rejects non-object values", () => {
    expect(
      RefreshTelemetryAggregateStatsInputSchema.safeParse(fromAny("bad"))
        .success
    ).toBe(false);
  });
});
