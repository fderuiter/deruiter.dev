// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RefreshTelemetryAggregateStatsInputSchema } from "@/lib/services";

describe("RefreshTelemetryAggregateStatsInputSchema (Contract Test)", () => {
  it("accepts empty object or undefined", () => {
    expect(
      RefreshTelemetryAggregateStatsInputSchema.safeParse({}).success
    ).toBe(true);
    expect(
      RefreshTelemetryAggregateStatsInputSchema.safeParse(undefined).success
    ).toBe(true);
  });

  it("rejects non-object payloads", () => {
    expect(
      RefreshTelemetryAggregateStatsInputSchema.safeParse(123).success
    ).toBe(false);
  });
});
