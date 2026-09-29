"use client";

import { useSyncExternalStore, useCallback } from "react";

const HASH_CHANGE_EVENT = "portfolio-studio-hash-change";

interface CachedHashSnapshot {
  raw: string;
  params: Record<string, string>;
}

let cachedSnapshot: CachedHashSnapshot = {
  raw: "",
  params: {},
};

const emptyParams: Record<string, string> = {};

const subscribers = new Set<() => void>();

/* jscpd:ignore-start */
function notifySubscribers(): void {
  subscribers.forEach((callback) => callback());
}

if (typeof window !== "undefined") {
  const handleWindowHashChange = () => {
    const raw = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;

    if (raw !== cachedSnapshot.raw) {
      const searchParams = new URLSearchParams(raw);
      const params: Record<string, string> = {};
      searchParams.forEach((val, key) => {
        params[key] = val;
      });
      cachedSnapshot = { raw, params };
    }
    notifySubscribers();
  };
/* jscpd:ignore-end */

  window.addEventListener("hashchange", handleWindowHashChange);
  window.addEventListener("popstate", handleWindowHashChange);
  window.addEventListener(HASH_CHANGE_EVENT, handleWindowHashChange);
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/* jscpd:ignore-start */
function getClientSnapshot(): Record<string, string> {
  if (typeof window === "undefined") {
    return emptyParams;
  }

  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  if (raw === cachedSnapshot.raw) {
    return cachedSnapshot.params;
  }

  const searchParams = new URLSearchParams(raw);
  const params: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    params[key] = val;
  });

  cachedSnapshot = { raw, params };
  return cachedSnapshot.params;
}
/* jscpd:ignore-end */

function getServerSnapshot(): Record<string, string> {
  return emptyParams;
}

/**
 * Options for updating URL hash parameters.
 */
export interface SetHashParamsOptions {
  /**
   * If true, updates the hash in place with replaceState instead of creating a new history entry with pushState.
   */
  replace?: boolean;
}

/**
 * Updates URL hash parameters with new values.
 *
 * @param updates - Object mapping parameter keys to new string values, or null/undefined to remove the key.
 * @param options - History navigation options (replace vs push).
 */
export function writeHashParams(
  updates: Record<string, string | null | undefined>,
  options?: SetHashParamsOptions
): void {
  if (typeof window === "undefined") {
    return;
  }

  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  const currentParams = new URLSearchParams(raw);

  Object.entries(updates).forEach(([key, val]) => {
    if (val === null || val === undefined || val === "") {
      currentParams.delete(key);
    } else {
      currentParams.set(key, val);
    }
  });

  const newHash = currentParams.toString();

  if (newHash === raw) {
    return;
  }

  const newUrl = `${window.location.pathname}${window.location.search}${newHash ? `#${newHash}` : ""}`;

  if (options?.replace) {
    window.history.replaceState(null, "", newUrl);
  } else {
    window.history.pushState(null, "", newUrl);
  }

  const params: Record<string, string> = {};
  currentParams.forEach((val, key) => {
    params[key] = val;
  });
  cachedSnapshot = { raw: newHash, params };

  window.dispatchEvent(new CustomEvent(HASH_CHANGE_EVENT));
  notifySubscribers();
}

/**
 * Custom hook for synchronizing active studio tab and state with URL hash parameters.
 * Built with useSyncExternalStore for zero tearing and SSR hydration safety.
 */
export function useStudioHashParams() {
  const params = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const getParam = useCallback(
    (key: string, defaultValue: string = ""): string => {
      return params[key] ?? defaultValue;
    },
    [params]
  );

  const setParam = useCallback(
    (key: string, value: string | null | undefined, options?: SetHashParamsOptions) => {
      writeHashParams({ [key]: value }, options);
    },
    []
  );

  const setParams = useCallback(
    (updates: Record<string, string | null | undefined>, options?: SetHashParamsOptions) => {
      writeHashParams(updates, options);
    },
    []
  );

  return {
    params,
    getParam,
    setParam,
    setParams,
  };
}
