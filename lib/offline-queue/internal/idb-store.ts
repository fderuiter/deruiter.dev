/**
 * IndexedDB queue store (#3807, slice 1). Every mutation, including each
 * read-modify-write, runs in one short IndexedDB transaction, so two tabs
 * can never lose each other's rows the way the shared localStorage array
 * could. No network call happens inside a transaction.
 *
 * A failed or aborted transaction writes nothing and rejects with an
 * {@link OfflineQueueStoreError}; it is never reported as stored.
 */
import type {
  LegacyImportResult,
  OfflineDeadLetter,
  OfflineQueueEntry,
  OfflineQueueInput,
  OfflineQueueMethod,
  OfflineQueueStore,
  OfflineQueueStoreErrorCode,
  OpenOfflineQueueStoreResult,
  SentRevision,
} from "../types";

/** Default database name. */
export const OFFLINE_QUEUE_DB_NAME = "portfolio_offline_queue";

/** Schema version of the database. */
export const OFFLINE_QUEUE_DB_VERSION = 1;

/** Dead letters kept, newest first, as the legacy queue did. */
export const OFFLINE_DEAD_LETTER_CAP = 50;

const QUEUE = "queue";
const DEAD = "deadLetters";
const META = "meta";
const NEXT_ORDER = "nextOrder";
const LEGACY_IMPORT = "legacyImport";
const METHODS: ReadonlySet<string> = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
const DEFAULT_HEADERS = Object.freeze({ "Content-Type": "application/json" });

/** A store failure with a stable code. */
export class OfflineQueueStoreError extends Error {
  readonly code: OfflineQueueStoreErrorCode;

  constructor(code: OfflineQueueStoreErrorCode) {
    super(code);
    this.name = "OfflineQueueStoreError";
    this.code = code;
  }
}

function errorCode(
  error: DOMException | Error | null
): OfflineQueueStoreErrorCode {
  return error?.name === "QuotaExceededError"
    ? "QUOTA_EXCEEDED"
    : "TRANSACTION_ABORTED";
}

/** Opens the database, creating its stores on first use. */
export function openOfflineQueueStore(
  options: { readonly indexedDB?: IDBFactory; readonly name?: string } = {}
): Promise<OpenOfflineQueueStoreResult> {
  const factory =
    options.indexedDB ??
    (typeof indexedDB === "undefined" ? undefined : indexedDB);
  if (!factory)
    return Promise.resolve({ ok: false, code: "STORE_UNAVAILABLE" });
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(
        options.name ?? OFFLINE_QUEUE_DB_NAME,
        OFFLINE_QUEUE_DB_VERSION
      );
    } catch {
      resolve({ ok: false, code: "STORE_UNAVAILABLE" });
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE)) {
        db.createObjectStore(QUEUE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(DEAD)) {
        db.createObjectStore(DEAD, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onsuccess = () =>
      resolve({ ok: true, store: createStore(request.result) });
    request.onerror = () => resolve({ ok: false, code: "STORE_UNAVAILABLE" });
    request.onblocked = () => resolve({ ok: false, code: "STORE_UNAVAILABLE" });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wholeAtLeast(value: unknown, min: number): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= min
  );
}

function stringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  return entries.every(([, v]) => typeof v === "string")
    ? (Object.fromEntries(entries) as Record<string, string>)
    : null;
}

function byOrder<T extends { readonly order: number }>(rows: T[]): T[] {
  return rows.sort((a, b) => a.order - b.order);
}

/**
 * Validates one legacy localStorage row. Returns null for a row that cannot
 * be sent safely. `deadlineInitialized` is true when the row had no retry
 * deadline and is made due at import time.
 */
function legacyEntry(
  value: unknown,
  now: number
): {
  entry: Omit<OfflineQueueEntry, "order">;
  deadlineInitialized: boolean;
} | null {
  if (!isRecord(value)) return null;
  const { id, type, endpoint } = value;
  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof type !== "string" || typeof endpoint !== "string") return null;
  if (endpoint.length === 0 || !("body" in value) || value.body === undefined) {
    return null;
  }
  const method =
    typeof value.method === "string" && METHODS.has(value.method.toUpperCase())
      ? (value.method.toUpperCase() as OfflineQueueMethod)
      : "POST";
  const hasDeadline =
    typeof value.nextAttemptAt === "number" &&
    Number.isFinite(value.nextAttemptAt);
  return {
    entry: {
      id,
      type,
      endpoint,
      method,
      headers: stringRecord(value.headers) ?? { ...DEFAULT_HEADERS },
      body: value.body,
      createdAt:
        typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
          ? value.createdAt
          : now,
      retries: wholeAtLeast(value.retries, 0) ? value.retries : 0,
      maxRetries: wholeAtLeast(value.maxRetries, 1) ? value.maxRetries : 5,
      revision: wholeAtLeast(value.revision, 0) ? value.revision : 0,
      nextAttemptAt: hasDeadline ? (value.nextAttemptAt as number) : now,
    },
    deadlineInitialized: !hasDeadline,
  };
}

function createStore(db: IDBDatabase): OfflineQueueStore {
  let closed = false;

  /**
   * Runs `work` in one transaction and resolves with what it set through
   * `done`, after the transaction commits.
   */
  function run<T>(
    stores: readonly string[],
    mode: IDBTransactionMode,
    work: (t: IDBTransaction, done: (value: T) => void) => void
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (closed) {
        reject(new OfflineQueueStoreError("STORE_CLOSED"));
        return;
      }
      let t: IDBTransaction;
      try {
        t = db.transaction([...stores], mode);
      } catch {
        reject(new OfflineQueueStoreError("STORE_CLOSED"));
        return;
      }
      let result: T | undefined;
      let settled = false;
      t.oncomplete = () => {
        settled = true;
        resolve(result as T);
      };
      const fail = () => {
        if (settled) return;
        settled = true;
        reject(new OfflineQueueStoreError(errorCode(t.error)));
      };
      t.onabort = fail;
      t.onerror = (event) => {
        // Let the transaction abort; report once from onabort.
        event.preventDefault();
        try {
          t.abort();
        } catch {
          fail();
        }
      };
      try {
        work(t, (value) => {
          result = value;
        });
      } catch (error) {
        try {
          t.abort();
        } catch {
          // already finished
        }
        if (!settled) {
          settled = true;
          reject(
            new OfflineQueueStoreError(
              errorCode(error instanceof Error ? error : null)
            )
          );
        }
      }
    });
  }

  /** Reads the next order number and stores the one after it. */
  function takeOrder(meta: IDBObjectStore, next: (order: number) => void) {
    const read = meta.get(NEXT_ORDER);
    read.onsuccess = () => {
      const order = wholeAtLeast(read.result, 0) ? read.result : 0;
      meta.put(order + 1, NEXT_ORDER);
      next(order);
    };
  }

  /** Reads the queued row for `sent` and passes it only if it is that revision. */
  function withSent(
    queue: IDBObjectStore,
    sent: SentRevision,
    next: (entry: OfflineQueueEntry | null) => void
  ) {
    const read = queue.get(sent.id);
    read.onsuccess = () => {
      const entry = read.result as OfflineQueueEntry | undefined;
      next(entry && entry.revision === sent.revision ? entry : null);
    };
  }

  function capDeadLetters(dead: IDBObjectStore) {
    const all = dead.getAll();
    all.onsuccess = () => {
      const rows = byOrder(all.result as OfflineDeadLetter[]);
      for (const row of rows.slice(
        0,
        Math.max(0, rows.length - OFFLINE_DEAD_LETTER_CAP)
      )) {
        dead.delete(row.id);
      }
    };
  }

  return {
    list() {
      return run<OfflineQueueEntry[]>([QUEUE], "readonly", (t, done) => {
        const all = t.objectStore(QUEUE).getAll();
        all.onsuccess = () => done(byOrder(all.result as OfflineQueueEntry[]));
      });
    },

    deadLetters() {
      return run<OfflineDeadLetter[]>([DEAD], "readonly", (t, done) => {
        const all = t.objectStore(DEAD).getAll();
        all.onsuccess = () => done(byOrder(all.result as OfflineDeadLetter[]));
      });
    },

    enqueue<T>(input: OfflineQueueInput<T>, now: number) {
      return run<OfflineQueueEntry<T>>(
        [QUEUE, META],
        "readwrite",
        (t, done) => {
          const queue = t.objectStore(QUEUE);
          const read = queue.get(input.id);
          read.onsuccess = () => {
            const existing = read.result as OfflineQueueEntry | undefined;
            const write = (order: number) => {
              const entry: OfflineQueueEntry<T> = {
                id: input.id,
                type: input.type,
                endpoint: input.endpoint,
                method: input.method ?? "POST",
                headers: { ...(input.headers ?? DEFAULT_HEADERS) },
                body: input.body,
                createdAt: now,
                retries: 0,
                maxRetries: input.maxRetries ?? 5,
                revision: existing ? existing.revision + 1 : 0,
                nextAttemptAt: now,
                order,
              };
              queue.put(entry);
              done(entry);
            };
            // A replacement keeps its place in line.
            if (existing) write(existing.order);
            else takeOrder(t.objectStore(META), write);
          };
        }
      );
    },

    remove(id) {
      return run<void>([QUEUE], "readwrite", (t) => {
        t.objectStore(QUEUE).delete(id);
      });
    },

    clear() {
      return run<void>([QUEUE], "readwrite", (t) => {
        t.objectStore(QUEUE).clear();
      });
    },

    acknowledge(sent) {
      return run<boolean>([QUEUE], "readwrite", (t, done) => {
        const queue = t.objectStore(QUEUE);
        done(false);
        withSent(queue, sent, (entry) => {
          if (!entry) return;
          queue.delete(sent.id);
          done(true);
        });
      });
    },

    recordRetry(sent, retries, nextAttemptAt) {
      return run<boolean>([QUEUE], "readwrite", (t, done) => {
        const queue = t.objectStore(QUEUE);
        done(false);
        withSent(queue, sent, (entry) => {
          if (!entry) return;
          queue.put({ ...entry, retries, nextAttemptAt });
          done(true);
        });
      });
    },

    moveToDeadLetters(sent, failure) {
      return run<boolean>([QUEUE, DEAD, META], "readwrite", (t, done) => {
        const queue = t.objectStore(QUEUE);
        const dead = t.objectStore(DEAD);
        done(false);
        withSent(queue, sent, (entry) => {
          if (!entry) return;
          takeOrder(t.objectStore(META), (order) => {
            const letter: OfflineDeadLetter = { ...entry, ...failure, order };
            dead.put(letter);
            queue.delete(sent.id);
            capDeadLetters(dead);
            done(true);
          });
        });
      });
    },

    dismissDeadLetter(id) {
      return run<void>([DEAD], "readwrite", (t) => {
        t.objectStore(DEAD).delete(id);
      });
    },

    clearDeadLetters() {
      return run<void>([DEAD], "readwrite", (t) => {
        t.objectStore(DEAD).clear();
      });
    },

    retryDeadLetter(id, now) {
      return run<"requeued" | "superseded" | "missing">(
        [QUEUE, DEAD, META],
        "readwrite",
        (t, done) => {
          const queue = t.objectStore(QUEUE);
          const dead = t.objectStore(DEAD);
          const readDead = dead.get(id);
          readDead.onsuccess = () => {
            const letter = readDead.result as OfflineDeadLetter | undefined;
            if (!letter) {
              done("missing");
              return;
            }
            dead.delete(id);
            const readQueued = queue.get(id);
            readQueued.onsuccess = () => {
              // A newer request with this id supersedes the failed one.
              if (readQueued.result) {
                done("superseded");
                return;
              }
              takeOrder(t.objectStore(META), (order) => {
                const entry: OfflineQueueEntry = {
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
                  order,
                };
                queue.put(entry);
                done("requeued");
              });
            };
          };
        }
      );
    },

    importLegacy(legacyQueue, legacyDeadLetters, now) {
      return run<LegacyImportResult>(
        [QUEUE, DEAD, META],
        "readwrite",
        (t, done) => {
          const queue = t.objectStore(QUEUE);
          const dead = t.objectStore(DEAD);
          const meta = t.objectStore(META);
          const marker = meta.get(LEGACY_IMPORT);
          marker.onsuccess = () => {
            if (marker.result) {
              done({
                status: "already-imported",
                importedQueue: 0,
                importedDeadLetters: 0,
                skipped: 0,
                deadlinesInitialized: 0,
              });
              return;
            }
            const rowsOf = (value: unknown) =>
              Array.isArray(value) ? (value as unknown[]) : [];
            const queueRows = rowsOf(legacyQueue);
            const deadRows = rowsOf(legacyDeadLetters);
            let skipped =
              (legacyQueue !== null &&
              legacyQueue !== undefined &&
              !Array.isArray(legacyQueue)
                ? 1
                : 0) +
              (legacyDeadLetters !== null &&
              legacyDeadLetters !== undefined &&
              !Array.isArray(legacyDeadLetters)
                ? 1
                : 0);
            let importedQueue = 0;
            let importedDeadLetters = 0;
            let deadlinesInitialized = 0;
            const readOrder = meta.get(NEXT_ORDER);
            readOrder.onsuccess = () => {
              let order = wholeAtLeast(readOrder.result, 0)
                ? readOrder.result
                : 0;
              const existing = queue.getAllKeys();
              existing.onsuccess = () => {
                const taken = new Set(existing.result as string[]);
                for (const row of queueRows) {
                  const parsed = legacyEntry(row, now);
                  // A row the new store already holds is newer; keep it.
                  if (!parsed || taken.has(parsed.entry.id)) {
                    skipped += 1;
                    continue;
                  }
                  taken.add(parsed.entry.id);
                  queue.put({ ...parsed.entry, order: order++ });
                  importedQueue += 1;
                  if (parsed.deadlineInitialized) deadlinesInitialized += 1;
                }
                const seenDead = new Set<string>();
                for (const row of deadRows) {
                  const parsed = legacyEntry(row, now);
                  const record = row as Record<string, unknown>;
                  if (
                    !parsed ||
                    seenDead.has(parsed.entry.id) ||
                    typeof record.statusCode !== "number" ||
                    typeof record.failureReason !== "string"
                  ) {
                    skipped += 1;
                    continue;
                  }
                  seenDead.add(parsed.entry.id);
                  dead.put({
                    ...parsed.entry,
                    order: order++,
                    statusCode: record.statusCode,
                    failureReason: record.failureReason,
                    failedAt:
                      typeof record.failedAt === "number"
                        ? record.failedAt
                        : now,
                  });
                  importedDeadLetters += 1;
                }
                capDeadLetters(dead);
                meta.put(order, NEXT_ORDER);
                const result: LegacyImportResult = {
                  status: "imported",
                  importedQueue,
                  importedDeadLetters,
                  skipped,
                  deadlinesInitialized,
                };
                meta.put({ ...result, importedAt: now }, LEGACY_IMPORT);
                done(result);
              };
            };
          };
        }
      );
    },

    close() {
      closed = true;
      db.close();
    },
  };
}
