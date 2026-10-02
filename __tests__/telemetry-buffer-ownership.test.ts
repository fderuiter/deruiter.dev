// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockLpush,
  mockExpire,
  mockExec,
  mockLmove,
  mockLrem,
  mockLrange,
  mockDel,
  mockCreateMany,
  mockCaptureException,
  mockTransaction,
} = vi.hoisted(() => ({
  mockLpush: vi.fn(),
  mockExpire: vi.fn(),
  mockExec: vi.fn(),
  mockLmove: vi.fn(),
  mockLrem: vi.fn(),
  mockLrange: vi.fn().mockResolvedValue([]),
  mockDel: vi.fn(),
  mockCreateMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockCaptureException: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    telemetryEvent: {
      createMany: mockCreateMany,
      groupBy: vi.fn(),
      create: vi.fn(),
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

vi.mock("@upstash/redis", () => {
  class MockRedis {
    pipeline() {
      return {
        lpush: mockLpush,
        expire: mockExpire,
        lmove: mockLmove,
        lrem: mockLrem,
        exec: mockExec,
      };
    }
    lrange = mockLrange;
    del = mockDel;
  }
  return { Redis: MockRedis };
});

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn();
    limit = vi.fn().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
    });
  },
}));

import { TelemetryService } from "@/lib/services/telemetry-service";

const PROCESSING_KEY = "telemetry_processing";

describe("Telemetry buffer ownership across concurrent sync and enqueue failure (#695)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLrange.mockResolvedValue([]);
    mockExec.mockResolvedValue([]);
    mockCreateMany.mockResolvedValue({ count: 0 });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("concurrent sync workers", () => {
    it("acknowledges only the events it persisted instead of clearing the shared processing queue", async () => {
      // Worker A observes one event already in the processing queue...
      const carriedOver = {
        id: "evt-carried",
        projectSlug: "/proof",
        eventType: "page_view",
        createdAt: new Date().toISOString(),
      };
      // ...and moves one more across from the buffer itself.
      const movedByA = {
        id: "evt-moved-by-a",
        projectSlug: "/simulator",
        eventType: "project_click",
        createdAt: new Date().toISOString(),
      };

      mockLrange.mockResolvedValueOnce([carriedOver]);
      mockExec.mockResolvedValueOnce([movedByA, null, null]);
      mockCreateMany.mockResolvedValueOnce({ count: 2 });

      const result = await TelemetryService.syncBufferedEvents(3);

      expect(result).toEqual({
        success: true,
        data: { processed: 2, inserted: 2 },
      });

      // A concurrent worker may LMOVE further events into the processing queue
      // between this worker's read and its acknowledgement. Deleting the whole
      // key would discard those events before they ever reach the database.
      expect(mockDel).not.toHaveBeenCalledWith(PROCESSING_KEY);

      // Exactly the two owned events are removed, one occurrence each.
      expect(mockLrem).toHaveBeenCalledTimes(2);
      expect(mockLrem).toHaveBeenCalledWith(PROCESSING_KEY, 1, carriedOver);
      expect(mockLrem).toHaveBeenCalledWith(PROCESSING_KEY, 1, movedByA);
    });

    it("leaves the batch intact and acknowledges nothing when the database write fails", async () => {
      const pending = {
        id: "evt-pending",
        projectSlug: "/stack",
        eventType: "page_view",
        createdAt: new Date().toISOString(),
      };
      mockLrange.mockResolvedValueOnce([pending]);
      mockExec.mockResolvedValueOnce([]);
      mockCreateMany.mockRejectedValueOnce(new Error("Database Write Failed"));

      await expect(
        TelemetryService.syncBufferedEvents(5)
      ).resolves.toMatchObject({
        success: false,
        error: { code: "PERSISTENCE_FAILED" },
      });

      expect(mockLrem).not.toHaveBeenCalled();
      expect(mockDel).not.toHaveBeenCalledWith(PROCESSING_KEY);
    });

    it("acknowledges nothing when there is no work to do", async () => {
      mockLrange.mockResolvedValueOnce([]);
      mockExec.mockResolvedValueOnce([null, null]);

      const result = await TelemetryService.syncBufferedEvents(2);

      expect(result).toEqual({
        success: true,
        data: { processed: 0, inserted: 0 },
      });
      expect(mockLrem).not.toHaveBeenCalled();
      expect(mockDel).not.toHaveBeenCalledWith(PROCESSING_KEY);
    });

    it("returns QUEUE_UNAVAILABLE instead of throwing when Redis cannot be read (#1532)", async () => {
      const redisError = new Error("Redis connection refused");
      mockLrange.mockRejectedValueOnce(redisError);

      const result = await TelemetryService.syncBufferedEvents(5);

      expect(result).toMatchObject({
        success: false,
        error: { code: "QUEUE_UNAVAILABLE", details: redisError },
      });
      expect(mockCreateMany).not.toHaveBeenCalled();
    });

    it("returns ACKNOWLEDGEMENT_FAILED when the batch persisted but LREM failed (#1532)", async () => {
      const pending = {
        id: "evt-persisted",
        projectSlug: "/stack",
        eventType: "page_view",
        createdAt: new Date().toISOString(),
      };
      mockLrange.mockResolvedValueOnce([pending]);
      mockExec
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error("ack pipeline dropped"));
      mockCreateMany.mockResolvedValueOnce({ count: 1 });

      const result = await TelemetryService.syncBufferedEvents(5);

      expect(result).toMatchObject({
        success: false,
        error: { code: "ACKNOWLEDGEMENT_FAILED" },
      });
      expect(mockCreateMany).toHaveBeenCalledOnce();
    });
  });

  describe("rollupAndPruneRawEvents (#1532)", () => {
    it("returns the committed counts", async () => {
      mockTransaction.mockResolvedValueOnce({
        rollupsUpserted: 3,
        rawEventsDeleted: 40,
      });

      await expect(
        TelemetryService.rollupAndPruneRawEvents(new Date())
      ).resolves.toEqual({
        success: true,
        data: { rollupsUpserted: 3, rawEventsDeleted: 40 },
      });
    });

    it("returns RETENTION_FAILED instead of throwing when the transaction rolls back", async () => {
      const txError = new Error("serialization failure");
      mockTransaction.mockRejectedValueOnce(txError);

      await expect(
        TelemetryService.rollupAndPruneRawEvents(new Date())
      ).resolves.toMatchObject({
        success: false,
        error: { code: "RETENTION_FAILED", details: txError },
      });
    });
  });

  describe("buffer enqueue failure", () => {
    it("reports the event as durably buffered when the Redis enqueue succeeds", async () => {
      mockExec.mockResolvedValueOnce([1]);

      const result = await TelemetryService.recordEvent({
        projectSlug: "/dashboard",
        eventType: "page_view",
      });

      expect(result.buffered).toBe(true);
      expect(result.event.projectSlug).toBe("/dashboard");
      expect(mockCaptureException).not.toHaveBeenCalled();
    });

    it("does not claim durable ingestion when the Redis enqueue fails", async () => {
      const enqueueError = new Error("Upstash unavailable");
      mockExec.mockRejectedValueOnce(enqueueError);

      const result = await TelemetryService.recordEvent({
        projectSlug: "/dashboard",
        eventType: "page_view",
      });

      // The event is gone: it was never written to Redis and there is no other
      // durable store in front of the sync job. Callers must be able to see it.
      expect(result.buffered).toBe(false);
      expect(result.event.projectSlug).toBe("/dashboard");

      // A dropped event is a reportable production signal, not a debug warning.
      expect(mockCaptureException).toHaveBeenCalledWith(
        enqueueError,
        expect.anything()
      );
    });

    it("treats an enqueue timeout as expected degradation, not a Sentry error", async () => {
      vi.useFakeTimers();
      try {
        mockExec.mockReturnValueOnce(new Promise(() => {}));
        const pending = TelemetryService.recordEvent({
          projectSlug: "/dashboard",
          eventType: "page_view",
        });
        await vi.advanceTimersByTimeAsync(2000);
        const result = await pending;

        expect(result.buffered).toBe(false);
        expect(mockCaptureException).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
