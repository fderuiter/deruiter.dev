/**
 * In-memory queue store, used when IndexedDB is missing or blocked (#3807).
 *
 * It follows the same contract as the IndexedDB store, so the dispatcher
 * behaves the same, but its entries live only as long as the page. Callers
 * must report the queue as volatile and must not tell the visitor a write
 * was saved. Each operation runs to completion before the next, so no
 * transaction is needed.
 */
import type {
  LegacyImportResult,
  OfflineDeadLetter,
  OfflineQueueEntry,
  OfflineQueueStore,
} from "../types";
import { OFFLINE_DEAD_LETTER_CAP, OfflineQueueStoreError } from "./idb-store";

const DEFAULT_HEADERS = Object.freeze({ "Content-Type": "application/json" });

function unclaimed<T extends OfflineQueueEntry>(entry: T): T {
  const { claim: _claim, ...rest } = entry;
  return rest as T;
}

/** Creates an empty store held in memory. */
export function createMemoryOfflineQueueStore(): OfflineQueueStore {
  const queue = new Map<string, OfflineQueueEntry>();
  const dead = new Map<string, OfflineDeadLetter>();
  let nextOrder = 0;
  let closed = false;

  const byOrder = <T extends { readonly order: number }>(rows: T[]) =>
    rows.sort((a, b) => a.order - b.order);

  /** Runs `work` on a later microtask, as the IndexedDB store would. */
  async function op<T>(work: () => T): Promise<T> {
    await Promise.resolve();
    if (closed) throw new OfflineQueueStoreError("STORE_CLOSED");
    try {
      return work();
    } catch {
      // A body that cannot be cloned, as IndexedDB would reject it.
      throw new OfflineQueueStoreError("TRANSACTION_ABORTED");
    }
  }

  function sentEntry(sent: {
    id: string;
    revision: number;
    ownerToken?: string;
  }): OfflineQueueEntry | null {
    const entry = queue.get(sent.id);
    if (!entry || entry.revision !== sent.revision) return null;
    if (
      sent.ownerToken !== undefined &&
      entry.claim?.ownerToken !== sent.ownerToken
    ) {
      return null;
    }
    return entry;
  }

  function capDead() {
    const rows = byOrder([...dead.values()]);
    for (const row of rows.slice(
      0,
      Math.max(0, rows.length - OFFLINE_DEAD_LETTER_CAP)
    )) {
      dead.delete(row.id);
    }
  }

  return {
    list: () => op(() => byOrder([...queue.values()])),
    deadLetters: () => op(() => byOrder([...dead.values()])),

    enqueue: (input, now) =>
      op(() => {
        const existing = queue.get(input.id);
        const entry = {
          id: input.id,
          type: input.type,
          endpoint: input.endpoint,
          method: input.method ?? "POST",
          headers: { ...(input.headers ?? DEFAULT_HEADERS) },
          body: structuredClone(input.body),
          createdAt: now,
          retries: 0,
          maxRetries: input.maxRetries ?? 5,
          revision: existing ? existing.revision + 1 : 0,
          nextAttemptAt: now,
          order: existing ? existing.order : nextOrder++,
        };
        queue.set(entry.id, entry);
        return entry;
      }),

    claimNext: (ownerToken, now, { leaseMs, maxDelayMs }) =>
      op(() => {
        let nextWakeAt: number | null = null;
        for (const entry of byOrder([...queue.values()])) {
          const dueAt =
            entry.nextAttemptAt > now + maxDelayMs ? now : entry.nextAttemptAt;
          const lease = entry.claim?.leaseUntil;
          const freeAt =
            lease === undefined || lease > now + leaseMs ? now : lease;
          const claimableAt = Math.max(dueAt, freeAt);
          if (claimableAt > now) {
            nextWakeAt =
              nextWakeAt === null
                ? claimableAt
                : Math.min(nextWakeAt, claimableAt);
            continue;
          }
          const claimed = {
            ...entry,
            claim: { ownerToken, leaseUntil: now + leaseMs },
          };
          queue.set(entry.id, claimed);
          return { entry: claimed, nextWakeAt };
        }
        return { entry: null, nextWakeAt };
      }),

    remove: (id) =>
      op(() => {
        queue.delete(id);
      }),
    clear: () =>
      op(() => {
        queue.clear();
      }),

    acknowledge: (sent) =>
      op(() => {
        if (!sentEntry(sent)) return false;
        queue.delete(sent.id);
        return true;
      }),

    recordRetry: (sent, retries, nextAttemptAt) =>
      op(() => {
        const entry = sentEntry(sent);
        if (!entry) return false;
        queue.set(entry.id, { ...unclaimed(entry), retries, nextAttemptAt });
        return true;
      }),

    moveToDeadLetters: (sent, failure) =>
      op(() => {
        const entry = sentEntry(sent);
        if (!entry) return false;
        queue.delete(entry.id);
        dead.set(entry.id, {
          ...unclaimed(entry),
          ...failure,
          order: nextOrder++,
        });
        capDead();
        return true;
      }),

    dismissDeadLetter: (id) =>
      op(() => {
        dead.delete(id);
      }),
    clearDeadLetters: () =>
      op(() => {
        dead.clear();
      }),

    retryDeadLetter: (id, now) =>
      op(() => {
        const letter = dead.get(id);
        if (!letter) return "missing" as const;
        dead.delete(id);
        if (queue.has(id)) return "superseded" as const;
        queue.set(id, {
          id: letter.id,
          type: letter.type,
          endpoint: letter.endpoint,
          method: letter.method,
          headers: letter.headers,
          body: letter.body,
          createdAt: now,
          retries: 0,
          maxRetries: letter.maxRetries,
          revision: 0,
          nextAttemptAt: now,
          order: nextOrder++,
        });
        return "requeued" as const;
      }),

    // Nothing is imported into a store that does not outlive the page, so
    // the legacy rows stay where they are for a later, durable start.
    importLegacy: () =>
      op((): LegacyImportResult => ({
        status: "already-imported",
        importedQueue: 0,
        importedDeadLetters: 0,
        skipped: 0,
        deadlinesInitialized: 0,
      })),

    close() {
      closed = true;
    },
  };
}
