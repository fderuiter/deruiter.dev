"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Hydration-safe React hook that returns whether the component has mounted on the client.
 *
 * During server-side rendering and initial hydration, this hook returns false.
 * Once mounted on the client, it returns true, avoiding hydration mismatches when
 * accessing browser-only globals such as window or document.
 *
 * @returns True when mounted on the client, false during SSR and initial hydration.
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
