"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { logger } from "@/lib/logger";
import { generateId } from "@/lib/utils";

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

const STORAGE_KEY = "portfolio_offline_queue";
const QUEUE_CHANGE_EVENT = "portfolio-offline-queue-change";

interface CacheEntry {
  raw: string | null;
  items: QueuedRequest[];
}

let memoryCache: CacheEntry = {
  raw: null,
  items: [],
};

const subscribers = new Set<() => void>();
const onlineSubscribers = new Set<() => void>();

let isProcessingQueue = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function notifySubscribers() {
  subscribers.forEach((cb) => cb());
}

function notifyOnlineSubscribers() {
  onlineSubscribers.forEach((cb) => cb());
}

function isStorageAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage?.getItem === "function" &&
    typeof window.localStorage?.setItem === "function"
  );
}

function readStorage(): QueuedRequest[] {
  if (!isStorageAvailable()) {
    return memoryCache.items;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === memoryCache.raw) {
      return memoryCache.items;
    }

    if (!raw) {
      memoryCache = { raw: null, items: [] };
      return memoryCache.items;
    }

    const parsed = JSON.parse(raw) as QueuedRequest[];
    if (Array.isArray(parsed)) {
      memoryCache = { raw, items: parsed };
      return parsed;
    }
  } catch (error) {
    logger.warn("Failed to read offline queue from storage:", error);
  }

  memoryCache = { raw: null, items: [] };
  return memoryCache.items;
}

function writeStorage(items: QueuedRequest[]): void {
  memoryCache = {
    raw: isStorageAvailable() ? JSON.stringify(items) : null,
    items,
  };
  if (isStorageAvailable()) {
    try {
      const raw = JSON.stringify(items);
      window.localStorage.setItem(STORAGE_KEY, raw);
      memoryCache = { raw, items };
      window.dispatchEvent(new CustomEvent(QUEUE_CHANGE_EVENT));
    } catch (error) {
      logger.warn("Failed to write offline queue to storage:", error);
    }
  }
  notifySubscribers();
}

// Global window event listeners setup
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      memoryCache = { raw: null, items: [] };
      readStorage();
      notifySubscribers();
    }
  });

  window.addEventListener(QUEUE_CHANGE_EVENT, () => {
    readStorage();
    notifySubscribers();
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
      const res = await fetch(item.endpoint, {
        method: item.method || "POST",
        headers: item.headers || { "Content-Type": "application/json" },
        body:
          typeof item.body === "string" ? item.body : JSON.stringify(item.body),
      });

      if (
        res.ok ||
        (res.status >= 400 &&
          res.status < 500 &&
          res.status !== 429 &&
          res.status !== 408)
      ) {
        dequeueOfflineRequest(item.id);
        processed++;
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

function subscribeOnline(callback: () => void) {
  onlineSubscribers.add(callback);
  return () => {
    onlineSubscribers.delete(callback);
  };
}

function getSnapshot(): QueuedRequest[] {
  return readStorage();
}

const SERVER_SNAPSHOT: QueuedRequest[] = [];

function getServerSnapshot(): QueuedRequest[] {
  return SERVER_SNAPSHOT;
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
 * Custom hook providing access to the persistent offline request queue and online status.
 * Uses useSyncExternalStore for hydration-safe, referentially stable, cross-tab synchronized state.
 *
 * @param options Optional hook configuration options.
 */
export function useOfflineQueue(options?: UseOfflineQueueOptions) {
  const queue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
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

  return {
    queue,
    queueLength: queue.length,
    isOnline,
    isProcessing: isProcessingQueue,
    enqueue,
    dequeue,
    clear,
    flush,
  };
}
