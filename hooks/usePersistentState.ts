"use client";

import {
  useSyncExternalStore,
  useCallback,
  Dispatch,
  SetStateAction,
} from "react";
import {
  safeStorage,
  STORAGE_CHANGE_EVENT,
  type StorageOptions,
} from "@/lib/safe-storage";
import { logger } from "@/lib/logger";

const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key) {
      safeStorage.invalidateCacheKey(event.key);
      notifySubscribers();
    }
  });

  window.addEventListener(STORAGE_CHANGE_EVENT, () => {
    notifySubscribers();
  });
}

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function getStoredSnapshot<T>(key: string, initialValue: T): T {
  if (typeof window === "undefined") {
    return initialValue;
  }
  const item = safeStorage.getItem<T>(key, initialValue);
  return item !== null ? item : initialValue;
}

/**
 * Custom hook that works like useState but persists state to safeStorage using useSyncExternalStore.
 * Synchronizes seamlessly across multiple hook instances and browser tabs with zero tearing.
 *
 * @param key - The localStorage key to use for this state
 * @param initialValue - The default value if nothing is found in localStorage
 * @param options - Optional StorageOptions for expiration and LRU eviction tagging
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T,
  options?: StorageOptions
): [T, Dispatch<SetStateAction<T>>] {
  const getSnapshot = useCallback(
    () => getStoredSnapshot(key, initialValue),
    [key, initialValue]
  );
  const getServerSnapshot = useCallback(() => initialValue, [initialValue]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPersistentState = useCallback(
    (value: SetStateAction<T>) => {
      try {
        const current = getStoredSnapshot(key, initialValue);
        const newValue =
          typeof value === "function"
            ? (value as (prev: T) => T)(current)
            : value;

        safeStorage.setItem(key, newValue, options);
        notifySubscribers();
      } catch (error) {
        logger.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, initialValue, options]
  );

  return [state, setPersistentState];
}
