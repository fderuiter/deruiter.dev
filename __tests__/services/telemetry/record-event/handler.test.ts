// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  RecordTelemetryEventHandler,
  type TelemetryBufferPipelineLike,
  type TelemetryBufferRedisLike,
} from "@/lib/services";

describe("RecordTelemetryEventHandler (Logic Test)", () => {
  it("enqueues telemetry event into Redis buffer pipeline", async () => {
    const pipeline = fromPartial<TelemetryBufferPipelineLike>({
      lpush: () => pipeline,
      expire: () => pipeline,
      exec: async () => [1, 1],
    });
    const redisClient = fromPartial<TelemetryBufferRedisLike>({
      pipeline: () => pipeline,
    });

    const handler = new RecordTelemetryEventHandler({
      redisClient,
      idGenerator: () => "evt_1",
      now: () => new Date("2026-11-25T00:00:00Z"),
    });

    const result = await handler.execute({
      projectSlug: "crf",
      eventType: "view",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.buffered).toBe(true);
      expect(result.data.event.id).toBe("evt_1");
    }
  });

  it("returns INVALID_INPUT failure on empty projectSlug", async () => {
    const handler = new RecordTelemetryEventHandler();
    const result = await handler.execute({
      projectSlug: "",
      eventType: "view",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });
});
