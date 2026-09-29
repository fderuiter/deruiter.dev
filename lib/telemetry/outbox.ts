import { sanitizeError } from "@/lib/error-sanitization";
import { logger } from "@/lib/logger";
import { safeIsAvailable } from "@/lib/safe-storage";

/**
 * Default maximum number of queued items retained in the outbox.
 */
export const DEFAULT_OUTBOX_CAPACITY = 50;

/**
 * Default base backoff delay in milliseconds.
 */
export const DEFAULT_BASE_DELAY_MS = 1000;

/**
 * Default maximum capped backoff delay in milliseconds.
 */
export const DEFAULT_MAX_DELAY_MS = 10000;

/**
 * Default maximum retry attempts before dropping an item.
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Default local storage key for serialized outbox queue.
 */
export const DEFAULT_STORAGE_KEY = "portfolio_telemetry_outbox_queue";

/**
 * An individual telemetry payload item managed by the outbox.
 */
export interface TelemetryOutboxItem {
  projectSlug: string;
  eventType: string;
  retries?: number;
  id?: string;
  metadata?: Record<string, unknown>;
  createdAt?: number;
}

/**
 * Reason for triggering an optimistic rollback callback.
 */
export type RollbackReason = "rate_limited" | "max_retries_exceeded" | "error";

/**
 * Minimal response shape expected from a custom telemetry transport.
 */
export interface TelemetryTransportResponse {
  ok: boolean;
  status?: number;
  statusText?: string;
}

/**
 * Function contract for dispatching telemetry payloads over the network.
 */
export type TelemetryTransport = (
  item: TelemetryOutboxItem,
  options?: { keepalive?: boolean }
) => Promise<TelemetryTransportResponse | Response>;

/**
 * Storage adapter interface matching Web Storage API subset.
 */
export interface TelemetryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Configuration options for the TelemetryOutbox instance.
 */
export interface TelemetryOutboxConfig {
  maxCapacity?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  transport?: TelemetryTransport;
  storage?: TelemetryStorage | null;
  storageKey?: string;
  autoFlushOnUnload?: boolean;
  onRollback?: (
    item: TelemetryOutboxItem,
    reason: RollbackReason,
    error?: unknown
  ) => void;
  onSuccess?: (item: TelemetryOutboxItem) => void;
}

/**
 * Default transport utilizing standard window fetch to post to the telemetry API.
 */
const defaultTransport: TelemetryTransport = async (item, options) => {
  return await fetch("/api/telemetry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectSlug: item.projectSlug,
      eventType: item.eventType,
    }),
    keepalive: options?.keepalive ?? false,
  });
};

/**
 * Pure, framework-agnostic telemetry outbox buffer.
 * Provides FIFO bounded capacity, exponential backoff retries on 5xx/network errors,
 * targeted rollback on HTTP 429 rate limits, storage serialization, and unload keepalive beacons.
 */
export class TelemetryOutbox {
  private queue: TelemetryOutboxItem[] = [];
  private capacity: number;
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private transport: TelemetryTransport;
  private storage: TelemetryStorage | null;
  private storageKey: string;
  private autoFlushOnUnload: boolean;
  private onRollback?: (
    item: TelemetryOutboxItem,
    reason: RollbackReason,
    error?: unknown
  ) => void;
  private onSuccess?: (item: TelemetryOutboxItem) => void;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private _isDestroyed = false;
  private unloadListener?: () => void;
  private visibilityListener?: () => void;

  constructor(config?: TelemetryOutboxConfig) {
    this.capacity =
      config?.maxCapacity && config.maxCapacity > 0
        ? config.maxCapacity
        : DEFAULT_OUTBOX_CAPACITY;
    this.maxRetries =
      typeof config?.maxRetries === "number"
        ? config.maxRetries
        : DEFAULT_MAX_RETRIES;
    this.baseDelayMs =
      typeof config?.baseDelayMs === "number"
        ? config.baseDelayMs
        : DEFAULT_BASE_DELAY_MS;
    this.maxDelayMs =
      typeof config?.maxDelayMs === "number"
        ? config.maxDelayMs
        : DEFAULT_MAX_DELAY_MS;
    this.transport = config?.transport ?? defaultTransport;
    this.storageKey = config?.storageKey ?? DEFAULT_STORAGE_KEY;
    this.autoFlushOnUnload = config?.autoFlushOnUnload ?? true;
    this.onRollback = config?.onRollback;
    this.onSuccess = config?.onSuccess;

    if (config && "storage" in config) {
      this.storage = config.storage ?? null;
    } else if (safeIsAvailable()) {
      // safeIsAvailable() guards the property access itself, which throws a
      // SecurityError when storage is blocked (sandboxed iframes, strict privacy).
      this.storage = window.localStorage;
    } else {
      this.storage = null;
    }

    this.hydrateFromStorage();
    this.setupUnloadListeners();
  }

  /**
   * Hydrates initial queue entries from persistent storage if available.
   */
  private hydrateFromStorage(): void {
    if (!this.storage) return;

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.queue = parsed.slice(-this.capacity).map((item) => ({
            ...item,
            retries: typeof item.retries === "number" ? item.retries : 0,
          }));
        }
      }
    } catch (err) {
      logger.warn(
        "Failed to hydrate telemetry outbox from storage:",
        sanitizeError(err)
      );
    }
  }

  /**
   * Persists the current queue snapshot to storage.
   */
  private persistToStorage(): void {
    if (!this.storage) return;

    try {
      if (this.queue.length === 0) {
        this.storage.removeItem(this.storageKey);
      } else {
        this.storage.setItem(this.storageKey, JSON.stringify(this.queue));
      }
    } catch (err) {
      logger.warn(
        "Failed to persist telemetry outbox to storage:",
        sanitizeError(err)
      );
    }
  }

  /**
   * Configures lifecycle hooks for unloading tabs and hidden visibility states.
   */
  private setupUnloadListeners(): void {
    if (!this.autoFlushOnUnload || typeof window === "undefined") {
      return;
    }

    this.unloadListener = () => {
      this.flush({ keepalive: true }).catch(() => {});
    };

    this.visibilityListener = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        this.flush({ keepalive: true }).catch(() => {});
      }
    };

    const win = window as unknown as Record<string, EventListener | undefined>;
    if (win.__telemetryOutboxUnloadListener) {
      window.removeEventListener(
        "pagehide",
        win.__telemetryOutboxUnloadListener
      );
      window.removeEventListener(
        "beforeunload",
        win.__telemetryOutboxUnloadListener
      );
    }
    win.__telemetryOutboxUnloadListener = this.unloadListener as EventListener;

    window.addEventListener("pagehide", this.unloadListener);
    window.addEventListener("beforeunload", this.unloadListener);

    if (typeof document !== "undefined") {
      const doc = document as unknown as Record<
        string,
        EventListener | undefined
      >;
      if (doc.__telemetryOutboxVisibilityListener) {
        document.removeEventListener(
          "visibilitychange",
          doc.__telemetryOutboxVisibilityListener
        );
      }
      doc.__telemetryOutboxVisibilityListener = this
        .visibilityListener as EventListener;
      document.addEventListener("visibilitychange", this.visibilityListener);
    }
  }

  /**
   * Schedules a delayed background worker to process retries using exponential backoff.
   */
  private scheduleRetryWorker(): void {
    if (
      this._isDestroyed ||
      this.queue.length === 0 ||
      this.retryTimer !== null
    ) {
      return;
    }

    const minRetries = Math.min(...this.queue.map((item) => item.retries ?? 0));
    const delay = Math.min(
      this.maxDelayMs,
      this.baseDelayMs * Math.pow(2, minRetries)
    );

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.flush().catch((err) => {
        logger.warn("Telemetry outbox flush error:", sanitizeError(err));
      });
    }, delay);
  }

  /**
   * Attempts immediate dispatch of a single telemetry item.
   * If delivery fails with a retryable error, the item is buffered into the outbox.
   *
   * @param item Telemetry item to transmit.
   * @returns True if successfully dispatched, false otherwise.
   */
  public async send(item: TelemetryOutboxItem): Promise<boolean> {
    if (this._isDestroyed) return false;

    try {
      const res = await this.transport(item, { keepalive: false });
      const ok = "ok" in res ? Boolean(res.ok) : false;
      const status =
        "status" in res && typeof res.status === "number"
          ? res.status
          : ok
            ? 200
            : 500;

      if (ok) {
        if (this.onSuccess) {
          this.onSuccess(item);
        }
        return true;
      }

      if (status === 429) {
        logger.warn("Telemetry record rate limited by API.");
        if (this.onRollback) {
          this.onRollback(item, "rate_limited");
        }
        return false;
      }

      if (status === 500) {
        if (this.onRollback) {
          this.onRollback(item, "error", res);
        }
        return false;
      }

      this.enqueue(item);
      return false;
    } catch {
      this.enqueue(item);
      return false;
    }
  }

  /**
   * Enqueues an item directly into the outbox buffer, applying FIFO capacity eviction if needed.
   *
   * @param item Telemetry item to enqueue.
   */
  public enqueue(item: TelemetryOutboxItem): void {
    if (this._isDestroyed) return;

    const normalized: TelemetryOutboxItem = {
      ...item,
      retries: typeof item.retries === "number" ? item.retries : 0,
    };

    while (this.queue.length >= this.capacity) {
      this.queue.shift();
    }
    this.queue.push(normalized);
    this.persistToStorage();
    this.scheduleRetryWorker();
  }

  /**
   * Flushes all queued items immediately through the configured transport.
   *
   * @param options Optional options such as keepalive beacon flag.
   */
  public async flush(options?: { keepalive?: boolean }): Promise<void> {
    if (this._isDestroyed || this.queue.length === 0) {
      return;
    }

    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    const currentBatch = [...this.queue];
    this.queue = [];
    this.persistToStorage();

    const retryCandidates: TelemetryOutboxItem[] = [];

    for (const item of currentBatch) {
      try {
        const res = await this.transport(item, {
          keepalive: options?.keepalive ?? false,
        });
        const ok = "ok" in res ? Boolean(res.ok) : false;
        const status =
          "status" in res && typeof res.status === "number"
            ? res.status
            : ok
              ? 200
              : 500;

        if (ok) {
          if (this.onSuccess) {
            this.onSuccess(item);
          }
          continue;
        }

        if (status === 429) {
          logger.warn("Telemetry record rate limited by API.");
          if (this.onRollback) {
            this.onRollback(item, "rate_limited");
          }
          continue;
        }

        const currentRetries = item.retries ?? 0;
        if (currentRetries < this.maxRetries) {
          retryCandidates.push({
            ...item,
            retries: currentRetries + 1,
          });
        } else {
          if (this.onRollback) {
            this.onRollback(item, "max_retries_exceeded", res);
          }
        }
      } catch (err) {
        const currentRetries = item.retries ?? 0;
        if (currentRetries < this.maxRetries) {
          retryCandidates.push({
            ...item,
            retries: currentRetries + 1,
          });
        } else {
          if (this.onRollback) {
            this.onRollback(item, "max_retries_exceeded", err);
          }
        }
      }
    }

    if (retryCandidates.length > 0 && !this._isDestroyed) {
      for (const candidate of retryCandidates) {
        while (this.queue.length >= this.capacity) {
          this.queue.shift();
        }
        this.queue.push(candidate);
      }
      this.persistToStorage();
      this.scheduleRetryWorker();
    }
  }

  /**
   * Sets a new maximum capacity limit on the queue, trimming oldest entries if needed.
   *
   * @param capacity New maximum capacity integer.
   */
  public setCapacity(capacity: number): void {
    if (capacity < 1 || this._isDestroyed) return;
    this.capacity = capacity;
    while (this.queue.length > this.capacity) {
      this.queue.shift();
    }
    this.persistToStorage();
  }

  /**
   * Gets the current maximum queue capacity.
   */
  public getCapacity(): number {
    return this.capacity;
  }

  /**
   * Gets the current number of queued items.
   */
  public get size(): number {
    return this.queue.length;
  }

  /**
   * Returns true if the outbox queue is currently empty.
   */
  public get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Returns true if the outbox instance has been destroyed.
   */
  public get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Returns a shallow copy of the current queue items.
   */
  public getQueue(): TelemetryOutboxItem[] {
    return [...this.queue];
  }

  /**
   * Returns the oldest item at the front of the queue without removing it.
   */
  public peek(): TelemetryOutboxItem | undefined {
    return this.queue[0];
  }

  /**
   * Synchronously clears all items from the queue and storage and cancels any pending retry timer.
   */
  public clear(): void {
    this.queue = [];
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.persistToStorage();
  }

  /**
   * Cleans up all event listeners, cancels pending timers, and destroys the outbox instance.
   */
  public destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;

    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (typeof window !== "undefined" && this.unloadListener) {
      window.removeEventListener("pagehide", this.unloadListener);
      window.removeEventListener("beforeunload", this.unloadListener);
    }

    if (typeof document !== "undefined" && this.visibilityListener) {
      document.removeEventListener("visibilitychange", this.visibilityListener);
    }

    this.queue = [];
  }
}
