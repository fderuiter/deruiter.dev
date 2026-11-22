/**
 * Types of the IndexedDB offline queue store (#3807, slice 1).
 */

/** HTTP methods a queued request may use. */
export type OfflineQueueMethod = "POST" | "PUT" | "PATCH" | "DELETE";

/** A request waiting to be sent. */
export interface OfflineQueueEntry<T = unknown> {
  readonly id: string;
  readonly type: string;
  readonly endpoint: string;
  readonly method: OfflineQueueMethod;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: T;
  readonly createdAt: number;
  readonly retries: number;
  readonly maxRetries: number;
  /**
   * How many times this id was replaced while queued. A response settles
   * only the revision that was sent (#3795). Legacy entries read as 0.
   */
  readonly revision: number;
  /** Wall-clock time (ms) before which the entry must not be sent. */
  readonly nextAttemptAt: number;
  /** Insertion order, so entries flush first in, first out. */
  readonly order: number;
}

/** A request that failed for good. */
export interface OfflineDeadLetter<T = unknown> extends OfflineQueueEntry<T> {
  readonly failedAt: number;
  readonly statusCode: number;
  readonly failureReason: string;
}

/** What a caller provides to enqueue. */
export interface OfflineQueueInput<T = unknown> {
  readonly id: string;
  readonly type: string;
  readonly endpoint: string;
  readonly method?: OfflineQueueMethod;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body: T;
  readonly maxRetries?: number;
}

/** The revision a response settles. */
export interface SentRevision {
  readonly id: string;
  readonly revision: number;
}

/** Why a store operation failed. None of these acknowledge durability. */
export type OfflineQueueStoreErrorCode =
  /** IndexedDB is missing, blocked or failed to open. */
  | "STORE_UNAVAILABLE"
  /** The transaction aborted, so none of its writes happened. */
  | "TRANSACTION_ABORTED"
  /** The browser refused the write for lack of space. */
  | "QUOTA_EXCEEDED"
  /** The store was closed. */
  | "STORE_CLOSED";

/** Outcome of importing the legacy localStorage arrays. */
export interface LegacyImportResult {
  readonly status: "imported" | "already-imported";
  readonly importedQueue: number;
  readonly importedDeadLetters: number;
  /** Legacy rows that failed validation and were left out. */
  readonly skipped: number;
  /**
   * Legacy rows had no retry deadline, so they became due at import time.
   * Recorded so nobody reads it as an old deadline.
   */
  readonly deadlinesInitialized: number;
}

/** Atomic operations on the queue and dead-letter stores. */
export interface OfflineQueueStore {
  /** Entries in send order. */
  list(): Promise<readonly OfflineQueueEntry[]>;
  deadLetters(): Promise<readonly OfflineDeadLetter[]>;
  /**
   * Adds an entry, or replaces the queued entry with the same id in place:
   * its revision goes up by one, retries restart at zero and it is due now.
   */
  enqueue<T>(
    input: OfflineQueueInput<T>,
    now: number
  ): Promise<OfflineQueueEntry<T>>;
  /** Removes an id whatever its revision (the author withdrew it). */
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  /** Removes the sent revision only; returns false if it was replaced. */
  acknowledge(sent: SentRevision): Promise<boolean>;
  /** Records a retry and its deadline on the sent revision only. */
  recordRetry(
    sent: SentRevision,
    retries: number,
    nextAttemptAt: number
  ): Promise<boolean>;
  /**
   * Moves the sent revision to the dead-letter store in one transaction,
   * replacing a dead letter with the same id and keeping the newest 50.
   */
  moveToDeadLetters(
    sent: SentRevision,
    failure: {
      readonly statusCode: number;
      readonly failureReason: string;
      readonly failedAt: number;
    }
  ): Promise<boolean>;
  dismissDeadLetter(id: string): Promise<void>;
  clearDeadLetters(): Promise<void>;
  /**
   * Re-queues a dead letter unless a newer request with its id is already
   * queued, in which case the dead letter is just dismissed.
   */
  retryDeadLetter(
    id: string,
    now: number
  ): Promise<"requeued" | "superseded" | "missing">;
  /**
   * Imports the legacy localStorage queue and dead-letter arrays once, in
   * one transaction with an import marker. A crash before commit imports
   * nothing, so the next call starts again; after commit it does nothing.
   */
  importLegacy(
    legacyQueue: unknown,
    legacyDeadLetters: unknown,
    now: number
  ): Promise<LegacyImportResult>;
  close(): void;
}

/** Result of opening the store. */
export type OpenOfflineQueueStoreResult =
  | { readonly ok: true; readonly store: OfflineQueueStore }
  | { readonly ok: false; readonly code: OfflineQueueStoreErrorCode };
