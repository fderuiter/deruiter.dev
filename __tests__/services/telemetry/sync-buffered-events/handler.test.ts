// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  SyncBufferedEventsHandler,
  type SyncBufferedEventsPipelinePort,
} from "@/lib/services";

describe("SyncBufferedEventsHandler (Logic Test)", () => {
  it("drains buffered events into Postgres and acknowledges them in Redis", async () => {
    const sampleEvent = {
      id: "evt-1",
      projectSlug: "crf-studio",
      eventType: "page_view",
      createdAt: new Date("2026-02-01T00:00:00Z"),
    };
    const movePipeline: SyncBufferedEventsPipelinePort = {
      lmove: vi.fn(),
      expire: vi.fn(),
      lrem: vi.fn(),
      exec: vi.fn().mockResolvedValue([sampleEvent]),
    };
    const ackPipeline: SyncBufferedEventsPipelinePort = {
      lmove: vi.fn(),
      expire: vi.fn(),
      lrem: vi.fn(),
      exec: vi.fn().mockResolvedValue([1]),
    };
    const pipeline = vi
      .fn()
      .mockReturnValueOnce(movePipeline)
      .mockReturnValueOnce(ackPipeline);

    const handler = new SyncBufferedEventsHandler({
      redis: {
        lrange: vi.fn().mockResolvedValue([]),
        pipeline,
      },
      prisma: {
        telemetryEvent: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    });

    const result = await handler.execute({ batchSize: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ processed: 1, inserted: 1 });
    }
    expect(ackPipeline.lrem).toHaveBeenCalledTimes(1);
  });

  it("returns QUEUE_UNAVAILABLE when Redis lrange fails", async () => {
    const handler = new SyncBufferedEventsHandler({
      redis: {
        lrange: vi.fn().mockRejectedValue(new Error("Redis timeout")),
        pipeline: vi.fn(),
      },
      prisma: {
        telemetryEvent: { createMany: vi.fn() },
      },
    });

    const result = await handler.execute({ batchSize: 10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("QUEUE_UNAVAILABLE");
    }
  });
});
