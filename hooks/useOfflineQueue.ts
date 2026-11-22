"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { logger } from "@/lib/logger";
import { generateId } from "@/lib/utils";
import { safeGetItem, safeRemoveItem } from "@/lib/safe-storage";
import { apiClient, type ApiClientResponse } from "@/lib/api-client";
import {
  createMemoryOfflineQueueStore,
  createOfflineDispatcher,
  openOfflineQueueStore,
  type OfflineDeadLetter,
  type OfflineDeadLetterFailure,
  type OfflineDispatcher,
  type OfflineQueueEntry,
  type OfflineQueueMethod,
  type OfflineQueueStore,
  type OfflineSendOutcome,
} from "@/lib/offline-queue";

/**
 * The offline request queue, on the IndexedDB store and dispatcher in
 * `lib/offline-queue` (#3807). Every change is one store transaction, and
 * tabs coordinate sends through claims with leases, so two tabs neither
 * lose each other's writes nor send the same revision at once.
 *
 * Changes are asynchronous: a promise resolves once the store committed and
 * the snapshot below shows it. Where IndexedDB is unavailable, the queue
 * falls back to memory and reports `persistence: "volatile"`; callers must
 * not tell the visitor such a write was saved.
 */

export type QueueItemType = "telemetry" | "reaction" | "feedback" | string;

/** A queued request, as the store holds it. */
export type QueuedRequest<T = unknown> = OfflineQueueEntry<T>;

/** A request that failed for good. */
export type DeadLetterItem<T = unknown> = OfflineDeadLetter<T>;

/**
 * Whether queued writes survive a reload: `pending` until the store opens,
 * then `durable` (IndexedDB) or `volatile` (memory only).
 */
export type OfflineQueuePersistence = "pending" | "durable" | "volatile";

/** What a caller provides to enqueue. */
export interface OfflineRequestInput<T = unknown> {
  id?: string;
  type: QueueItemType;
  endpoint: string;
  method?: OfflineQueueMethod;
  headers?: Record<string, string>;
  body: T;
  maxRetries?: number;
}

/** Legacy localStorage keys, imported once and then removed. */
const LEGACY_QUEUE_KEY = "portfolio_offline_queue";
const LEGACY_DLQ_KEY = "portfolio_offline_dlq";
/** Event fired on `window` when a request this tab sent is dead-lettered. */
const DLQ_ERROR_EVENT = "portfolio-offline-queue-error";
/** Channel that tells other tabs to reread the store. */
const CHANNEL_NAME = "portfolio-offline-queue";

interface Snapshot {
  readonly queue: readonly QueuedRequest[];
  readonly dlq: readonly DeadLetterItem[];
  readonly persistence: OfflineQueuePersistence;
}

interface Runtime {
  readonly store: OfflineQueueStore;
  readonly dispatcher: OfflineDispatcher;
}

const SERVER_SNAPSHOT: Snapshot = Object.freeze({
  queue: Object.freeze([]) as readonly QueuedRequest[],
  dlq: Object.freeze([]) as readonly DeadLetterItem[],
  persistence: "pending",
});

let snapshot: Snapshot = SERVER_SNAPSHOT;
let runtimePromise: Promise<Runtime> | null = null;
let channel: BroadcastChannel | null = null;
const subscribers = new Set<() => void>();
const onlineSubscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

function setSnapshot(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  notify();
}

/** Rereads the store into the snapshot. */
async function refresh(store: OfflineQueueStore): Promise<void> {
  try {
    const [queue, dlq] = await Promise.all([store.list(), store.deadLetters()]);
    setSnapshot({ queue, dlq });
  } catch (error) {
    logger.warn("Could not read the offline queue.", { error });
  }
}

/** Rereads the store and tells other tabs to do the same. */
async function changed(store: OfflineQueueStore): Promise<void> {
  await refresh(store);
  try {
    channel?.postMessage("changed");
  } catch {
    // The channel closed; other tabs reread on their next change.
  }
}

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/**
 * Picks the most specific failure reason a rejected response carries: the
 * envelope error, a detail message, or a message read from its body.
 */
async function failureReasonOf(
  res: ApiClientResponse<unknown>
): Promise<string> {
  let failureReason = res.error || `HTTP ${res.status}: Client Error`;
  try {
    if (typeof res.error === "string" && res.error.trim().length > 0) {
      failureReason = res.error;
    } else if (
      Array.isArray(res.details) &&
      res.details.length > 0 &&
      typeof res.details[0]?.message === "string"
    ) {
      failureReason = res.details[0].message;
    } else if (res.body && typeof res.body === "object") {
      const obj = res.body as Record<string, unknown>;
      if (typeof obj.message === "string") failureReason = obj.message;
      else if (typeof obj.error === "string") failureReason = obj.error;
      else if (
        Array.isArray(obj.details) &&
        typeof (obj.details[0] as Record<string, unknown>)?.message === "string"
      ) {
        failureReason = (obj.details[0] as Record<string, unknown>)
          .message as string;
      }
    } else if (typeof res.body === "string" && res.body.trim().length > 0) {
      failureReason = res.body;
    } else {
      const resObj = res as unknown as Record<string, unknown>;
      const targetRes =
        typeof resObj.clone === "function"
          ? (resObj.clone() as Record<string, unknown>)
          : resObj;

      let data: unknown;

      if (typeof targetRes.json === "function") {
        try {
          data = await (targetRes.json as () => Promise<unknown>)();
        } catch {
          if (typeof targetRes.text === "function") {
            data = await (targetRes.text as () => Promise<unknown>)();
          }
        }
      } else if (typeof targetRes.text === "function") {
        data = await (targetRes.text as () => Promise<unknown>)();
      }

      if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;

        if (typeof obj.message === "string") {
          failureReason = obj.message;
        } else if (typeof obj.error === "string") {
          failureReason = obj.error;
        } else if (
          Array.isArray(obj.details) &&
          typeof (obj.details[0] as Record<string, unknown>)?.message ===
            "string"
        ) {
          failureReason = (obj.details[0] as Record<string, unknown>)
            .message as string;
        }
      } else if (typeof data === "string" && data.trim().length > 0) {
        failureReason = data;
      }
    }
  } catch {
    // ignore parsing error
  }
  return failureReason;
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * The Idempotency-Key for one stored version of a queued request, or
 * undefined when the id cannot form one. Every retry of that version sends
 * the same key, so an endpoint can return the row the first send created
 * (#3807). The enqueue time is part of it, because an id can be enqueued
 * again after its first request was acknowledged and its revision restarts
 * at 0. A caller that sets its own Idempotency-Key header keeps it.
 */
function idempotencyKeyOf(entry: OfflineQueueEntry): string | undefined {
  const key = `${entry.id}:${entry.revision}:${entry.createdAt}`;
  return IDEMPOTENCY_KEY.test(key) ? key : undefined;
}

/** Sends one queued entry and says how it ended. */
async function sendQueued(
  entry: OfflineQueueEntry,
  signal: AbortSignal | undefined
): Promise<OfflineSendOutcome> {
  const headers: Record<string, string> = { ...entry.headers };
  const key = idempotencyKeyOf(entry);
  if (key && !Object.keys(headers).some((h) => /^idempotency-key$/i.test(h))) {
    headers["Idempotency-Key"] = key;
  }
  const init: RequestInit = { headers, signal };
  let body = entry.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      // Keep as string if not valid JSON
    }
  }

  let res: ApiClientResponse<unknown>;
  switch (entry.method) {
    case "PUT":
      res = await apiClient.put(entry.endpoint, body, init);
      break;
    case "PATCH":
      res = await apiClient.patch(entry.endpoint, body, init);
      break;
    case "DELETE":
      res = await apiClient.delete(entry.endpoint, init);
      break;
    case "POST":
    default:
      res = await apiClient.post(entry.endpoint, body, init);
      break;
  }

  if (res.ok) return { kind: "ok" };
  if (
    res.status >= 400 &&
    res.status < 500 &&
    res.status !== 429 &&
    res.status !== 408
  ) {
    return {
      kind: "permanent",
      status: res.status,
      reason: await failureReasonOf(res),
    };
  }
  return {
    kind: "transient",
    status: res.status,
    reason:
      typeof res.error === "string" && res.error.trim().length > 0
        ? res.error
        : res.status > 0
          ? `HTTP ${res.status}`
          : "Network error",
  };
}

function announceDeadLetter(
  entry: OfflineQueueEntry,
  failure: OfflineDeadLetterFailure
) {
  const deadLetterItem: DeadLetterItem = { ...entry, ...failure };
  logger.error(
    `Offline request failed with status ${failure.statusCode} and moved to DLQ`,
    { deadLetterItem }
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(DLQ_ERROR_EVENT, { detail: deadLetterItem })
    );
  }
}

/**
 * Imports the legacy localStorage arrays once. The keys are removed only
 * after the import committed, so an older tab still running the
 * localStorage queue sees them empty and stops sending them.
 */
async function importLegacy(store: OfflineQueueStore): Promise<void> {
  const legacyQueue = safeGetItem<unknown>(LEGACY_QUEUE_KEY);
  const legacyDead = safeGetItem<unknown>(LEGACY_DLQ_KEY);
  try {
    const result = await store.importLegacy(
      legacyQueue,
      legacyDead,
      Date.now()
    );
    if (legacyQueue !== null) safeRemoveItem(LEGACY_QUEUE_KEY);
    if (legacyDead !== null) safeRemoveItem(LEGACY_DLQ_KEY);
    if (result.status === "imported" && result.skipped > 0) {
      logger.warn("Skipped malformed rows in the legacy offline queue.", {
        skipped: result.skipped,
      });
    }
  } catch (error) {
    // Nothing was imported and the keys stay, so the next start tries again.
    logger.warn("Could not import the legacy offline queue.", { error });
  }
}

/** Opens the store once, imports legacy rows and starts the dispatcher. */
function runtime(): Promise<Runtime> {
  runtimePromise ??= (async () => {
    const opened = await openOfflineQueueStore();
    const store = opened.ok ? opened.store : createMemoryOfflineQueueStore();
    if (opened.ok) {
      await importLegacy(store);
    } else {
      logger.warn(
        "IndexedDB is unavailable; offline requests are held in memory only.",
        { code: opened.code }
      );
    }
    const dispatcher = createOfflineDispatcher({
      store,
      send: sendQueued,
      isOnline,
      onSettled: () => void changed(store),
      onDeadLetter: announceDeadLetter,
    });
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = () => {
          void refresh(store).then(() => {
            if (isOnline()) void dispatcher.flush();
          });
        };
      } catch {
        channel = null;
      }
    }
    setSnapshot({ persistence: opened.ok ? "durable" : "volatile" });
    await refresh(store);
    return { store, dispatcher };
  })();
  return runtimePromise;
}

/** Runs a store change, then refreshes this tab and tells the others. */
async function mutate<T>(
  work: (store: OfflineQueueStore) => Promise<T>
): Promise<T> {
  const { store } = await runtime();
  const result = await work(store);
  await changed(store);
  return result;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    onlineSubscribers.forEach((cb) => cb());
    void flushOfflineQueue();
  });
  window.addEventListener("offline", () => {
    onlineSubscribers.forEach((cb) => cb());
  });
}

/**
 * Enqueues a request to send when online.
 *
 * An `id` that is already queued replaces that entry in place: the newer
 * body is the one sent, once, and its retry count starts again from zero.
 * Resolves with the stored entry once the store committed it; check
 * {@link getOfflineQueuePersistence} before saying it will survive a reload.
 */
export async function enqueueOfflineRequest<T = unknown>(
  request: OfflineRequestInput<T>
): Promise<QueuedRequest<T>> {
  const id = request.id || generateId("offline_", { timestamp: true });
  const entry = await mutate((store) =>
    store.enqueue(
      {
        id,
        type: request.type,
        endpoint: request.endpoint,
        method: request.method ?? "POST",
        headers: request.headers ?? { "Content-Type": "application/json" },
        body: request.body,
        maxRetries: request.maxRetries ?? 5,
      },
      Date.now()
    )
  );
  if (isOnline()) void flushOfflineQueue();
  return entry;
}

/** Removes a queued request by id, whatever its revision. */
export function dequeueOfflineRequest(id: string): Promise<void> {
  return mutate((store) => store.remove(id));
}

/** Removes every queued request. */
export function clearOfflineQueue(): Promise<void> {
  return mutate((store) => store.clear());
}

/** The queued requests as last read, in send order. */
export function getOfflineQueue(): QueuedRequest[] {
  return [...snapshot.queue];
}

/** Waits for the store to open, then returns the queued requests. */
export async function loadOfflineQueue(): Promise<QueuedRequest[]> {
  await runtime();
  return getOfflineQueue();
}

/** How many requests are queued, as last read. */
export function getOfflineQueueLength(): number {
  return snapshot.queue.length;
}

/** Whether queued requests survive a reload. */
export function getOfflineQueuePersistence(): OfflineQueuePersistence {
  return snapshot.persistence;
}

/** The dead letters as last read. */
export function getDLQ(): DeadLetterItem[] {
  return [...snapshot.dlq];
}

/** How many dead letters there are, as last read. */
export function getDLQLength(): number {
  return snapshot.dlq.length;
}

/** Removes every dead letter. */
export function clearDLQ(): Promise<void> {
  return mutate((store) => store.clearDeadLetters());
}

/** Removes one dead letter. */
export function dismissDLQItem(id: string): Promise<void> {
  return mutate((store) => store.dismissDeadLetter(id));
}

/**
 * Queues a dead letter again, unless a newer request with its id is already
 * queued, in which case the dead letter is only dismissed.
 */
export async function retryDLQItem(id: string): Promise<void> {
  const outcome = await mutate((store) =>
    store.retryDeadLetter(id, Date.now())
  );
  if (outcome === "requeued" && isOnline()) void flushOfflineQueue();
}

/**
 * Sends every due request this tab can claim, in order. Stored retry
 * deadlines hold, so calling this early sends nothing that is not due.
 */
export async function flushOfflineQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  if (!isOnline()) return { processed: 0, failed: 0 };
  const { store, dispatcher } = await runtime();
  const result = await dispatcher.flush();
  await refresh(store);
  return result;
}

function subscribe(callback: () => void) {
  subscribers.add(callback);
  // Open the store on first use in the browser, so the snapshot loads.
  if (typeof window !== "undefined") void runtime();
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

const getSnapshot = () => snapshot;
const getServerSnapshot = () => SERVER_SNAPSHOT;
const getOnlineSnapshot = () => isOnline();
const getServerOnlineSnapshot = () => true;

export interface UseOfflineQueueOptions {
  autoFlushOnOnline?: boolean;
}

/**
 * The offline request queue, dead letters and online status, through
 * useSyncExternalStore so server and first client render agree.
 *
 * @param options Optional hook configuration options.
 */
export function useOfflineQueue(options?: UseOfflineQueueOptions) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isOnlineNow = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );
  const queueLength = state.queue.length;

  useEffect(() => {
    if (
      options?.autoFlushOnOnline !== false &&
      isOnlineNow &&
      queueLength > 0
    ) {
      void flushOfflineQueue();
    }
  }, [isOnlineNow, queueLength, options?.autoFlushOnOnline]);

  const enqueue = useCallback(
    <T = unknown>(request: OfflineRequestInput<T>) =>
      enqueueOfflineRequest(request),
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
    queue: state.queue,
    queueLength,
    dlqQueue: state.dlq,
    dlqLength: state.dlq.length,
    persistence: state.persistence,
    isOnline: isOnlineNow,
    enqueue,
    dequeue,
    clear,
    flush,
    clearDLQ: clearDLQCallback,
    dismissDLQItem: dismissDLQItemCallback,
    retryDLQItem: retryDLQItemCallback,
  };
}
