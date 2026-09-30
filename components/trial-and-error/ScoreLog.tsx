"use client";

import React, { useId, useState, useSyncExternalStore } from "react";
import type { ScoreLogEntry } from "@/lib/trial-and-error";
import { safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";

const OPEN_STORAGE_KEY = "te:score-log-open";

function readOpen(): boolean {
  return safeGetRawItem(OPEN_STORAGE_KEY) === "1";
}

function subscribeOpen(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === OPEN_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
  };
}

const getServerOpen = () => false;

/** Remembers the choice for this viewer; a failing store is ignored. */
function storeOpen(open: boolean): void {
  // Storage unavailable: the write is dropped; the open state still holds
  // for this visit through component state.
  safeSetRawItem(OPEN_STORAGE_KEY, open ? "1" : "0", {
    retainInMemory: false,
  });
}

interface ScoreLogProps {
  /** The Blind's hands, oldest first, from the view. */
  entries: readonly ScoreLogEntry[];
  /** The protocol deviation that landed this Blind, after which hand (#1087). */
  deviation?: { name: string; afterHands: number } | null;
}

/**
 * The Blind's score log (#1082): every hand played, with Chips × Mult, the
 * score and what fired. It renders the view's entries and never scores a
 * hand. Collapsed by default; the choice is remembered per viewer when
 * storage allows. Entries appear without animation.
 */
export function ScoreLog({ entries, deviation = null }: ScoreLogProps) {
  const stored = useSyncExternalStore(subscribeOpen, readOpen, getServerOpen);
  // The toggle works without storage: this visit's choice wins over it.
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? stored;
  const others = (entry: ScoreLogEntry) =>
    entry.fired.filter((effect) => effect.kind !== "ZERO_RULE");
  const listId = useId();
  return (
    <section className="mt-3 min-w-0" data-testid="score-log">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setChoice(!open);
          storeOpen(!open);
        }}
        className="flex min-h-[44px] w-full min-w-0 items-center justify-between gap-2 border border-zinc-700 px-2 text-left text-[10px] font-bold uppercase tracking-wider text-zinc-300 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
        data-testid="score-log-toggle"
      >
        <span className="min-w-0 break-words">Score log</span>
        <span className="shrink-0 tabular-nums text-zinc-400">
          {entries.length} {entries.length === 1 ? "hand" : "hands"}{" "}
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </span>
      </button>
      <div id={listId} hidden={!open}>
        {entries.length === 0 ? (
          <p className="mt-2 text-zinc-400 break-words">
            No hands played this Blind yet.
          </p>
        ) : (
          <ol className="mt-2 space-y-1" aria-label="Hands played this Blind">
            {entries.map((entry, i) => {
              const zero = entry.zeroLabel !== null;
              return (
                <li
                  key={i}
                  className={`min-w-0 border p-2 break-words ${zero ? "border-rose-400/60" : "border-zinc-800"}`}
                  data-testid="score-log-entry"
                  data-zero={zero || undefined}
                >
                  <p className="flex min-w-0 flex-wrap justify-between gap-x-2">
                    <span className="min-w-0 font-bold text-zinc-200">
                      {i + 1}. {entry.name}
                    </span>
                    <span className="tabular-nums text-zinc-300">
                      {entry.chips} × {entry.mult} ={" "}
                      <span className={zero ? "text-rose-300" : ""}>
                        {entry.score}
                      </span>
                    </span>
                  </p>
                  {zero && (
                    <p className="mt-1 font-bold text-rose-300">
                      Scored zero: {entry.zeroLabel} ×0
                    </p>
                  )}
                  {others(entry).length > 0 && (
                    <ul className="mt-1 text-zinc-400">
                      {others(entry).map((effect, j) => (
                        <li key={j} className="break-words">
                          {effect.label}: {effect.effect}
                        </li>
                      ))}
                    </ul>
                  )}
                  {deviation?.afterHands === i + 1 && (
                    <p
                      className="mt-1 text-amber-300"
                      data-testid="score-log-deviation"
                    >
                      Then a protocol deviation: {deviation.name}.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
