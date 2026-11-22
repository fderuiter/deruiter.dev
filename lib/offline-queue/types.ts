/**
 * Types of the IndexedDB offline queue store and its dispatcher (#3807).
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
  /**
   * The context sending this revision now, if any. A claim whose lease has
   * passed may be taken over, so a frozen or closed tab never strands it.
   */
  readonly claim?: OfflineQueueClaim;
}

/** Ownership of one network attempt. */
export interface OfflineQueueClaim {
  /** Random token naming the attempt's owner. */
  readonly ownerToken: string;
  /** Wall-clock time (ms) after which another context may take over. */
  readonly leaseUntil: number;
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
  /**
   * The attempt's owner. When given, the response settles the entry only
   * while that owner still holds the claim, so a late response from an
   * owner whose lease was taken over changes nothing.
   */
  readonly ownerToken?: string;
}

/** Result of trying to claim the next due entry. */
export interface OfflineQueueClaimResult {
  /** The claimed entry, carrying its new claim, or null if none was due. */
  readonly entry: OfflineQueueEntry | null;
  /**
   * When the next entry that could not be claimed becomes claimable, by
   * its deadline or its lease, or null if nothing else is queued.
   */
  readonly nextWakeAt: number | null;
}

/** Timing bounds a claim applies. */
export interface OfflineQueueClaimOptions {
  /** Lease length in ms. */
  readonly leaseMs: number;
  /**
   * Longest retry delay in ms. A deadline further ahead than this, or a
   * lease further ahead than `leaseMs`, can only come from a clock that
   * moved back, so it is treated as passed.
   */
  readonly maxDelayMs: number;
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
  /**
   * In one transaction, claims the first entry in send order that is due
   * and unowned, or whose lease has passed.
   */
  claimNext(
    ownerToken: string,
    now: number,
    options: OfflineQueueClaimOptions
  ): Promise<OfflineQueueClaimResult>;
  /** Removes the sent revision only; returns false if it was replaced. */
  acknowledge(sent: SentRevision): Promise<boolean>;
  /**
   * Records a retry and its deadline on the sent revision only, and
   * releases its claim.
   */
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
    failure: OfflineDeadLetterFailure
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

/** How one network attempt ended. */
export type OfflineSendOutcome =
  | { readonly kind: "ok" }
  /** Retrying cannot help, such as a 4xx other than 408 or 429. */
  | {
      readonly kind: "permanent";
      readonly status: number;
      readonly reason: string;
    }
  /** Worth retrying after a delay: a network error, timeout, 408, 429 or 5xx. */
  | {
      readonly kind: "transient";
      readonly status: number;
      readonly reason: string;
    };

/** Why a request was moved to the dead-letter store. */
export interface OfflineDeadLetterFailure {
  readonly statusCode: number;
  readonly failureReason: string;
  readonly failedAt: number;
}

/** What a dispatcher needs. Timers and clock are injectable for tests. */
export interface OfflineDispatcherOptions {
  readonly store: OfflineQueueStore;
  /**
   * Sends one entry. Must not settle the entry itself. A throw counts as a
   * transient failure.
   */
  readonly send: (
    entry: OfflineQueueEntry,
    signal: AbortSignal | undefined
  ) => Promise<OfflineSendOutcome>;
  /** Owner token for this context; random when omitted. */
  readonly ownerToken?: string;
  /** Wall clock in ms. */
  readonly now?: () => number;
  readonly setTimer?: (run: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  readonly isOnline?: () => boolean;
  /** Called after an entry this context sent moves to the dead letters. */
  readonly onDeadLetter?: (
    entry: OfflineQueueEntry,
    failure: OfflineDeadLetterFailure
  ) => void;
  /** Called after each attempt this context settles, whatever its outcome. */
  readonly onSettled?: () => void;
  /** Longest a request may run; the lease lasts this plus a margin. */
  readonly requestTimeoutMs?: number;
}

/** Counts from one flush. */
export interface OfflineFlushResult {
  processed: number;
  failed: number;
}

/** Sends due entries for one browsing context. */
export interface OfflineDispatcher {
  readonly ownerToken: string;
  /**
   * Sends every due entry it can claim, in order, and schedules a wake for
   * the next deadline. Concurrent calls share one pass.
   */
  flush(): Promise<OfflineFlushResult>;
  isFlushing(): boolean;
  /** Stops scheduling wakes; an attempt in flight still settles. */
  dispose(): void;
}

/** Result of opening the store. */
export type OpenOfflineQueueStoreResult =
  | { readonly ok: true; readonly store: OfflineQueueStore }
  | { readonly ok: false; readonly code: OfflineQueueStoreErrorCode };
