/**
 * How useOfflineQueue picks and fills its store (#3807, slice 2b): the
 * IndexedDB store when it opens, a one-time import of the legacy
 * localStorage arrays, and the memory store when IndexedDB is missing.
 *
 * Each test loads a fresh copy of the hook, because it opens its store once
 * per page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const QUEUE_KEY = "portfolio_offline_queue";
const DLQ_KEY = "portfolio_offline_dlq";

const legacyRow = {
  id: "legacy-1",
  type: "feedback",
  endpoint: "/api/feedback",
  method: "put",
  body: { text: "hi" },
  createdAt: 1,
  retries: 2,
};

const legacyDeadLetter = {
  id: "legacy-dead",
  type: "telemetry",
  endpoint: "/api/telemetry",
  body: {},
  createdAt: 1,
  retries: 5,
  failedAt: 2,
  statusCode: 400,
  failureReason: "bad",
};

/** Loads a fresh hook module whose store opens on `factory`. */
async function freshHook(factory: IDBFactory | undefined) {
  vi.resetModules();
  Object.defineProperty(globalThis, "indexedDB", {
    value: factory,
    writable: true,
    configurable: true,
  });
  const { logger } = await import("@/lib/logger");
  const warn = vi.spyOn(logger, "warn").mockImplementation(() => ({
    level: "warn",
    message: "",
    timestamp: "",
  }));
  const hook = await import("@/hooks/useOfflineQueue");
  return { hook, warn };
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    value,
    writable: true,
    configurable: true,
  });
}

describe("useOfflineQueue storage (#3807)", () => {
  const originalIndexedDB = Object.getOwnPropertyDescriptor(
    globalThis,
    "indexedDB"
  );

  beforeEach(() => {
    setOnline(false);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalIndexedDB) {
      Object.defineProperty(globalThis, "indexedDB", originalIndexedDB);
    } else {
      delete (globalThis as { indexedDB?: unknown }).indexedDB;
    }
  });

  it("imports the legacy arrays into IndexedDB and then removes the keys", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([legacyRow]));
    localStorage.setItem(DLQ_KEY, JSON.stringify([legacyDeadLetter]));
    const { hook } = await freshHook(new IDBFactory());

    const queue = await hook.loadOfflineQueue();

    expect(hook.getOfflineQueuePersistence()).toBe("durable");
    expect(queue).toEqual([
      expect.objectContaining({
        id: "legacy-1",
        method: "PUT",
        body: { text: "hi" },
        retries: 2,
        // Rows from before revisions and per-entry limits get the defaults.
        revision: 0,
        maxRetries: 5,
      }),
    ]);
    expect(hook.getDLQ()).toEqual([
      expect.objectContaining({ id: "legacy-dead", failureReason: "bad" }),
    ]);
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
    expect(localStorage.getItem(DLQ_KEY)).toBeNull();
  });

  it("imports only once, so a later start does not duplicate rows", async () => {
    const factory = new IDBFactory();
    localStorage.setItem(QUEUE_KEY, JSON.stringify([legacyRow]));
    await (await freshHook(factory)).hook.loadOfflineQueue();

    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([{ ...legacyRow, id: "late" }])
    );
    const { hook } = await freshHook(factory);
    const queue = await hook.loadOfflineQueue();

    expect(queue.map((entry) => entry.id)).toEqual(["legacy-1"]);
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
  });

  it("skips malformed legacy rows with a warning", async () => {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([legacyRow, { id: 7 }, "not a row"])
    );
    const { hook, warn } = await freshHook(new IDBFactory());

    const queue = await hook.loadOfflineQueue();

    expect(queue.map((entry) => entry.id)).toEqual(["legacy-1"]);
    expect(warn).toHaveBeenCalledWith(
      "Skipped malformed rows in the legacy offline queue.",
      { skipped: 2 }
    );
  });

  it("keeps queued writes durable across a reload", async () => {
    const factory = new IDBFactory();
    const first = (await freshHook(factory)).hook;
    await first.enqueueOfflineRequest({
      id: "kept",
      type: "telemetry",
      endpoint: "/api/telemetry",
      body: { n: 1 },
    });

    const { hook } = await freshHook(factory);
    const queue = await hook.loadOfflineQueue();

    expect(queue).toEqual([
      expect.objectContaining({ id: "kept", body: { n: 1 } }),
    ]);
  });

  it("holds writes in memory, marked volatile, when IndexedDB is missing", async () => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([legacyRow]));
    const { hook, warn } = await freshHook(undefined);

    await hook.enqueueOfflineRequest({
      type: "reaction",
      endpoint: "/api/reactions",
      body: { emoji: "+1" },
    });

    expect(hook.getOfflineQueuePersistence()).toBe("volatile");
    expect(warn).toHaveBeenCalledWith(
      "IndexedDB is unavailable; offline requests are held in memory only.",
      { code: "STORE_UNAVAILABLE" }
    );
    expect(hook.getOfflineQueue().map((entry) => entry.endpoint)).toEqual([
      "/api/reactions",
    ]);
    // Nothing was imported, so the legacy rows wait for a durable start.
    expect(localStorage.getItem(QUEUE_KEY)).not.toBeNull();
  });
});
