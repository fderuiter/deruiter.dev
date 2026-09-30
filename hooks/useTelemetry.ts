"use client";

import {
  useSyncExternalStore,
  useCallback,
  useEffect,
  startTransition,
} from "react";
import { sanitizeError } from "@/lib/error-sanitization";
import { logger } from "@/lib/logger";
import { generateId } from "@/lib/utils";
import { safeGetItem, safeSetRawItem } from "@/lib/safe-storage";
import {
  TelemetryOutbox,
  DEFAULT_OUTBOX_CAPACITY,
  type TelemetryTransport,
} from "@/lib/telemetry/outbox";

/**
 * Metric counters for views and clicks on a specific project.
 */
export interface ProjectTelemetry {
  views: number;
  clicks: number;
}

/**
 * Map of project slug identifiers to their corresponding telemetry metric counters.
 */
export type TelemetryData = Record<string, ProjectTelemetry>;

/**
 * Permitted telemetry event types.
 */
export type TelemetryEventType =
  | "page_view"
  | "project_click"
  | "route_error"
  | "simulator_option_select"
  | "simulator_milestone_reached"
  | "simulator_schedule_click"
  | "simulator_report_copy"
  | (string & {});

/**
 * Queued telemetry retry event descriptor.
 */
export interface QueuedEvent {
  projectSlug: string;
  eventType: TelemetryEventType;
  retries: number;
}

/**
 * Options for recording a telemetry event.
 */
export interface RecordEventOptions {
  defer?: boolean;
}

/**
 * Pending deferred task descriptor.
 */
export interface PendingDeferredTask {
  id: string;
  projectSlug: string;
  eventType: TelemetryEventType;
}

/**
 * Options for configuring the useTelemetry hook.
 */
export interface UseTelemetryOptions {
  maxQueueCapacity?: number;
}

/**
 * Default maximum capacity limit for the telemetry retry queue.
 */
export const DEFAULT_MAX_QUEUE_CAPACITY = DEFAULT_OUTBOX_CAPACITY;
const CACHE_KEY = "portfolio_telemetry_cache";
const CHANGE_EVENT = "portfolio-telemetry-state-change";

interface TelemetryStoreState {
  telemetry: TelemetryData;
  syncFailed: boolean;
}

const SERVER_SNAPSHOT: TelemetryStoreState = {
  telemetry: {},
  syncFailed: false,
};
let currentStoreState: TelemetryStoreState = {
  telemetry: {},
  syncFailed: false,
};
/**
 * The value safeStorage last returned for CACHE_KEY. safeStorage hands back the
 * same parsed reference while the stored string is unchanged, so a reference
 * comparison detects writes from elsewhere.
 */
let lastStoredCache: unknown = null;
const listeners = new Set<() => void>();

function notify() {
  startTransition(() => {
    listeners.forEach((l) => l());
  });
}

function updateStore(
  updater: (prev: TelemetryStoreState) => TelemetryStoreState
) {
  const next = updater(currentStoreState);
  if (
    next.telemetry !== currentStoreState.telemetry ||
    next.syncFailed !== currentStoreState.syncFailed
  ) {
    currentStoreState = next;
    if (typeof window !== "undefined") {
      // Bare JSON object (no envelope) so cached counters from earlier visits
      // keep loading. safeSetRawItem never throws; it logs and keeps the value
      // in memory when localStorage rejects the write.
      const persisted = safeSetRawItem(
        CACHE_KEY,
        JSON.stringify(currentStoreState.telemetry)
      );
      lastStoredCache = safeGetItem<unknown>(CACHE_KEY);
      if (persisted) {
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
      }
    }
    notify();
  }
}

function syncFromStorage() {
  if (typeof window === "undefined") return;
  const stored = safeGetItem<unknown>(CACHE_KEY);
  if (stored === lastStoredCache) return;
  lastStoredCache = stored;
  if (stored === null) {
    currentStoreState = { ...currentStoreState, telemetry: {} };
  } else if (typeof stored === "object" && !Array.isArray(stored)) {
    currentStoreState = {
      ...currentStoreState,
      telemetry: {
        ...currentStoreState.telemetry,
        ...(stored as TelemetryData),
      },
    };
  } else {
    logger.warn("Ignoring malformed local storage telemetry cache.");
    return;
  }
  notify();
}

function rollbackEvent(projectSlug: string, eventType: string) {
  updateStore((prev) => {
    const cur = prev.telemetry[projectSlug];
    if (!cur) return { ...prev, syncFailed: true };
    const isPv = eventType === "page_view";
    return {
      ...prev,
      telemetry: {
        ...prev.telemetry,
        [projectSlug]: {
          views: isPv ? Math.max(0, cur.views - 1) : cur.views,
          clicks: !isPv ? Math.max(0, cur.clicks - 1) : cur.clicks,
        },
      },
      syncFailed: true,
    };
  });
}

const transport: TelemetryTransport = async (item, options) => {
  try {
    const res = await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectSlug: item.projectSlug,
        eventType: item.eventType,
      }),
      keepalive: options?.keepalive ?? false,
    });
    if (!res.ok && res.status !== 429) {
      logger.error(
        "Optimistic telemetry sync persistence failed:",
        sanitizeError(
          new Error(
            `Failed to persist telemetry event with status: ${res.status}`
          )
        )
      );
    }
    return res;
  } catch (err) {
    logger.error(
      "Optimistic telemetry sync persistence failed:",
      sanitizeError(err)
    );
    throw err;
  }
};

/**
 * Shared TelemetryOutbox instance configured with optimistic rollback integration.
 */
export const telemetryOutbox = new TelemetryOutbox({
  transport,
  onRollback: (item) => rollbackEvent(item.projectSlug, item.eventType),
});

let inFlightFetch: Promise<void> | null = null;
let lastFetchTime = 0;
let offlineSyncReported = false;

async function fetchTelemetryAggregates(options?: {
  force?: boolean;
}): Promise<void> {
  if (inFlightFetch) return inFlightFetch;
  const now = Date.now();
  if (!options?.force && now - lastFetchTime < 5000) return;
  lastFetchTime = now;

  inFlightFetch = (async () => {
    let expectedOffline = false;
    try {
      const res = await fetch("/api/telemetry");
      if (!res.ok) {
        // Outside a production runtime the route marks a missing database as
        // expected (a dev server usually runs without Postgres). Reporting
        // that as console.error would pin an issue badge on the Next.js dev
        // overlay and hide real problems, so it is warned about once instead.
        expectedOffline = res.headers.get("x-telemetry-offline") === "expected";
        throw new Error("Telemetry sync fetch failure");
      }
      const data = (await res.json()) as TelemetryData;
      updateStore((prev) => ({
        telemetry: { ...prev.telemetry, ...data },
        syncFailed: false,
      }));
    } catch (err) {
      if (!expectedOffline) {
        logger.error(
          "Background telemetry synchronization failed:",
          sanitizeError(err)
        );
      } else if (!offlineSyncReported) {
        offlineSyncReported = true;
        logger.warn(
          "Telemetry aggregates are unavailable without a local database; showing defaults."
        );
      }
      updateStore((prev) => ({ ...prev, syncFailed: true }));
    } finally {
      inFlightFetch = null;
    }
  })();
  return inFlightFetch;
}

let pendingDeferred: Array<{
  id: string;
  projectSlug: string;
  eventType: TelemetryEventType;
  cancel: () => void;
}> = [];

/**
 * Schedules a task during browser idle periods with a fallback timeout.
 *
 * @param task Callback task to execute.
 * @param timeout Maximum timeout delay before forced execution.
 * @returns Cancellation function.
 */
export function scheduleIdleTask(task: () => void, timeout = 2000): () => void {
  if (
    typeof window !== "undefined" &&
    typeof window.requestIdleCallback === "function"
  ) {
    const handle = window.requestIdleCallback(() => task(), { timeout });
    return () => {
      if (
        typeof window !== "undefined" &&
        typeof window.cancelIdleCallback === "function"
      ) {
        window.cancelIdleCallback(handle);
      }
    };
  }
  const timer = setTimeout(task, 50);
  return () => clearTimeout(timer);
}

/**
 * Gets currently pending deferred telemetry tasks.
 *
 * @returns Array of pending deferred tasks.
 */
export function getPendingDeferredQueue(): PendingDeferredTask[] {
  return pendingDeferred.map(({ id, projectSlug, eventType }) => ({
    id,
    projectSlug,
    eventType,
  }));
}

/**
 * Gets count of pending deferred telemetry tasks.
 *
 * @returns Number of pending deferred tasks.
 */
export function getPendingDeferredQueueLength(): number {
  return pendingDeferred.length;
}

/**
 * Clears all pending deferred tasks and cancels their timers.
 */
export function clearPendingDeferredQueue(): void {
  for (const t of pendingDeferred) t.cancel();
  pendingDeferred = [];
}

/**
 * Immediately flushes pending deferred tasks with keepalive transport.
 */
export function flushPendingDeferredQueue(): void {
  if (pendingDeferred.length === 0) return;
  const toFlush = [...pendingDeferred];
  clearPendingDeferredQueue();
  for (const t of toFlush) {
    try {
      fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug: t.projectSlug,
          eventType: t.eventType,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Safe catch on unload
    }
  }
}

/**
 * Sets maximum capacity of the telemetry retry queue.
 *
 * @param cap Maximum capacity limit.
 */
export function setQueueCapacity(cap: number): void {
  telemetryOutbox.setCapacity(cap);
}

/**
 * Gets current maximum capacity limit of the telemetry retry queue.
 *
 * @returns Maximum capacity number.
 */
export function getQueueCapacity(): number {
  return telemetryOutbox.getCapacity();
}

/**
 * Gets shallow copy of current in-memory retry queue items.
 *
 * @returns Array of queued telemetry events.
 */
export function getRetryQueue(): QueuedEvent[] {
  return telemetryOutbox.getQueue().map((i) => ({
    projectSlug: i.projectSlug,
    eventType: i.eventType as TelemetryEventType,
    retries: i.retries ?? 0,
  }));
}

/**
 * Gets number of currently queued telemetry retry items.
 *
 * @returns Number of items in retry queue.
 */
export function getRetryQueueLength(): number {
  return telemetryOutbox.size;
}

/**
 * Clears retry queue, pending tasks, timers, and resets store state.
 */
export function clearRetryQueue(): void {
  telemetryOutbox.clear();
  currentStoreState = { telemetry: {}, syncFailed: false };
  lastStoredCache = null;
  lastFetchTime = 0;
  inFlightFetch = null;
  clearPendingDeferredQueue();
}

/**
 * Enqueues a telemetry item for retry.
 *
 * @param item Telemetry event to enqueue.
 */
export function enqueueRetryItem(item: QueuedEvent): void {
  telemetryOutbox.enqueue(item);
}

if (typeof window !== "undefined") {
  syncFromStorage();
  window.addEventListener("storage", (e) => {
    if (e.key === CACHE_KEY || !e.key) {
      // Record what the other tab wrote so syncFromStorage does not merge it
      // a second time.
      lastStoredCache = safeGetItem<unknown>(CACHE_KEY);
      if (e.newValue) {
        try {
          currentStoreState = {
            ...currentStoreState,
            telemetry: JSON.parse(e.newValue),
          };
          notify();
        } catch (err) {
          logger.warn(
            "Failed to parse cross-tab telemetry storage event:",
            sanitizeError(err)
          );
        }
      } else {
        currentStoreState = { ...currentStoreState, telemetry: {} };
        notify();
      }
    }
  });
  window.addEventListener(CHANGE_EVENT, syncFromStorage);

  const handleVisibility = () => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
    ) {
      syncFromStorage();
    } else {
      flushPendingDeferredQueue();
    }
  };

  const handleUnload = () => {
    flushPendingDeferredQueue();
  };

  const win = window as unknown as Record<string, EventListener | undefined>;
  if (win.__telemetryHookUnloadListener) {
    window.removeEventListener("pagehide", win.__telemetryHookUnloadListener);
    window.removeEventListener(
      "beforeunload",
      win.__telemetryHookUnloadListener
    );
  }
  win.__telemetryHookUnloadListener = handleUnload as EventListener;
  window.addEventListener("pagehide", handleUnload);
  window.addEventListener("beforeunload", handleUnload);

  if (typeof document !== "undefined") {
    const doc = document as unknown as Record<
      string,
      EventListener | undefined
    >;
    if (doc.__telemetryHookVisibilityListener) {
      document.removeEventListener(
        "visibilitychange",
        doc.__telemetryHookVisibilityListener
      );
    }
    doc.__telemetryHookVisibilityListener = handleVisibility as EventListener;
    document.addEventListener("visibilitychange", handleVisibility);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  syncFromStorage();
  return () => {
    listeners.delete(listener);
  };
}
function getSnapshot() {
  return currentStoreState;
}
function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

/**
 * Custom hook implementing a lightweight SWR telemetry system with useSyncExternalStore.
 * Hydrates state instantly from LocalStorage cache, schedules background syncs during idle frames,
 * and delegates retry queueing, rate-limiting rollbacks, and keepalive beacons to TelemetryOutbox.
 *
 * @param options Optional configuration options including maximum retry queue capacity.
 */
export function useTelemetry(options?: UseTelemetryOptions) {
  if (options?.maxQueueCapacity && options.maxQueueCapacity > 0) {
    telemetryOutbox.setCapacity(options.maxQueueCapacity);
  }

  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const cancel = scheduleIdleTask(() => {
      fetchTelemetryAggregates();
    }, 2000);
    return cancel;
  }, []);

  const recordEvent = useCallback(
    async (
      projectSlug: string,
      eventType: TelemetryEventType,
      opts?: RecordEventOptions
    ) => {
      const execute = async () => {
        const cur = currentStoreState.telemetry[projectSlug] || {
          views: 0,
          clicks: 0,
        };
        updateStore((prev) => ({
          ...prev,
          telemetry: {
            ...prev.telemetry,
            [projectSlug]: {
              views: eventType === "page_view" ? cur.views + 1 : cur.views,
              clicks: eventType !== "page_view" ? cur.clicks + 1 : cur.clicks,
            },
          },
        }));

        try {
          const sent = await telemetryOutbox.send({ projectSlug, eventType });
          if (!sent) {
            updateStore((prev) => ({ ...prev, syncFailed: true }));
          }
        } catch {
          updateStore((prev) => ({ ...prev, syncFailed: true }));
        }
      };

      if (opts?.defer) {
        const taskId = generateId(`${projectSlug}:${eventType}`, {
          timestamp: true,
        });
        let cancel: (() => void) | null = null;
        cancel = scheduleIdleTask(async () => {
          pendingDeferred = pendingDeferred.filter((t) => t.id !== taskId);
          await execute();
        }, 2000);
        pendingDeferred.push({
          id: taskId,
          projectSlug,
          eventType,
          cancel: () => {
            if (cancel) cancel();
          },
        });
      } else {
        await execute();
      }
    },
    []
  );

  return {
    telemetry: store.telemetry,
    syncFailed: store.syncFailed,
    recordEvent,
    refetch: fetchTelemetryAggregates,
    queueLength: telemetryOutbox.size,
    queueCapacity: telemetryOutbox.getCapacity(),
    pendingDeferredLength: pendingDeferred.length,
  };
}
