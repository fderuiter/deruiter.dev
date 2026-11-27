// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  GetTelemetryAggregateStatsErrorCode,
  GetTelemetryAggregateStatsInputSchema,
} from "@/lib/services";

describe("GetTelemetryAggregateStatsInputSchema (Contract Test)", () => {
  it("accepts empty object or undefined", () => {
    expect(
      GetTelemetryAggregateStatsInputSchema.safeParse(undefined).success
    ).toBe(true);
    expect(GetTelemetryAggregateStatsInputSchema.safeParse({}).success).toBe(
      true
    );
  });

  it("rejects primitive values", () => {
    expect(
      GetTelemetryAggregateStatsInputSchema.safeParse(fromAny(42)).success
    ).toBe(false);
    expect(GetTelemetryAggregateStatsErrorCode.options).toContain(
      "STORAGE_UNAVAILABLE"
    );
  });
});
