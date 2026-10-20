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

const QUEUE_KEY = "portfolio_offline_queue";
const DLQ_KEY = "portfolio_offline_dlq";

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

/** Storage whose writes always fail, as in a full or locked-down browser. */
class ThrowingWriteStorage extends MockStorage {
  setItem(): void {
    throw new Error("QuotaExceededError");
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

/** Writes a queue directly to storage, as another tab or an older build would. */
function seedQueueFromAnotherTab(items: unknown) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  window.dispatchEvent(new StorageEvent("storage", { key: QUEUE_KEY }));
}

function postedEndpoints(): string[] {
  return mockPost.mock.calls.map((call) => String(call[0]));
}

describe("useOfflineQueue replay, ordering and retry paths (#2532)", () => {
  let originalLocalStorage: Storage;

  beforeEach(() => {
    vi.useFakeTimers();
    setOnline(false);
    clearOfflineQueue();
    clearDLQ();
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
    clearOfflineQueue();
    clearDLQ();
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
      enqueueTelemetry("a");
      enqueueTelemetry("b");
      enqueueTelemetry("c");
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
      enqueueTelemetry("a");
      enqueueTelemetry("b");
      enqueueTelemetry("c");
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
      enqueueTelemetry("a");
      enqueueTelemetry("b");
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
      enqueueTelemetry("a");
      enqueueTelemetry("b");
      enqueueTelemetry("c");
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
      enqueueTelemetry("a");
      enqueueTelemetry("b");
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
    it("does not ignore a second enqueue with the same id: both entries are stored, and one success removes both", async () => {
      // Actual semantics: enqueueOfflineRequest never deduplicates. Because
      // dequeueOfflineRequest filters by id, the first successful send
      // removes every entry sharing that id, so the request goes out once.
      enqueueTelemetry("dup", { id: "same-id" });
      enqueueTelemetry("dup-second", { id: "same-id" });

      expect(getOfflineQueueLength()).toBe(2);
      expect(getOfflineQueue().map((i) => i.id)).toEqual([
        "same-id",
        "same-id",
      ]);

      setOnline(true);
      let result = { processed: 0, failed: 0 };
      await act(async () => {
        result = await flushOfflineQueue();
      });

      expect(result).toEqual({ processed: 1, failed: 0 });
      expect(postedEndpoints()).toEqual(["/api/telemetry/dup"]);
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("bumps the retry count of every entry sharing the failed id", async () => {
      enqueueTelemetry("dup", { id: "same-id" });
      enqueueTelemetry("dup-second", { id: "same-id" });
      mockPost.mockResolvedValueOnce(response({ status: 500 }));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });

      expect(getOfflineQueue().map((i) => i.retries)).toEqual([1, 1]);
    });
  });

  describe("retry paths", () => {
    it("drops a retryable item silently once maxRetries is exhausted and continues with the next", async () => {
      enqueueTelemetry("a", { maxRetries: 1 });
      enqueueTelemetry("b");
      mockPost.mockResolvedValueOnce(response({ status: 500 }));

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
      // Exhausted retries are discarded, not dead-lettered.
      expect(getDLQLength()).toBe(0);
    });

    it("retries 429 and 408 with backoff instead of dead-lettering them", async () => {
      enqueueTelemetry("a");
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
      enqueueTelemetry("a");
      enqueueTelemetry("b");
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

    it("drops a thrown item once its maxRetries is exhausted and continues", async () => {
      enqueueTelemetry("a", { maxRetries: 1 });
      enqueueTelemetry("b");
      mockPost.mockRejectedValueOnce(new Error("boom"));

      setOnline(true);
      let result = { processed: 0, failed: 0 };
      await act(async () => {
        result = await flushOfflineQueue();
      });

      expect(result).toEqual({ processed: 1, failed: 1 });
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("defaults maxRetries to 5 for stored items that predate the field", async () => {
      seedQueueFromAnotherTab([
        {
          id: "legacy",
          type: "telemetry",
          endpoint: "/api/legacy",
          body: {},
          createdAt: 0,
          retries: 4,
        },
      ]);
      mockPost.mockResolvedValueOnce(response({ status: 500 }));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });

      // retries 4 -> 5 reaches the default ceiling of 5, so it is dropped.
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("defaults maxRetries to 5 for legacy items when the client throws", async () => {
      seedQueueFromAnotherTab([
        {
          id: "legacy",
          type: "telemetry",
          endpoint: "/api/legacy",
          body: {},
          createdAt: 0,
          retries: 3,
        },
      ]);
      mockPost.mockRejectedValueOnce(new Error("boom"));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });

      expect(getOfflineQueue()[0].retries).toBe(4);
    });

    it("caps the backoff delay at 30 seconds", async () => {
      enqueueTelemetry("a", { maxRetries: 10 });
      seedQueueFromAnotherTab(
        getOfflineQueue().map((i) => ({ ...i, retries: 6 }))
      );
      mockPost.mockResolvedValueOnce(response({ status: 500 }));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      expect(mockPost).toHaveBeenCalledTimes(1);

      // 1000 * 2^7 would be 128s; the cap brings it to 30s.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      await settle();
      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("cancels a pending backoff timer when a manual flush starts", async () => {
      enqueueTelemetry("a");
      mockPost.mockResolvedValueOnce(response({ status: 500 }));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      expect(mockPost).toHaveBeenCalledTimes(1);

      await act(async () => {
        await flushOfflineQueue();
      });
      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(getOfflineQueueLength()).toBe(0);

      // The cancelled timer must not fire a third request.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it("cancels a pending backoff timer when the queue is cleared", async () => {
      enqueueTelemetry("a");
      mockPost.mockResolvedValueOnce(response({ status: 500 }));

      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      clearOfflineQueue();
      enqueueTelemetry("b");
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

    it("ignores a flush that starts while another is still running", async () => {
      enqueueTelemetry("a");
      let release: (value: ApiClientResponse<unknown>) => void = () => {};
      mockPost.mockImplementationOnce(
        () =>
          new Promise<ApiClientResponse<unknown>>((resolve) => {
            release = resolve;
          })
      );

      setOnline(true);
      const first = flushOfflineQueue();
      const second = await flushOfflineQueue();
      expect(second).toEqual({ processed: 0, failed: 0 });

      release(ok());
      await expect(first).resolves.toEqual({ processed: 1, failed: 0 });
    });

    it("returns an empty summary when offline or when nothing is queued", async () => {
      await expect(flushOfflineQueue()).resolves.toEqual({
        processed: 0,
        failed: 0,
      });
      enqueueTelemetry("a");
      await expect(flushOfflineQueue()).resolves.toEqual({
        processed: 0,
        failed: 0,
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it("re-enqueues a dead-lettered item on retryDLQItem and ignores unknown ids", async () => {
      enqueueTelemetry("a", { id: "dl-1" });
      mockPost.mockResolvedValueOnce(response({ status: 400, error: "bad" }));
      setOnline(true);
      await act(async () => {
        await flushOfflineQueue();
      });
      expect(getDLQLength()).toBe(1);

      retryDLQItem("does-not-exist");
      expect(getDLQLength()).toBe(1);

      setOnline(false);
      retryDLQItem("dl-1");
      expect(getDLQLength()).toBe(0);
      const requeued = getOfflineQueue();
      expect(requeued).toHaveLength(1);
      expect(requeued[0]).toMatchObject({ id: "dl-1", retries: 0 });
    });
  });

  describe("HTTP methods and bodies", () => {
    it("dispatches each method to the matching client call", async () => {
      enqueueTelemetry("put", { method: "PUT" });
      enqueueTelemetry("patch", { method: "PATCH" });
      enqueueTelemetry("delete", { method: "DELETE" });
      seedQueueFromAnotherTab([
        ...getOfflineQueue(),
        {
          id: "get",
          type: "telemetry",
          endpoint: "/api/get",
          method: "get",
          body: null,
          createdAt: 0,
          retries: 0,
        },
        {
          id: "nomethod",
          type: "telemetry",
          endpoint: "/api/no-method",
          body: { x: 1 },
          createdAt: 0,
          retries: 0,
        },
      ]);

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
      expect(mockGet).toHaveBeenCalledWith("/api/get", expect.any(Object));
      expect(mockPost).toHaveBeenCalledWith(
        "/api/no-method",
        { x: 1 },
        expect.any(Object)
      );
      expect(getOfflineQueueLength()).toBe(0);
    });

    it("parses string bodies that hold JSON and passes other strings through", async () => {
      enqueueOfflineRequest({
        type: "telemetry",
        endpoint: "/api/json-string",
        body: '{"a":1}',
      });
      enqueueOfflineRequest({
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
      clearDLQ();
      enqueueTelemetry("reason");
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

  describe("storage edge cases", () => {
    it("ignores a malformed queue and dead-letter queue in storage", () => {
      localStorage.setItem(QUEUE_KEY, JSON.stringify({ not: "an array" }));
      localStorage.setItem(DLQ_KEY, JSON.stringify({ not: "an array" }));
      window.dispatchEvent(new StorageEvent("storage", { key: null }));

      expect(getOfflineQueue()).toEqual([]);
      expect(getDLQ()).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        "Ignoring malformed offline queue in storage."
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Ignoring malformed dead-letter queue in storage."
      );
    });

    it("picks up a dead-letter queue written by another tab", () => {
      const item = {
        id: "other-tab",
        type: "telemetry",
        endpoint: "/api/x",
        body: {},
        createdAt: 0,
        retries: 0,
        failedAt: 0,
        statusCode: 400,
        failureReason: "from another tab",
      };
      localStorage.setItem(DLQ_KEY, JSON.stringify([item]));
      window.dispatchEvent(new StorageEvent("storage", { key: DLQ_KEY }));
      window.dispatchEvent(new CustomEvent("portfolio-offline-dlq-change"));

      expect(getDLQ()).toEqual([item]);
    });

    it("keeps queuing in memory when localStorage writes fail", () => {
      Object.defineProperty(globalThis, "localStorage", {
        value: new ThrowingWriteStorage(),
        writable: true,
        configurable: true,
      });
      const listener = vi.fn();
      window.addEventListener("portfolio-offline-queue-change", listener);

      enqueueTelemetry("memory-only");
      clearDLQ();

      expect(getOfflineQueue().map((i) => i.endpoint)).toEqual([
        "/api/telemetry/memory-only",
      ]);
      // No cross-tab change event is dispatched for a write that never persisted.
      expect(listener).not.toHaveBeenCalled();
      window.removeEventListener("portfolio-offline-queue-change", listener);
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
      enqueueTelemetry("a");
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
      enqueueTelemetry("a");
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
        firstId = result.current.enqueue({
          type: "telemetry",
          endpoint: "/api/one",
          body: {},
        }).id;
        result.current.enqueue({
          type: "telemetry",
          endpoint: "/api/two",
          body: {},
        });
      });
      expect(result.current.queueLength).toBe(2);

      await act(async () => {
        result.current.dequeue(firstId);
      });
      expect(result.current.queue.map((i) => i.endpoint)).toEqual(["/api/two"]);

      await act(async () => {
        result.current.clear();
      });
      expect(result.current.queueLength).toBe(0);
    });
  });
});
