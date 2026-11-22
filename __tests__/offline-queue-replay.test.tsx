import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  useOfflineQueue,
  enqueueOfflineRequest,
  clearOfflineQueue,
  clearDLQ,
  getOfflineQueue,
  getOfflineQueueLength,
  getDLQ,
  getDLQLength,
  flushOfflineQueue,
  retryDLQItem,
  type QueuedRequest,
} from "@/hooks/useOfflineQueue";
import type { ApiClientResponse } from "@/lib/api-client";
import { logger } from "@/lib/logger";

const { mockGet, mockPost, mockPut, mockPatch, mockDelete } = vi.hoisted(
  () => ({
    mockGet: vi.fn(),
    mockPost: vi.fn(),
    mockPut: vi.fn(),
    mockPatch: vi.fn(),
    mockDelete: vi.fn(),
  })
);

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    patch: mockPatch,
    delete: mockDelete,
  },
}));

class MockStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

function response(
  overrides: Partial<ApiClientResponse<unknown>> = {}
): ApiClientResponse<unknown> {
  const status = overrides.status ?? 200;
  return {
    data: null,
    error: null,
    details: [],
    body: null,
    headers: new Headers(),
    status,
    ok: status >= 200 && status < 300,
    networkError: false,
    ...overrides,
  };
}

const ok = () => response({ status: 200 });

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    value,
    writable: true,
    configurable: true,
  });
}

/** Lets the chain of awaited mock responses inside a flush settle. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function enqueueTelemetry(label: string, extra: Partial<QueuedRequest> = {}) {
  return enqueueOfflineRequest({
    type: "telemetry",
    endpoint: `/api/telemetry/${label}`,
    body: { label },
    ...extra,
  });
}

function postedEndpoints(): string[] {
  return mockPost.mock.calls.map((call) => String(call[0]));
}

describe("useOfflineQueue replay, ordering and retry paths (#2532)", () => {
  let originalLocalStorage: Storage;

  beforeEach(async () => {
    vi.useFakeTimers();
    setOnline(false);
    await clearOfflineQueue();
    await clearDLQ();
    originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: new MockStorage(),
      writable: true,
      configurable: true,
    });
    vi.spyOn(logger, "error").mockImplementation(() => ({
      level: "error",
      message: "",
      timestamp: "",
    }));
    vi.spyOn(logger, "warn").mockImplementation(() => ({
      level: "warn",
      message: "",
      timestamp: "",
    }));
    for (const fn of [mockGet, mockPost, mockPut, mockPatch, mockDelete]) {
      fn.mockReset();
      fn.mockResolvedValue(ok());
    }
  });

  afterEach(async () => {
    cleanup();
    setOnline(false);
    await clearOfflineQueue();
    await clearDLQ();
    await vi.advanceTimersByTimeAsync(0);
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  describe("replay on reconnect", () => {
    it("sends three items queued offline in FIFO order when the browser comes online", async () => {
      await enqueueTelemetry("a");
      await enqueueTelemetry("b");
      await enqueueTelemetry("c");
      expect(getOfflineQueueLength()).toBe(3);
      expect(mockPost).not.toHaveBeenCalled();

      setOnline(true);
      await act(async () => {
        window.dispatchEvent(new Event("online"));
      });
      await settle();

      expect(postedEndpoints()).toEqual([
        "/api/telemetry/a",
        "/api/telemetry/b",
        "/api/telemetry/c",
      ]);
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("keeps a 5xx item and every item behind it queued, then replays them in order after backoff", async () => {
      await enqueueTelemetry("a");
      await enqueueTelemetry("b");
      await enqueueTelemetry("c");
      mockPost
        .mockResolvedValueOnce(ok())
        .mockResolvedValueOnce(response({ status: 503 }));

      setOnline(true);
      let result = { processed: 0, failed: 0 };
      await act(async () => {
        result = await flushOfflineQueue();
      });

      expect(result).toEqual({ processed: 1, failed: 1 });
      expect(postedEndpoints()).toEqual([
        "/api/telemetry/a",
        "/api/telemetry/b",
      ]);
      const remaining = getOfflineQueue();
      expect(remaining.map((i) => i.endpoint)).toEqual([
        "/api/telemetry/b",
        "/api/telemetry/c",
      ]);
      expect(remaining[0].retries).toBe(1);
      expect(remaining[1].retries).toBe(0);
      expect(getDLQLength()).toBe(0);

      // First retry is scheduled at 1000 * 2^1 ms.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1999);
      });
      expect(mockPost).toHaveBeenCalledTimes(2);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      await settle();

      expect(postedEndpoints()).toEqual([
        "/api/telemetry/a",
        "/api/telemetry/b",
        "/api/telemetry/b",
        "/api/telemetry/c",
      ]);
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("treats a network failure (status 0) as retryable, not as a dead letter", async () => {
      await enqueueTelemetry("a");
      await enqueueTelemetry("b");
      mockPost.mockResolvedValueOnce(
        response({ status: 0, networkError: true })
      );

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });

      expect(getOfflineQueue().map((i) => i.retries)).toEqual([1, 0]);
      expect(getDLQLength()).toBe(0);
    });

    it("moves a 4xx item to the DLQ but carries on with the items behind it", async () => {
      await enqueueTelemetry("a");
      await enqueueTelemetry("b");
      await enqueueTelemetry("c");
      mockPost
        .mockResolvedValueOnce(ok())
        .mockResolvedValueOnce(response({ status: 422, error: "bad" }));

      setOnline(true);
      let result = { processed: 0, failed: 0 };
      await act(async () => {
        result = await flushOfflineQueue();
      });

      expect(result).toEqual({ processed: 2, failed: 1 });
      expect(postedEndpoints()).toHaveLength(3);
      expect(getOfflineQueueLength()).toBe(0);
      expect(getDLQ().map((i) => i.endpoint)).toEqual(["/api/telemetry/b"]);
    });

    it("stops replaying when the browser drops offline mid-flush", async () => {
      await enqueueTelemetry("a");
      await enqueueTelemetry("b");
      mockPost.mockImplementationOnce(async () => {
        setOnline(false);
        return ok();
      });

      setOnline(true);
      let result = { processed: 0, failed: 0 };
      await act(async () => {
        result = await flushOfflineQueue();
      });

      expect(result).toEqual({ processed: 1, failed: 0 });
      expect(getOfflineQueue().map((i) => i.endpoint)).toEqual([
        "/api/telemetry/b",
      ]);
    });
  });

  describe("duplicate ids", () => {
    it("replaces the queued entry in place, so the newer body is the one sent (#2552)", async () => {
      await enqueueTelemetry("first");
      await enqueueTelemetry("dup", { id: "same-id" });
      await enqueueTelemetry("last");
      await enqueueTelemetry("dup-second", { id: "same-id" });

      expect(getOfflineQueue().map((i) => i.endpoint)).toEqual([
        "/api/telemetry/first",
        "/api/telemetry/dup-second",
        "/api/telemetry/last",
      ]);

      setOnline(true);
      let result = { processed: 0, failed: 0 };
      await act(async () => {
        result = await flushOfflineQueue();
      });

      expect(result).toEqual({ processed: 3, failed: 0 });
      expect(postedEndpoints()).toEqual([
        "/api/telemetry/first",
        "/api/telemetry/dup-second",
        "/api/telemetry/last",
      ]);
      expect(mockPost.mock.calls[1][1]).toEqual({ label: "dup-second" });
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("restarts the retry count when a failed entry is replaced (#2552)", async () => {
      await enqueueTelemetry("dup", { id: "same-id" });
      mockPost.mockResolvedValueOnce(response({ status: 500 }));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      expect(getOfflineQueue().map((i) => i.retries)).toEqual([1]);

      setOnline(false);
      await enqueueTelemetry("dup-second", { id: "same-id" });

      expect(getOfflineQueue()).toHaveLength(1);
      expect(getOfflineQueue()[0]).toMatchObject({
        endpoint: "/api/telemetry/dup-second",
        retries: 0,
      });
    });
  });

  describe("replacement while a request is in flight (#3795)", () => {
    /** Holds the next POST open until the test resolves or rejects it. */
    function holdNextPost() {
      let finish!: (value: ApiClientResponse<unknown>) => void;
      let fail!: (error: Error) => void;
      mockPost.mockImplementationOnce(
        () =>
          new Promise<ApiClientResponse<unknown>>((resolve, reject) => {
            finish = resolve;
            fail = reject;
          })
      );
      return {
        finish: (value: ApiClientResponse<unknown>) => finish(value),
        fail: (error: Error) => fail(error),
      };
    }

    function bodies(): unknown[] {
      return mockPost.mock.calls.map((call) => call[1]);
    }

    async function startFlush() {
      setOnline(true);
      let done!: Promise<unknown>;
      await act(async () => {
        done = flushOfflineQueue();
        await vi.advanceTimersByTimeAsync(0);
      });
      // Wrapped so awaiting startFlush doesn't wait for the flush itself.
      return { done };
    }

    it("keeps and then sends the newer body when the older one succeeds", async () => {
      await enqueueTelemetry("v1", { id: "K" });
      const held = holdNextPost();
      const { done: flush } = await startFlush();

      await enqueueTelemetry("v2", { id: "K" });
      held.finish(ok());
      await act(async () => {
        await flush;
      });

      expect(bodies()).toEqual([{ label: "v1" }, { label: "v2" }]);
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("leaves the newer body's retry count alone when the older one gets a retryable error", async () => {
      await enqueueTelemetry("v1", { id: "K" });
      const held = holdNextPost();
      const { done: flush } = await startFlush();

      await enqueueTelemetry("v2", { id: "K" });
      mockPost.mockResolvedValueOnce(response({ status: 503 }));
      held.finish(response({ status: 503 }));
      await act(async () => {
        await flush;
      });

      // v2's own attempt failed once; v1's failure was not counted against it.
      expect(bodies()).toEqual([{ label: "v1" }, { label: "v2" }]);
      expect(getOfflineQueue()).toHaveLength(1);
      expect(getOfflineQueue()[0]).toMatchObject({
        body: { label: "v2" },
        retries: 1,
      });
    });

    it("keeps the newer body when the older one is rejected for good", async () => {
      await enqueueTelemetry("v1", { id: "K" });
      const held = holdNextPost();
      const { done: flush } = await startFlush();

      await enqueueTelemetry("v2", { id: "K" });
      held.finish(response({ status: 422, error: "bad v1" }));
      await act(async () => {
        await flush;
      });

      // The rejected body was already replaced, so it is not dead-lettered.
      expect(getDLQLength()).toBe(0);
      expect(bodies()).toEqual([{ label: "v1" }, { label: "v2" }]);
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("keeps the newer body when the older send throws", async () => {
      await enqueueTelemetry("v1", { id: "K" });
      const held = holdNextPost();
      const { done: flush } = await startFlush();

      await enqueueTelemetry("v2", { id: "K" });
      mockPost.mockRejectedValueOnce(new Error("still down"));
      held.fail(new Error("socket hang up"));
      await act(async () => {
        await flush;
      });

      expect(getOfflineQueue()[0]).toMatchObject({
        body: { label: "v2" },
        retries: 1,
      });
    });

    it("does not let a DLQ retry overwrite a newer queued body", async () => {
      await enqueueTelemetry("v1", { id: "K" });
      mockPost.mockResolvedValueOnce(response({ status: 400, error: "bad" }));
      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      expect(getDLQLength()).toBe(1);

      setOnline(false);
      await enqueueTelemetry("v2", { id: "K" });
      await retryDLQItem("K");

      expect(getDLQLength()).toBe(0);
      expect(getOfflineQueue().map((item) => item.body)).toEqual([
        { label: "v2" },
      ]);
    });
  });

  describe("retry paths", () => {
    it("dead-letters a retryable item with its last failure reason once maxRetries is exhausted, and continues with the next (#2552)", async () => {
      await enqueueTelemetry("a", { maxRetries: 1 });
      await enqueueTelemetry("b");
      mockPost.mockResolvedValueOnce(
        response({ status: 503, error: "Service Unavailable" })
      );

      setOnline(true);
      let result = { processed: 0, failed: 0 };
      await act(async () => {
        result = await flushOfflineQueue();
      });

      expect(result).toEqual({ processed: 1, failed: 1 });
      expect(postedEndpoints()).toEqual([
        "/api/telemetry/a",
        "/api/telemetry/b",
      ]);
      expect(getOfflineQueueLength()).toBe(0);
      expect(getDLQ()).toEqual([
        expect.objectContaining({
          endpoint: "/api/telemetry/a",
          statusCode: 503,
          failureReason: "Service Unavailable",
        }),
      ]);
      expect(logger.error).toHaveBeenCalled();
    });

    it("names the status, or a network error, when an exhausted response carries no error text (#2552)", async () => {
      await enqueueTelemetry("a", { maxRetries: 1 });
      await enqueueTelemetry("b", { maxRetries: 1 });
      mockPost
        .mockResolvedValueOnce(response({ status: 500 }))
        .mockResolvedValueOnce(response({ status: 0, networkError: true }));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });

      expect(
        getDLQ().map((i) => [i.endpoint, i.statusCode, i.failureReason])
      ).toEqual([
        ["/api/telemetry/a", 500, "HTTP 500"],
        ["/api/telemetry/b", 0, "Network error"],
      ]);
    });

    it("retries 429 and 408 with backoff instead of dead-lettering them", async () => {
      await enqueueTelemetry("a");
      mockPost
        .mockResolvedValueOnce(response({ status: 429 }))
        .mockResolvedValueOnce(response({ status: 408 }));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      expect(getOfflineQueue()[0].retries).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      await settle();
      expect(getOfflineQueue()[0].retries).toBe(2);
      expect(getDLQLength()).toBe(0);

      // Second backoff is 1000 * 2^2 ms.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      await settle();
      expect(getOfflineQueueLength()).toBe(0);
      expect(mockPost).toHaveBeenCalledTimes(3);
    });

    it("treats a thrown client error as retryable and schedules a backoff", async () => {
      await enqueueTelemetry("a");
      await enqueueTelemetry("b");
      mockPost.mockRejectedValueOnce(new Error("boom"));

      setOnline(true);
      let result = { processed: 0, failed: 0 };
      await act(async () => {
        result = await flushOfflineQueue();
      });

      expect(result).toEqual({ processed: 0, failed: 1 });
      expect(getOfflineQueue().map((i) => i.retries)).toEqual([1, 0]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      await settle();
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("dead-letters a thrown item with the error message once its maxRetries is exhausted, and continues (#2552)", async () => {
      await enqueueTelemetry("a", { maxRetries: 1 });
      await enqueueTelemetry("b");
      await enqueueTelemetry("c", { maxRetries: 1 });
      mockPost
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(ok())
        .mockRejectedValueOnce("not an Error");

      setOnline(true);
      let result = { processed: 0, failed: 0 };
      await act(async () => {
        result = await flushOfflineQueue();
      });

      expect(result).toEqual({ processed: 1, failed: 2 });
      expect(getOfflineQueueLength()).toBe(0);
      expect(
        getDLQ().map((i) => [i.endpoint, i.statusCode, i.failureReason])
      ).toEqual([
        ["/api/telemetry/a", 0, "boom"],
        ["/api/telemetry/c", 0, "Request failed"],
      ]);
    });

    it("caps the backoff delay at 30 seconds", async () => {
      await enqueueTelemetry("a", { maxRetries: 10 });
      mockPost.mockResolvedValue(response({ status: 500 }));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      // Retries 1 to 4 wait 2, 4, 8 and 16 seconds.
      for (const delay of [2000, 4000, 8000, 16000]) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(delay);
        });
      }
      expect(mockPost).toHaveBeenCalledTimes(5);
      expect(getOfflineQueue()[0].retries).toBe(5);

      // 1000 * 2^5 would be 32s; the cap brings it to 30s.
      mockPost.mockResolvedValue(ok());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(29999);
      });
      expect(mockPost).toHaveBeenCalledTimes(5);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      await settle();
      expect(mockPost).toHaveBeenCalledTimes(6);
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("holds the retry deadline when a manual flush starts early", async () => {
      await enqueueTelemetry("a");
      mockPost.mockResolvedValueOnce(response({ status: 500 }));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      expect(mockPost).toHaveBeenCalledTimes(1);

      // Not due yet, so an early flush sends nothing.
      let early = { processed: -1, failed: -1 };
      await act(async () => {
        early = await flushOfflineQueue();
      });
      expect(early).toEqual({ processed: 0, failed: 0 });
      expect(mockPost).toHaveBeenCalledTimes(1);

      // The rescheduled wake sends it once at the deadline, and only once.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      await settle();
      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(getOfflineQueueLength()).toBe(0);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it("cancels a pending backoff timer when the queue is cleared", async () => {
      await enqueueTelemetry("a");
      mockPost.mockResolvedValueOnce(response({ status: 500 }));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      await clearOfflineQueue();
      await enqueueTelemetry("b");
      // Enqueue while online schedules its own microtask flush.
      await settle();
      expect(postedEndpoints()).toEqual([
        "/api/telemetry/a",
        "/api/telemetry/b",
      ]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it("shares one pass between flushes that overlap", async () => {
      await enqueueTelemetry("a");
      let release: (value: ApiClientResponse<unknown>) => void = () => {};
      mockPost.mockImplementationOnce(
        () =>
          new Promise<ApiClientResponse<unknown>>((resolve) => {
            release = resolve;
          })
      );

      setOnline(true);
      const first = flushOfflineQueue();
      await vi.advanceTimersByTimeAsync(0);
      const second = flushOfflineQueue();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockPost).toHaveBeenCalledTimes(1);

      release(ok());
      await expect(first).resolves.toEqual({ processed: 1, failed: 0 });
      await expect(second).resolves.toEqual({ processed: 1, failed: 0 });
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it("returns an empty summary when offline or when nothing is queued", async () => {
      await expect(flushOfflineQueue()).resolves.toEqual({
        processed: 0,
        failed: 0,
      });
      await enqueueTelemetry("a");
      await expect(flushOfflineQueue()).resolves.toEqual({
        processed: 0,
        failed: 0,
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it("re-enqueues a dead-lettered item on retryDLQItem and ignores unknown ids", async () => {
      await enqueueTelemetry("a", { id: "dl-1" });
      mockPost.mockResolvedValueOnce(response({ status: 400, error: "bad" }));
      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      expect(getDLQLength()).toBe(1);

      await retryDLQItem("does-not-exist");
      expect(getDLQLength()).toBe(1);

      setOnline(false);
      await retryDLQItem("dl-1");
      expect(getDLQLength()).toBe(0);
      const requeued = getOfflineQueue();
      expect(requeued).toHaveLength(1);
      expect(requeued[0]).toMatchObject({ id: "dl-1", retries: 0 });
    });

    it("keeps one dead letter per id when a dead letter fails again (#2552)", async () => {
      await enqueueTelemetry("a", { id: "dl-1" });
      mockPost.mockResolvedValueOnce(response({ status: 400, error: "bad" }));
      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      expect(getDLQLength()).toBe(1);

      mockPost.mockResolvedValueOnce(
        response({ status: 422, error: "still bad" })
      );
      await act(async () => {
        await enqueueTelemetry("a", { id: "dl-1" });
        await flushOfflineQueue();
      });

      expect(getDLQ()).toEqual([
        expect.objectContaining({ id: "dl-1", failureReason: "still bad" }),
      ]);
    });
  });

  describe("HTTP methods and bodies", () => {
    it("dispatches each method to the matching client call", async () => {
      await enqueueTelemetry("put", { method: "PUT" });
      await enqueueTelemetry("patch", { method: "PATCH" });
      await enqueueTelemetry("delete", { method: "DELETE" });
      await enqueueOfflineRequest({
        type: "telemetry",
        endpoint: "/api/no-method",
        body: { x: 1 },
      });

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });

      expect(mockPut).toHaveBeenCalledWith(
        "/api/telemetry/put",
        { label: "put" },
        expect.objectContaining({ headers: expect.any(Object) })
      );
      expect(mockPatch).toHaveBeenCalledWith(
        "/api/telemetry/patch",
        { label: "patch" },
        expect.any(Object)
      );
      expect(mockDelete).toHaveBeenCalledWith(
        "/api/telemetry/delete",
        expect.any(Object)
      );
      expect(mockPost).toHaveBeenCalledWith(
        "/api/no-method",
        { x: 1 },
        expect.any(Object)
      );
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("sends one Idempotency-Key per stored version, so a replay can be recognized (#3807)", async () => {
      vi.setSystemTime(1_000);
      await enqueueTelemetry("v1", { id: "K" });
      mockPost.mockResolvedValueOnce(response({ status: 503 }));
      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      await settle();
      // The id is enqueued again after its first request was acknowledged.
      setOnline(false);
      vi.setSystemTime(9_000);
      await enqueueTelemetry("v2", { id: "K" });
      await enqueueTelemetry("v3", { id: "K" });
      await enqueueOfflineRequest({
        type: "telemetry",
        endpoint: "/api/own-key",
        headers: { "idempotency-key": "caller-key" },
        body: {},
      });
      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });

      const headers = mockPost.mock.calls.map(
        (call) => (call[2] as RequestInit).headers as Record<string, string>
      );
      expect(
        headers.map((h) => h["Idempotency-Key"] ?? h["idempotency-key"])
      ).toEqual([
        // The retry of the first version reuses its key.
        "K:0:1000",
        "K:0:1000",
        // The re-enqueued id restarts at revision 0, and its replacement
        // gets revision 1: both differ from the first key.
        "K:1:9000",
        "caller-key",
      ]);
    });

    it("parses string bodies that hold JSON and passes other strings through", async () => {
      await enqueueOfflineRequest({
        type: "telemetry",
        endpoint: "/api/json-string",
        body: '{"a":1}',
      });
      await enqueueOfflineRequest({
        type: "telemetry",
        endpoint: "/api/plain-string",
        body: "not json",
      });

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });

      expect(mockPost.mock.calls[0][1]).toEqual({ a: 1 });
      expect(mockPost.mock.calls[1][1]).toBe("not json");
    });
  });

  describe("dead-letter failure reasons", () => {
    async function deadLetterReason(
      res: ApiClientResponse<unknown>
    ): Promise<string> {
      await clearDLQ();
      await enqueueTelemetry("reason");
      mockPost.mockResolvedValueOnce(res);
      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      setOnline(false);
      const dlq = getDLQ();
      expect(dlq).toHaveLength(1);
      return dlq[0].failureReason;
    }

    it("prefers the envelope error string", async () => {
      await expect(
        deadLetterReason(response({ status: 400, error: "Envelope error" }))
      ).resolves.toBe("Envelope error");
    });

    it("falls back to the first envelope detail message", async () => {
      await expect(
        deadLetterReason(
          response({
            status: 400,
            details: [{ path: "slug", message: "Slug is required" }],
          })
        )
      ).resolves.toBe("Slug is required");
    });

    it("ignores a detail whose message is not a string", async () => {
      await expect(
        deadLetterReason(
          response({
            status: 400,
            details: fromAny([{ path: "slug", message: 42 }]),
          })
        )
      ).resolves.toBe("HTTP 400: Client Error");
    });

    it("reads message, error and details from an object body", async () => {
      await expect(
        deadLetterReason(response({ status: 400, body: { message: "m" } }))
      ).resolves.toBe("m");
      await expect(
        deadLetterReason(response({ status: 400, body: { error: "e" } }))
      ).resolves.toBe("e");
      await expect(
        deadLetterReason(
          response({ status: 400, body: { details: [{ message: "d" }] } })
        )
      ).resolves.toBe("d");
      await expect(
        deadLetterReason(response({ status: 404, body: { other: true } }))
      ).resolves.toBe("HTTP 404: Client Error");
    });

    it("uses a non-empty string body verbatim", async () => {
      await expect(
        deadLetterReason(response({ status: 400, body: "Plain text failure" }))
      ).resolves.toBe("Plain text failure");
    });

    it("reads a cloned Response-like json() body when the envelope is empty", async () => {
      const raw = Object.assign(response({ status: 400 }), {
        clone: () => ({ json: async () => ({ message: "cloned message" }) }),
      });
      await expect(deadLetterReason(raw)).resolves.toBe("cloned message");
    });

    it("reads error and details from a json() body", async () => {
      await expect(
        deadLetterReason(
          Object.assign(response({ status: 400 }), {
            json: async () => ({ error: "json error" }),
          })
        )
      ).resolves.toBe("json error");
      await expect(
        deadLetterReason(
          Object.assign(response({ status: 400 }), {
            json: async () => ({ details: [{ message: "json detail" }] }),
          })
        )
      ).resolves.toBe("json detail");
      await expect(
        deadLetterReason(
          Object.assign(response({ status: 400 }), {
            json: async () => ({ unrelated: 1 }),
          })
        )
      ).resolves.toBe("HTTP 400: Client Error");
    });

    it("falls back to text() when json() rejects, and uses a string payload", async () => {
      await expect(
        deadLetterReason(
          Object.assign(response({ status: 400 }), {
            json: async () => {
              throw new SyntaxError("bad json");
            },
            text: async () => "text after json failure",
          })
        )
      ).resolves.toBe("text after json failure");
    });

    it("keeps the default when json() rejects and there is no text()", async () => {
      await expect(
        deadLetterReason(
          Object.assign(response({ status: 400 }), {
            json: async () => {
              throw new SyntaxError("bad json");
            },
          })
        )
      ).resolves.toBe("HTTP 400: Client Error");
    });

    it("reads text() when there is no json()", async () => {
      await expect(
        deadLetterReason(
          Object.assign(response({ status: 400 }), {
            text: async () => "only text",
          })
        )
      ).resolves.toBe("only text");
      await expect(
        deadLetterReason(
          Object.assign(response({ status: 400 }), {
            text: async () => "   ",
          })
        )
      ).resolves.toBe("HTTP 400: Client Error");
    });

    it("keeps the default reason when reading the body throws", async () => {
      await expect(
        deadLetterReason(
          Object.assign(response({ status: 400 }), {
            text: async () => {
              throw new Error("stream locked");
            },
          })
        )
      ).resolves.toBe("HTTP 400: Client Error");
    });

    it("keeps the default for a whitespace-only string body with nothing else to read", async () => {
      await expect(
        deadLetterReason(response({ status: 400, body: "   " }))
      ).resolves.toBe("HTTP 400: Client Error");
    });
  });

  describe("hook surface", () => {
    it("tracks online/offline transitions", async () => {
      setOnline(true);
      const { result } = renderHook(() => useOfflineQueue());
      expect(result.current.isOnline).toBe(true);

      await act(async () => {
        setOnline(false);
        window.dispatchEvent(new Event("offline"));
      });
      expect(result.current.isOnline).toBe(false);
    });

    it("does not auto-flush on mount when autoFlushOnOnline is false", async () => {
      await enqueueTelemetry("a");
      setOnline(true);
      const { result } = renderHook(() =>
        useOfflineQueue({ autoFlushOnOnline: false })
      );
      await settle();

      expect(mockPost).not.toHaveBeenCalled();
      expect(result.current.queueLength).toBe(1);

      let summary = { processed: 0, failed: 0 };
      await act(async () => {
        summary = await result.current.flush();
      });
      expect(summary).toEqual({ processed: 1, failed: 0 });
      expect(result.current.queueLength).toBe(0);
    });

    it("auto-flushes a non-empty queue on mount when online", async () => {
      await enqueueTelemetry("a");
      setOnline(true);
      const { result } = renderHook(() => useOfflineQueue());
      await settle();

      expect(postedEndpoints()).toEqual(["/api/telemetry/a"]);
      expect(result.current.queueLength).toBe(0);
    });

    it("exposes dequeue and clear", async () => {
      const { result } = renderHook(() =>
        useOfflineQueue({ autoFlushOnOnline: false })
      );
      let firstId = "";
      await act(async () => {
        firstId = (
          await result.current.enqueue({
            type: "telemetry",
            endpoint: "/api/one",
            body: {},
          })
        ).id;
        await result.current.enqueue({
          type: "telemetry",
          endpoint: "/api/two",
          body: {},
        });
      });
      expect(result.current.queueLength).toBe(2);

      await act(async () => {
        await result.current.dequeue(firstId);
      });
      expect(result.current.queue.map((i) => i.endpoint)).toEqual(["/api/two"]);

      await act(async () => {
        await result.current.clear();
      });
      expect(result.current.queueLength).toBe(0);
    });
  });
});
