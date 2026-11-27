// @vitest-environment node
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { RollupAndPruneTelemetryInputSchema } from "@/lib/services";

describe("RollupAndPruneTelemetryInputSchema (Contract Test)", () => {
  it("accepts valid cutoff Date", () => {
    const parsed = RollupAndPruneTelemetryInputSchema.safeParse({
      before: new Date("2026-01-01T00:00:00Z"),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-Date cutoff", () => {
    const parsed = RollupAndPruneTelemetryInputSchema.safeParse({
      before: fromAny("2026-01-01"),
    });
    expect(parsed.success).toBe(false);
  });
});
