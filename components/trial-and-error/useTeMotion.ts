"use client";

import { useSyncExternalStore } from "react";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";

/** Playback speeds for the scoring spectacle (ADR 0046 amendment). */
type TeGameSpeed = 1 | 2 | 4;

/** Motion preferences every Trial & Error presentation layer reads. */
interface TeMotion {
  /** The viewer asked the OS for reduced motion. */
  reducedMotion: boolean;
  /** Persisted per-viewer game speed; 1× unless the viewer chose otherwise. */
  speed: TeGameSpeed;
  setSpeed: (speed: TeGameSpeed) => void;
  /** Below 768px, where AGENTS.md §16 mobile budgets apply. */
  isCompactViewport: boolean;
  /** Loud moments (shake, CRT, glow) may render. */
  loudEffectsEnabled: boolean;
}

const SPEED_STORAGE_KEY = "te:game-speed";
const SPEED_CHANGE_EVENT = "te:game-speed-change";
const SPEEDS: readonly TeGameSpeed[] = [1, 2, 4];

function readSpeed(): TeGameSpeed {
  const stored = Number(safeGetRawItem(SPEED_STORAGE_KEY));
  return SPEEDS.includes(stored as TeGameSpeed) ? (stored as TeGameSpeed) : 1;
}

function subscribeSpeed(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SPEED_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SPEED_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SPEED_CHANGE_EVENT, callback);
  };
}

const getServerSpeed = (): TeGameSpeed => 1;

/**
 * Persists a new game speed and notifies every mounted `useTeMotion`. Storage
 * failures (private windows, blocked site data) are ignored: the speed then
 * simply stays at its current value.
 */
function setSpeed(speed: TeGameSpeed): void {
  if (!SPEEDS.includes(speed)) return;
  safeSetRawItem(SPEED_STORAGE_KEY, String(speed), { retainInMemory: false });
  window.dispatchEvent(new Event(SPEED_CHANGE_EVENT));
}

/**
 * Motion preferences for the Trial & Error cabinet: reduced motion, the
 * persisted game speed, and whether loud-moment effects may render. Reads are
 * hydration-safe (`useSyncExternalStore`), per AGENTS.md §4.
 */
export function useTeMotion(): TeMotion {
  const reducedMotion = usePrefersReducedMotion();
  const speed = useSyncExternalStore(subscribeSpeed, readSpeed, getServerSpeed);
  const isCompactViewport = useIsMobileViewport();
  return {
    reducedMotion,
    speed,
    setSpeed,
    isCompactViewport,
    loudEffectsEnabled: !reducedMotion && !isCompactViewport,
  };
}
