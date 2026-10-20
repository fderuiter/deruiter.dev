"use client";

import { useEffect, useSyncExternalStore } from "react";

/** What the hook needs from a store; matches `ArcadeStore`. */
interface SubscribableStore<T> {
  readonly fallback: T;
  get(): T;
  subscribe(onChange: () => void): () => void;
  settle(): T;
}

/**
 * A store's value in a React component (`useSyncExternalStore`). The server
 * and hydration render read the fallback; after mount the store is settled
 * once, which sets a damaged value aside and runs its upgrade.
 *
 * @param store - The store to read.
 * @returns The current value.
 */
export function useArcadeStoreValue<T>(store: SubscribableStore<T>): T {
  const value = useSyncExternalStore(
    store.subscribe,
    store.get,
    () => store.fallback
  );
  useEffect(() => {
    store.settle();
  }, [store]);
  return value;
}
