"use client";

import { useSyncExternalStore } from "react";
import {
  parseChallengeHash,
  seedFromBytes,
  utcDate,
  type Challenge,
} from "@/lib/trial-and-error";

/** The route a challenge link opens. */
export const CHALLENGE_PATH = "/arcade/trial-and-error";

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readHash = () => window.location.hash;
const noHash = () => "";

/**
 * The challenge in the page's URL hash (#1528), e.g. `#seed=7K3M-Q9PX`, or
 * null. Read through `useSyncExternalStore` with an empty server snapshot, so
 * the server never renders a seed and hydration never disagrees.
 */
export function useChallengeHash(): Challenge | null {
  const hash = useSyncExternalStore(subscribeHash, readHash, noHash);
  return hash ? parseChallengeHash(hash) : null;
}

/**
 * Drops a consumed challenge from the address bar, so a reload resumes the
 * run instead of offering the challenge again. `replaceState` fires no
 * `hashchange`, so one is sent for `useChallengeHash` to read the empty hash.
 */
export function clearChallengeHash(): void {
  if (!window.location.hash) return;
  try {
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", pathname + search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } catch {
    // No history API (a test harness): nothing to clear.
  }
}

// The date only changes at midnight UTC; a minute's resolution is plenty.
function subscribeClock(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

const readToday = () => utcDate(Date.now());
const noDate = () => null;

/**
 * Today's UTC date, `YYYY-MM-DD`, on the client only: the server snapshot is
 * null, so a date-dependent seed is never rendered on the server and never
 * mismatches at midnight UTC or across time zones.
 */
export function useUtcToday(): string | null {
  return useSyncExternalStore(subscribeClock, readToday, noDate);
}

/** A fresh codec seed from the browser's cryptographic random source. */
export function freshSeed(): string {
  const bytes = new Uint8Array(5);
  globalThis.crypto.getRandomValues(bytes);
  return seedFromBytes(bytes);
}
