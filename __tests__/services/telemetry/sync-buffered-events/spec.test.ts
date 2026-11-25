// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SyncBufferedTelemetryEventsInputSchema } from "@/lib/services";

describe("SyncBufferedTelemetryEventsInputSchema (Contract Test)", () => {
  it("accepts positive integer batchSize", () => {
    expect(
      SyncBufferedTelemetryEventsInputSchema.safeParse({ batchSize: 100 })
        .success
    ).toBe(true);
  });

  it("rejects zero or negative batchSize", () => {
    expect(
      SyncBufferedTelemetryEventsInputSchema.safeParse({ batchSize: 0 }).success
    ).toBe(false);
  });
});
