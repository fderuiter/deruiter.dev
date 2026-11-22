/**
 * Sends queued requests from the IndexedDB store (#3807, slice 2).
 *
 * Each attempt is claimed in its own short transaction with a random owner
 * token and a lease, sent with no transaction open, and settled in a second
 * transaction that checks the id, the revision and the owner. The lease
 * outlasts the request timeout by a margin, so a live owner always settles
 * before anyone else may take over, and a frozen or closed tab's claim
 * expires.
 *
 * This gives at-least-once attempts, not exactly-once effects: a lease that
 * runs out after the server accepted a request lets another tab send it
 * again, so each endpoint must tolerate a replay.
 */
import type {
  OfflineDeadLetterFailure,
  OfflineDispatcher,
  OfflineDispatcherOptions,
  OfflineFlushResult,
  OfflineQueueEntry,
  OfflineSendOutcome,
} from "../types";
import { clamp } from "@/lib/utils";

/** Longest a request may run before it counts as a failed attempt. */
export const OFFLINE_REQUEST_TIMEOUT_MS = 15_000;

/** How much longer than the request timeout a claim's lease lasts. */
export const OFFLINE_LEASE_MARGIN_MS = 5_000;

/** Longest delay between retries. */
export const OFFLINE_MAX_RETRY_DELAY_MS = 30_000;

/** Delay before retry number `retries` (1 or more): 2 s, 4 s, 8 s, ... */
export function offlineRetryDelay(retries: number): number {
  return Math.min(1000 * 2 ** retries, OFFLINE_MAX_RETRY_DELAY_MS);
}

function randomToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `owner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const TIMED_OUT = Symbol("timed-out");

/** Creates a dispatcher for one browsing context. */
export function createOfflineDispatcher(
  options: OfflineDispatcherOptions
): OfflineDispatcher {
  const {
    store,
    send,
    now = () => Date.now(),
    setTimer = (run, ms) => setTimeout(run, ms),
    clearTimer = (handle) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>),
    isOnline = () =>
      typeof navigator === "undefined" ? true : navigator.onLine !== false,
    onDeadLetter,
    onSettled,
    requestTimeoutMs = OFFLINE_REQUEST_TIMEOUT_MS,
  } = options;
  const ownerToken = options.ownerToken ?? randomToken();
  const leaseMs = requestTimeoutMs + OFFLINE_LEASE_MARGIN_MS;
  const claimOptions = {
    leaseMs,
    maxDelayMs: OFFLINE_MAX_RETRY_DELAY_MS,
  };

  let running: Promise<OfflineFlushResult> | null = null;
  let again = false;
  let wake: unknown = null;
  let disposed = false;

  function cancelWake() {
    if (wake !== null) clearTimer(wake);
    wake = null;
  }

  function scheduleWake(at: number | null) {
    cancelWake();
    if (at === null || disposed) return;
    // Bounded, so a wall clock that jumps forward or back cannot leave the
    // queue asleep for longer than one lease.
    const delay = clamp(at - now(), 0, leaseMs);
    wake = setTimer(() => {
      wake = null;
      void flush();
    }, delay);
  }

  /** Sends with a timeout; a timeout or a throw is a transient failure. */
  async function attempt(
    entry: OfflineQueueEntry
  ): Promise<OfflineSendOutcome> {
    const controller =
      typeof AbortController === "undefined" ? null : new AbortController();
    let timer: unknown = null;
    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimer(() => resolve(TIMED_OUT), requestTimeoutMs);
    });
    try {
      const result = await Promise.race([
        send(entry, controller?.signal),
        timeout,
      ]);
      if (result === TIMED_OUT) {
        controller?.abort();
        return { kind: "transient", status: 0, reason: "Request timed out" };
      }
      return result;
    } catch (error) {
      const reason =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Request failed";
      return { kind: "transient", status: 0, reason };
    } finally {
      if (timer !== null) clearTimer(timer);
    }
  }

  async function deadLetter(
    entry: OfflineQueueEntry,
    failure: OfflineDeadLetterFailure
  ) {
    const moved = await store.moveToDeadLetters(
      { id: entry.id, revision: entry.revision, ownerToken },
      failure
    );
    onSettled?.();
    if (moved) onDeadLetter?.(entry, failure);
  }

  async function drain(): Promise<OfflineFlushResult> {
    let processed = 0;
    let failed = 0;
    for (;;) {
      if (disposed || !isOnline()) return { processed, failed };
      const { entry, nextWakeAt } = await store.claimNext(
        ownerToken,
        now(),
        claimOptions
      );
      if (!entry) {
        scheduleWake(nextWakeAt);
        return { processed, failed };
      }
      const outcome = await attempt(entry);
      const sent = { id: entry.id, revision: entry.revision, ownerToken };
      if (outcome.kind === "ok") {
        await store.acknowledge(sent);
        onSettled?.();
        processed += 1;
        continue;
      }
      failed += 1;
      if (outcome.kind === "permanent") {
        await deadLetter(entry, {
          statusCode: outcome.status,
          failureReason: outcome.reason,
          failedAt: now(),
        });
        continue;
      }
      const retries = entry.retries + 1;
      if (retries >= entry.maxRetries) {
        await deadLetter(entry, {
          statusCode: outcome.status,
          failureReason: outcome.reason,
          failedAt: now(),
        });
        continue;
      }
      const nextAttemptAt = now() + offlineRetryDelay(retries);
      await store.recordRetry(sent, retries, nextAttemptAt);
      onSettled?.();
      // A transient failure usually means the network is down, so stop and
      // wake when this entry is due rather than trying the rest now.
      scheduleWake(nextAttemptAt);
      return { processed, failed };
    }
  }

  function flush(): Promise<OfflineFlushResult> {
    if (running) {
      // Run once more after the current pass, for work it may have missed.
      again = true;
      return running;
    }
    running = (async () => {
      cancelWake();
      const total: OfflineFlushResult = { processed: 0, failed: 0 };
      try {
        do {
          again = false;
          const pass = await drain();
          total.processed += pass.processed;
          total.failed += pass.failed;
        } while (again && !disposed);
      } finally {
        running = null;
      }
      return total;
    })();
    return running;
  }

  return {
    ownerToken,
    flush,
    isFlushing: () => running !== null,
    dispose() {
      disposed = true;
      cancelWake();
    },
  };
}
