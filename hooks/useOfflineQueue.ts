"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { logger } from "@/lib/logger";
import { generateId } from "@/lib/utils";
import { safeGetItem, safeSetRawItem } from "@/lib/safe-storage";
import { apiClient, type ApiClientResponse } from "@/lib/api-client";

export type QueueItemType = "telemetry" | "reaction" | "feedback" | string;

export interface QueuedRequest<T = unknown> {
  id: string;
  type: QueueItemType;
  endpoint: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body: T;
  createdAt: number;
  retries: number;
  maxRetries?: number;
}

export interface DeadLetterItem<T = unknown> extends QueuedRequest<T> {
  failedAt: number;
  statusCode: number;
  failureReason: string;
}

const STORAGE_KEY = "portfolio_offline_queue";
const QUEUE_CHANGE_EVENT = "portfolio-offline-queue-change";

const DLQ_STORAGE_KEY = "portfolio_offline_dlq";
const DLQ_CHANGE_EVENT = "portfolio-offline-dlq-change";
const DLQ_ERROR_EVENT = "portfolio-offline-queue-error";

interface CacheEntry {
  /** The value safeStorage last returned, used to detect external changes. */
  source: unknown;
  items: QueuedRequest[];
}

interface DLQCacheEntry {
  source: unknown;
  items: DeadLetterItem[];
}

/** Forces the next read to rebuild the cache even if safeStorage is unchanged. */
const STALE = Symbol("stale");

let memoryCache: CacheEntry = {
  source: null,
  items: [],
};

let memoryDLQCache: DLQCacheEntry = {
  source: null,
  items: [],
};

const subscribers = new Set<() => void>();
const dlqSubscribers = new Set<() => void>();
const onlineSubscribers = new Set<() => void>();

let isProcessingQueue = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function notifySubscribers() {
  subscribers.forEach((cb) => cb());
}

function notifyDLQSubscribers() {
  dlqSubscribers.forEach((cb) => cb());
}

function notifyOnlineSubscribers() {
  onlineSubscribers.forEach((cb) => cb());
}

function readStorage(): QueuedRequest[] {
  // safeStorage returns the same parsed reference while the stored string is
  // unchanged, and holds the queue in memory when localStorage is unavailable.
  const stored = safeGetItem<unknown>(STORAGE_KEY);
  if (stored === memoryCache.source) {
    return memoryCache.items;
  }

  if (Array.isArray(stored)) {
    memoryCache = { source: stored, items: stored as QueuedRequest[] };
    return memoryCache.items;
  }

  if (stored !== null) {
    logger.warn("Ignoring malformed offline queue in storage.");
  }
  memoryCache = { source: stored, items: [] };
  return memoryCache.items;
}

function writeStorage(items: QueuedRequest[]): void {
  // Stored as a bare JSON array (no envelope) so queued requests from earlier
  // visits are still read back and flushed.
  const persisted = safeSetRawItem(STORAGE_KEY, JSON.stringify(items));
  memoryCache = { source: safeGetItem<unknown>(STORAGE_KEY), items };
  if (persisted && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(QUEUE_CHANGE_EVENT));
  }
  notifySubscribers();
}

function readDLQStorage(): DeadLetterItem[] {
  const stored = safeGetItem<unknown>(DLQ_STORAGE_KEY);
  if (stored === memoryDLQCache.source) {
    return memoryDLQCache.items;
  }

  if (Array.isArray(stored)) {
    memoryDLQCache = { source: stored, items: stored as DeadLetterItem[] };
    return memoryDLQCache.items;
  }

  if (stored !== null) {
    logger.warn("Ignoring malformed dead-letter queue in storage.");
  }
  memoryDLQCache = { source: stored, items: [] };
  return memoryDLQCache.items;
}

function writeDLQStorage(items: DeadLetterItem[]): void {
  // Cap dead-letter queue size at 50 items using FIFO eviction.
  const capped = items.slice(-50);
  const persisted = safeSetRawItem(DLQ_STORAGE_KEY, JSON.stringify(capped));
  memoryDLQCache = {
    source: safeGetItem<unknown>(DLQ_STORAGE_KEY),
    items: capped,
  };
  if (persisted && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DLQ_CHANGE_EVENT));
  }
  notifyDLQSubscribers();
}

// Global window event listeners setup
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      memoryCache = { source: STALE, items: [] };
      readStorage();
      notifySubscribers();
    }
    if (e.key === DLQ_STORAGE_KEY || e.key === null) {
      memoryDLQCache = { source: STALE, items: [] };
      readDLQStorage();
      notifyDLQSubscribers();
    }
  });

  window.addEventListener(QUEUE_CHANGE_EVENT, () => {
    readStorage();
    notifySubscribers();
  });

  window.addEventListener(DLQ_CHANGE_EVENT, () => {
    readDLQStorage();
    notifyDLQSubscribers();
  });

  window.addEventListener("online", () => {
    notifyOnlineSubscribers();
    flushOfflineQueue();
  });

  window.addEventListener("offline", () => {
    notifyOnlineSubscribers();
  });
}

/**
 * Enqueue a request to be executed when online.
 *
 * @param request Request configuration excluding auto-generated metadata.
 * @returns Complete QueuedRequest object with assigned ID.
 */
export function enqueueOfflineRequest<T = unknown>(
  request: Omit<QueuedRequest<T>, "id" | "createdAt" | "retries"> & {
    id?: string;
  }
): QueuedRequest<T> {
  const current = readStorage();

  const id = request.id || generateId("offline_", { timestamp: true });

  const newEntry: QueuedRequest<T> = {
    id,
    type: request.type,
    endpoint: request.endpoint,
    method: request.method || "POST",
    headers: request.headers || { "Content-Type": "application/json" },
    body: request.body,
    createdAt: Date.now(),
    retries: 0,
    maxRetries: request.maxRetries ?? 5,
  };

  const updated = [...current, newEntry as QueuedRequest];
  writeStorage(updated);

  if (typeof navigator !== "undefined" && navigator.onLine) {
    Promise.resolve().then(() => flushOfflineQueue());
  }

  return newEntry;
}

/**
 * Remove an item from the offline queue by its unique ID.
 *
 * @param id Unique identifier of the queued request.
 */
export function dequeueOfflineRequest(id: string): void {
  const current = readStorage();
  const updated = current.filter((item) => item.id !== id);
  writeStorage(updated);
}

/**
 * Clear all items from the offline queue.
 */
export function clearOfflineQueue(): void {
  writeStorage([]);
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

/**
 * Get shallow array copy of current offline queue items.
 *
 * @returns Array of currently queued requests.
 */
export function getOfflineQueue(): QueuedRequest[] {
  return [...readStorage()];
}

/**
 * Get length of current offline queue.
 *
 * @returns Total count of queued items.
 */
export function getOfflineQueueLength(): number {
  return readStorage().length;
}

/**
 * Get shallow array copy of current dead-letter queue items.
 *
 * @returns Array of dead-letter queued requests.
 */
export function getDLQ(): DeadLetterItem[] {
  return [...readDLQStorage()];
}

/**
 * Get length of current dead-letter queue.
 *
 * @returns Total count of dead-letter items.
 */
export function getDLQLength(): number {
  return readDLQStorage().length;
}

/**
 * Clear all items from the dead-letter queue.
 */
export function clearDLQ(): void {
  writeDLQStorage([]);
}

/**
 * Remove an item from the dead-letter queue by its unique ID.
 *
 * @param id Unique identifier of the dead-letter item.
 */
export function dismissDLQItem(id: string): void {
  const current = readDLQStorage();
  const updated = current.filter((item) => item.id !== id);
  writeDLQStorage(updated);
}

/**
 * Retry an item from the dead-letter queue by re-enqueueing it into the offline queue.
 *
 * @param id Unique identifier of the dead-letter item to retry.
 */
export function retryDLQItem(id: string): void {
  const currentDLQ = readDLQStorage();
  const itemToRetry = currentDLQ.find((item) => item.id === id);
  if (!itemToRetry) return;

  dismissDLQItem(id);
  enqueueOfflineRequest({
    id: itemToRetry.id,
    type: itemToRetry.type,
    endpoint: itemToRetry.endpoint,
    method: itemToRetry.method,
    headers: itemToRetry.headers,
    body: itemToRetry.body,
    maxRetries: itemToRetry.maxRetries,
  });
}

/**
 * Process queued requests sequentially with exponential backoff retries.
 *
 * @returns Object summarizing processed and failed items count.
 */
export async function flushOfflineQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  if (isProcessingQueue) {
    return { processed: 0, failed: 0 };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  const initialItems = readStorage();
  if (initialItems.length === 0) {
    return { processed: 0, failed: 0 };
  }

  isProcessingQueue = true;
  let processed = 0;
  let failed = 0;

  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  while (readStorage().length > 0) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      break;
    }

    const currentQueue = readStorage();
    if (currentQueue.length === 0) break;

    const item = currentQueue[0];

    try {
      const method = (item.method || "POST").toUpperCase();
      const init: RequestInit = {
        headers: item.headers,
      };

      let body = item.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          // Keep as string if not valid JSON
        }
      }

      let res: ApiClientResponse<unknown>;
      switch (method) {
        case "GET":
          res = await apiClient.get(item.endpoint, init);
          break;
        case "PUT":
          res = await apiClient.put(item.endpoint, body, init);
          break;
        case "PATCH":
          res = await apiClient.patch(item.endpoint, body, init);
          break;
        case "DELETE":
          res = await apiClient.delete(item.endpoint, init);
          break;
        case "POST":
        default:
          res = await apiClient.post(item.endpoint, body, init);
          break;
      }

      if (res.ok) {
        dequeueOfflineRequest(item.id);
        processed++;
      } else if (
        res.status >= 400 &&
        res.status < 500 &&
        res.status !== 429 &&
        res.status !== 408
      ) {
        failed++;
        let failureReason = `HTTP ${res.status}: Client Error`;
        try {
          type ResObj = {
            clone?: () => ResObj;
            json?: () => Promise<unknown>;
            text?: () => Promise<string>;
          };
          const resObj = res as unknown as ResObj;
          const targetRes: ResObj =
            typeof resObj.clone === "function" ? resObj.clone() : resObj;
          let data: unknown;
          if (typeof targetRes.json === "function") {
            try {
              data = await targetRes.json();
            } catch {
              if (typeof targetRes.text === "function") {
                data = await targetRes.text();
              }
            }
          } else if (typeof targetRes.text === "function") {
            data = await targetRes.text();
          }

          if (data && typeof data === "object") {
            const obj = data as Record<string, unknown>;
            if (typeof obj.message === "string") failureReason = obj.message;
            else if (typeof obj.error === "string") failureReason = obj.error;
            else if (
              Array.isArray(obj.details) &&
              typeof obj.details[0]?.message === "string"
            ) {
              failureReason = obj.details[0].message;
            }
          } else if (typeof data === "string" && data.trim().length > 0) {
            failureReason = data;
          }
        } catch {
          // Fallback to default failureReason if reading fails
        }

        const deadLetterItem: DeadLetterItem = {
          ...item,
          failedAt: Date.now(),
          statusCode: res.status,
          failureReason,
        };

        const currentDLQ = readDLQStorage();
        writeDLQStorage([...currentDLQ, deadLetterItem]);
        dequeueOfflineRequest(item.id);

        logger.error(
          `Offline request failed with status ${res.status} and moved to DLQ`,
          { deadLetterItem }
        );

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(DLQ_ERROR_EVENT, { detail: deadLetterItem })
          );
        }
      } else {
        failed++;
        const nextRetries = item.retries + 1;
        const maxRetries = item.maxRetries ?? 5;

        if (nextRetries >= maxRetries) {
          dequeueOfflineRequest(item.id);
        } else {
          const updatedQueue = readStorage().map((i) =>
            i.id === item.id ? { ...i, retries: nextRetries } : i
          );
          writeStorage(updatedQueue);

          const delay = Math.min(1000 * Math.pow(2, nextRetries), 30000);
          retryTimer = setTimeout(() => {
            retryTimer = null;
            flushOfflineQueue();
          }, delay);

          break;
        }
      }
    } catch {
      failed++;
      const nextRetries = item.retries + 1;
      const maxRetries = item.maxRetries ?? 5;

      if (nextRetries >= maxRetries) {
        dequeueOfflineRequest(item.id);
      } else {
        const updatedQueue = readStorage().map((i) =>
          i.id === item.id ? { ...i, retries: nextRetries } : i
        );
        writeStorage(updatedQueue);

        const delay = Math.min(1000 * Math.pow(2, nextRetries), 30000);
        retryTimer = setTimeout(() => {
          retryTimer = null;
          flushOfflineQueue();
        }, delay);

        break;
      }
    }
  }

  isProcessingQueue = false;
  return { processed, failed };
}

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function subscribeDLQ(callback: () => void) {
  dlqSubscribers.add(callback);
  return () => {
    dlqSubscribers.delete(callback);
  };
}

function subscribeOnline(callback: () => void) {
  onlineSubscribers.add(callback);
  return () => {
    onlineSubscribers.delete(callback);
  };
}

function getSnapshot(): QueuedRequest[] {
  return readStorage();
}

function getDLQSnapshot(): DeadLetterItem[] {
  return readDLQStorage();
}

const SERVER_SNAPSHOT: QueuedRequest[] = [];
const SERVER_DLQ_SNAPSHOT: DeadLetterItem[] = [];

function getServerSnapshot(): QueuedRequest[] {
  return SERVER_SNAPSHOT;
}

function getServerDLQSnapshot(): DeadLetterItem[] {
  return SERVER_DLQ_SNAPSHOT;
}

function getOnlineSnapshot(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

export interface UseOfflineQueueOptions {
  autoFlushOnOnline?: boolean;
}

/**
 * Custom hook providing access to the persistent offline request queue, dead-letter queue, and online status.
 * Uses useSyncExternalStore for hydration-safe, referentially stable, cross-tab synchronized state.
 *
 * @param options Optional hook configuration options.
 */
export function useOfflineQueue(options?: UseOfflineQueueOptions) {
  const queue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dlqQueue = useSyncExternalStore(
    subscribeDLQ,
    getDLQSnapshot,
    getServerDLQSnapshot
  );
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );

  useEffect(() => {
    if (options?.autoFlushOnOnline !== false && isOnline && queue.length > 0) {
      flushOfflineQueue();
    }
  }, [isOnline, queue.length, options?.autoFlushOnOnline]);

  const enqueue = useCallback(
    <T = unknown>(
      request: Omit<QueuedRequest<T>, "id" | "createdAt" | "retries"> & {
        id?: string;
      }
    ) => enqueueOfflineRequest(request),
    []
  );

  const dequeue = useCallback((id: string) => dequeueOfflineRequest(id), []);
  const clear = useCallback(() => clearOfflineQueue(), []);
  const flush = useCallback(() => flushOfflineQueue(), []);
  const clearDLQCallback = useCallback(() => clearDLQ(), []);
  const dismissDLQItemCallback = useCallback(
    (id: string) => dismissDLQItem(id),
    []
  );
  const retryDLQItemCallback = useCallback(
    (id: string) => retryDLQItem(id),
    []
  );

  return {
    queue,
    queueLength: queue.length,
    dlqQueue,
    dlqLength: dlqQueue.length,
    isOnline,
    isProcessing: isProcessingQueue,
    enqueue,
    dequeue,
    clear,
    flush,
    clearDLQ: clearDLQCallback,
    dismissDLQItem: dismissDLQItemCallback,
    retryDLQItem: retryDLQItemCallback,
  };
}
