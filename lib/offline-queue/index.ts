/**
 * Public entry point for the IndexedDB offline queue store (#3807).
 *
 * Slice 1 provides the store: atomic enqueue, replacement, acknowledgement,
 * retry and dead-letter operations, and a one-time, restart-safe import of
 * the legacy localStorage arrays. Claims, leases and deadlines in the
 * dispatcher, and the move of `hooks/useOfflineQueue.ts` onto this store,
 * are slice 2.
 */
export * from "./types";
export {
  OFFLINE_DEAD_LETTER_CAP,
  OFFLINE_QUEUE_DB_NAME,
  OFFLINE_QUEUE_DB_VERSION,
  OfflineQueueStoreError,
  openOfflineQueueStore,
} from "./internal/idb-store";
