// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  RecordTelemetryEventHandler,
  type TelemetryBufferPipelinePort,
} from "@/lib/services";

describe("RecordTelemetryEventHandler (Logic Test)", () => {
  it("pushes telemetry event onto Redis buffer pipeline", async () => {
    const pipeline: TelemetryBufferPipelinePort = {
      lpush: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn().mockResolvedValue([1, 1]),
    };
    const handler = new RecordTelemetryEventHandler({
      isPlaywrightTest: () => false,
      randomUUID: () => "evt-1",
      redis: { pipeline: () => pipeline },
    });

    const result = await handler.execute({
      projectSlug: "crf-studio",
      eventType: "page_view",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.buffered).toBe(true);
      expect(result.data.event.id).toBe("evt-1");
    }
    expect(pipeline.lpush).toHaveBeenCalledTimes(1);
  });

  it("returns INVALID_INPUT on empty slug and degrades gracefully when Redis fails", async () => {
    const handler = new RecordTelemetryEventHandler({
      isPlaywrightTest: () => false,
      redis: {
        pipeline: () => ({
          lpush: vi.fn(),
          expire: vi.fn(),
          exec: vi.fn().mockRejectedValue(new Error("Redis offline")),
        }),
      },
    });

    const invalid = await handler.execute({
      projectSlug: "",
      eventType: "page_view",
    });
    expect(invalid.success).toBe(false);

    const dropped = await handler.execute({
      projectSlug: "crf-studio",
      eventType: "page_view",
    });
    expect(dropped.success).toBe(true);
    if (dropped.success) {
      expect(dropped.data.buffered).toBe(false);
    }
  });
});
