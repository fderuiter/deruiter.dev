// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ProcessRetryQueueInputSchema } from "@/lib/services";

describe("ProcessRetryQueueInputSchema (Contract Test)", () => {
  it("accepts optional maxBatchSize, now, and queueId", () => {
    const parsed = ProcessRetryQueueInputSchema.safeParse({
      maxBatchSize: 10,
      now: new Date("2026-03-01T00:00:00Z"),
      queueId: "q-123",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-positive maxBatchSize", () => {
    const parsed = ProcessRetryQueueInputSchema.safeParse({
      maxBatchSize: 0,
    });
    expect(parsed.success).toBe(false);
  });
});
