// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SyncBufferedEventsInputSchema } from "@/lib/services";

describe("SyncBufferedEventsInputSchema (Contract Test)", () => {
  it("accepts positive batchSize up to 5000 and defaults to 100", () => {
    const parsed = SyncBufferedEventsInputSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.batchSize).toBe(100);
    }
  });

  it("rejects non-positive or oversized batchSize", () => {
    expect(
      SyncBufferedEventsInputSchema.safeParse({ batchSize: 0 }).success
    ).toBe(false);
    expect(
      SyncBufferedEventsInputSchema.safeParse({ batchSize: 9999 }).success
    ).toBe(false);
  });
});
