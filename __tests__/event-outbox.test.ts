import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  flushOutboxQueue,
  EventOutboxConfig,
} from "@/lib/services/event-outbox";
import { redis, isRedisConfigured } from "@/lib/redis";

vi.mock("@/lib/redis", () => ({
  isRedisConfigured: vi.fn(),
  redis: {
    lrange: vi.fn(),
    llen: vi.fn(),
    pipeline: vi.fn(),
  },
}));

interface TestEvent {
  id: string;
  payload: string;
}

describe("Shared Event Outbox Utility (flushOutboxQueue)", () => {
  const mockIsRedisConfigured = vi.mocked(isRedisConfigured);
  const mockRedisLrange = vi.mocked(redis.lrange);
  const mockRedisLlen = vi.mocked(redis.llen);
  const mockPipelineExec = vi.fn();
  const mockPipelineLmove = vi.fn();
  const mockPipelineExpire = vi.fn();
  const mockPipelineLrem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRedisConfigured.mockReturnValue(true);

    vi.mocked(redis.pipeline).mockReturnValue({
      lmove: mockPipelineLmove,
      expire: mockPipelineExpire,
      lrem: mockPipelineLrem,
      exec: mockPipelineExec,
    } as unknown as ReturnType<typeof redis.pipeline>);
  });

  const baseConfig: EventOutboxConfig<TestEvent> = {
    queueKey: "test:queue",
    processingKey: "test:processing",
    batchSize: 10,
    isValidEvent: (item): item is TestEvent =>
      item !== null &&
      typeof item === "object" &&
      "id" in item &&
      "payload" in item,
    persistEvents: vi.fn().mockResolvedValue({ count: 1 }),
  };

  it("returns zero counts immediately when Redis is not configured", async () => {
    mockIsRedisConfigured.mockReturnValueOnce(false);

    const result = await flushOutboxQueue(baseConfig);

    expect(result).toEqual({
      success: true,
      data: { processed: 0, inserted: 0 },
    });
    expect(mockRedisLrange).not.toHaveBeenCalled();
  });

  it("returns zero counts when both processing and pending queues are empty", async () => {
    mockRedisLrange.mockResolvedValueOnce([]);
    mockRedisLlen.mockResolvedValueOnce(0);

    const result = await flushOutboxQueue(baseConfig);

    expect(result).toEqual({
      success: true,
      data: { processed: 0, inserted: 0 },
    });
    expect(baseConfig.persistEvents).not.toHaveBeenCalled();
  });

  it("recovers unacknowledged events from processing queue and persists them", async () => {
    const unackEvent: TestEvent = { id: "evt-1", payload: "data-1" };
    mockRedisLrange.mockResolvedValueOnce([unackEvent]);
    mockRedisLlen.mockResolvedValueOnce(0);
    mockPipelineExec.mockResolvedValueOnce([]); // Ack pipeline

    const onAckMock = vi.fn();
    const postAckMock = vi.fn();

    const result = await flushOutboxQueue({
      ...baseConfig,
      onAcknowledge: onAckMock,
      postAcknowledge: postAckMock,
    });

    expect(result).toEqual({
      success: true,
      data: { processed: 1, inserted: 1 },
    });
    expect(baseConfig.persistEvents).toHaveBeenCalledWith([unackEvent]);
    expect(mockPipelineLrem).toHaveBeenCalledWith(
      "test:processing",
      1,
      unackEvent
    );
    expect(onAckMock).toHaveBeenCalledWith([unackEvent], expect.anything());
    expect(postAckMock).toHaveBeenCalledWith([unackEvent], { count: 1 });
  });

  it("clamps needed transfer batch size to queue depth and uses atomic lmove pipeline", async () => {
    mockRedisLrange.mockResolvedValueOnce([]); // Processing queue empty
    mockRedisLlen.mockResolvedValueOnce(2); // Pending queue depth = 2

    const event1: TestEvent = { id: "evt-1", payload: "p1" };
    const event2: TestEvent = { id: "evt-2", payload: "p2" };

    mockPipelineExec.mockResolvedValueOnce([event1, event2]); // Move results
    mockPipelineExec.mockResolvedValueOnce([]); // Ack pipeline

    const result = await flushOutboxQueue(baseConfig);

    expect(result).toEqual({
      success: true,
      data: { processed: 2, inserted: 1 },
    });
    expect(mockPipelineLmove).toHaveBeenCalledTimes(2);
    expect(mockPipelineLmove).toHaveBeenLastCalledWith(
      "test:queue",
      "test:processing",
      "right",
      "left"
    );
    expect(mockPipelineExpire).toHaveBeenCalledWith("test:processing", 172800);
  });

  it("returns PERSISTENCE_FAILED error envelope when DB write throws", async () => {
    const event: TestEvent = { id: "evt-err", payload: "err" };
    mockRedisLrange.mockResolvedValueOnce([event]);

    const dbError = new Error("Unique constraint error");
    const failingPersist = vi.fn().mockRejectedValueOnce(dbError);

    const result = await flushOutboxQueue({
      ...baseConfig,
      persistEvents: failingPersist,
    });

    expect(result).toMatchObject({
      success: false,
      error: {
        code: "PERSISTENCE_FAILED",
        details: dbError,
      },
    });
    expect(mockPipelineLrem).not.toHaveBeenCalled();
  });

  it("returns FLUSH_FAILED error envelope when Redis lrange throws", async () => {
    const redisError = new Error("Redis cluster unavailable");
    mockRedisLrange.mockRejectedValueOnce(redisError);

    const result = await flushOutboxQueue(baseConfig);

    expect(result).toMatchObject({
      success: false,
      error: {
        code: "FLUSH_FAILED",
        details: redisError,
      },
    });
  });
});
