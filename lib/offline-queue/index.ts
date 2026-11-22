/**
 * Public entry point for the IndexedDB offline queue store (#3807).
 *
 * The store gives atomic enqueue, replacement, claim, acknowledgement,
 * retry and dead-letter operations, and a one-time, restart-safe import of
 * the legacy localStorage arrays. The dispatcher claims due entries with an
 * owner token and a lease, sends them with a timeout and settles only its
 * own claim. Moving `hooks/useOfflineQueue.ts` onto them comes next.
 */
export * from "./types";
export {
  OFFLINE_DEAD_LETTER_CAP,
  OFFLINE_QUEUE_DB_NAME,
  OFFLINE_QUEUE_DB_VERSION,
  OfflineQueueStoreError,
  openOfflineQueueStore,
} from "./internal/idb-store";
export {
  OFFLINE_LEASE_MARGIN_MS,
  OFFLINE_MAX_RETRY_DELAY_MS,
  OFFLINE_REQUEST_TIMEOUT_MS,
  createOfflineDispatcher,
  offlineRetryDelay,
} from "./internal/dispatcher";
