// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EmailRetryErrorCode,
  ProcessRetryQueueInputSchema,
} from "@/lib/services";

describe("ProcessRetryQueue Spec (Contract Test)", () => {
  it("accepts optional maxBatchSize, now, and queueId", () => {
    expect(
      ProcessRetryQueueInputSchema.safeParse({
        maxBatchSize: 5,
        now: new Date(),
        queueId: "q-1",
      }).success
    ).toBe(true);
  });

  it("rejects zero maxBatchSize and defines QUEUE_STATE_READ_FAILED", () => {
    expect(
      ProcessRetryQueueInputSchema.safeParse({ maxBatchSize: 0 }).success
    ).toBe(false);
    expect(EmailRetryErrorCode.options).toEqual(
      expect.arrayContaining([
        "QUEUE_LEASE_FAILED",
        "QUEUE_UPDATE_FAILED",
        "QUEUE_STATE_READ_FAILED",
        "TRANSPORT_UNCONFIGURED",
        "INVALID_INPUT",
      ])
    );
  });
});
