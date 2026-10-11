"use client";

/**
 * One-shot DOM bursts for the For Better or Bulk cabinet. They render only
 * while the cabinet is loud (`data-fbb-loud="on"`), animate only transform and
 * opacity, and remove themselves when their animation ends. A timer backs up
 * `animationend`, so a burst cannot linger if the animation never runs.
 */

import React, { useCallback, useEffect, useRef } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/** Loud moments need a desktop-sized viewport and motion the viewer allows. */
export const FBB_LOUD_QUERY =
  "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

/** Whether the cabinet may show loud effects. Hydration-safe (AGENTS.md section 4). */
export function useFbbLoud(): boolean {
  return useMediaQuery(FBB_LOUD_QUERY);
}

/** How long a DOM burst stays up if its animation never reports an end. */
const BURST_FALLBACK_MS = 900;

/** A burst kept in a list until its animation ends. */
export interface DomBurst {
  readonly id: number;
  readonly text: string;
}

interface BurstLayerProps {
  readonly bursts: readonly DomBurst[];
  readonly onDone: (id: number) => void;
}

/**
 * The layer over the venue that holds the brothers' text burst. Each burst
 * is a single span; the layer is aria-hidden because the toast and the screen
 * reader line already carry the message.
 */
export function BurstLayer({ bursts, onDone }: BurstLayerProps) {
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  /** Ends one burst, clearing its fallback timer so it cannot fire later. */
  const finish = useCallback(
    (id: number) => {
      const live = timers.current;
      const timer = live.get(id);
      if (timer !== undefined) clearTimeout(timer);
      live.delete(id);
      onDone(id);
    },
    [onDone]
  );

  useEffect(() => {
    const live = timers.current;
    for (const burst of bursts) {
      if (live.has(burst.id)) continue;
      const timer = setTimeout(() => finish(burst.id), BURST_FALLBACK_MS);
      live.set(burst.id, timer);
    }
  }, [bursts, finish]);

  useEffect(() => {
    const live = timers.current;
    return () => {
      for (const timer of live.values()) clearTimeout(timer);
      live.clear();
    };
  }, []);

  if (bursts.length === 0) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      {bursts.map((burst) => (
        <span
          key={burst.id}
          className="fbb-burst fbb-burst-text"
          onAnimationEnd={() => finish(burst.id)}
        >
          {burst.text}
        </span>
      ))}
    </div>
  );
}

interface RowFlashProps {
  readonly onDone: () => void;
}

/**
 * A one-shot flash across a checklist row when its category is complete. The
 * parent mounts it under a fresh key each time, so it plays once per event.
 */
export function RowFlash({ onDone }: RowFlashProps): React.ReactElement {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const timer = setTimeout(() => done.current(), BURST_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <span
      aria-hidden="true"
      className="fbb-burst fbb-burst-row"
      onAnimationEnd={() => done.current()}
    />
  );
}
