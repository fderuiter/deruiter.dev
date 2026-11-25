// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  SyncBufferedTelemetryEventsHandler,
  type BufferedTelemetryEvent,
  type TelemetrySyncDbLike,
  type TelemetrySyncPipelineLike,
  type TelemetrySyncRedisLike,
} from "@/lib/services";

describe("SyncBufferedTelemetryEventsHandler (Logic Test)", () => {
  it("moves buffered events via atomic LMOVE, persists to DB, and acknowledges owned items", async () => {
    const evt: BufferedTelemetryEvent = {
      id: "evt_sync_1",
      projectSlug: "crf",
      eventType: "view",
      createdAt: "2026-11-25T00:00:00.000Z",
    };
    let step = 0;
    const pipeline = fromPartial<TelemetrySyncPipelineLike>({
      lmove: () => pipeline,
      expire: () => pipeline,
      lrem: () => pipeline,
      exec: async () => {
        step += 1;
        return step === 1 ? [evt, null] : [1];
      },
    });
    const redisClient = fromPartial<TelemetrySyncRedisLike>({
      lrange: (async () => []) as TelemetrySyncRedisLike["lrange"],
      pipeline: () => pipeline,
    });
    const db = fromPartial<TelemetrySyncDbLike>({
      telemetryEvent: {
        createMany: async () => ({ count: 1 }),
      },
    });

    const handler = new SyncBufferedTelemetryEventsHandler({ redisClient, db });
    const result = await handler.execute({ batchSize: 2 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ processed: 1, inserted: 1 });
    }
  });

  it("returns PERSISTENCE_FAILED when database createMany rejects", async () => {
    const evt: BufferedTelemetryEvent = {
      id: "evt_sync_2",
      projectSlug: "crf",
      eventType: "view",
      createdAt: "2026-11-25T00:00:00.000Z",
    };
    const pipeline = fromPartial<TelemetrySyncPipelineLike>({
      lmove: () => pipeline,
      expire: () => pipeline,
      lrem: () => pipeline,
      exec: async () => [evt],
    });
    const redisClient = fromPartial<TelemetrySyncRedisLike>({
      lrange: (async () => []) as TelemetrySyncRedisLike["lrange"],
      pipeline: () => pipeline,
    });
    const db = fromPartial<TelemetrySyncDbLike>({
      telemetryEvent: {
        createMany: async () => {
          throw new Error("DB write error");
        },
      },
    });

    const handler = new SyncBufferedTelemetryEventsHandler({ redisClient, db });
    const result = await handler.execute({ batchSize: 1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PERSISTENCE_FAILED");
    }
  });
});
