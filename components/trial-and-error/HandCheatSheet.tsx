"use client";

import React from "react";
import { createPortal } from "react-dom";
import {
  closeNow,
  useClaimFocus,
  usePortalTarget,
} from "@/components/trial-and-error/sheet-host";
import type { HandLevelRow, HandType } from "@/lib/trial-and-error";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface HandCheatSheetProps {
  /** The run's hand table at current levels, weakest first, from the view. */
  rows: readonly HandLevelRow[];
  /** Hands the current Blind or stage refuses, from the view. */
  refused: readonly HandType[];
  /** The hand the current selection makes, from the view, or null. */
  selected: HandType | null;
  onClose: () => void;
}

/**
 * The hand cheat sheet (#1081): every hand, strongest first, with its level,
 * base Chips and +Mult at that level, what it is made of and an example. It
 * renders the domain's rows as given and never scores or classifies a hand.
 * Refused hands and the selection's hand are labelled in text, not colour
 * alone. H, Escape or Close dismisses it and focus returns to the trigger.
 * On narrow screens it is a full-height sheet that scrolls, from sm a right
 * sheet over a dimmed table; from 1400px it docks left beside the table, over
 * the page margin and Blind column only, with no backdrop over the hand.
 */
export function HandCheatSheet({
  rows,
  refused,
  selected,
  onClose,
}: HandCheatSheetProps) {
  const portalTarget = usePortalTarget();
  const ref = useFocusTrap<HTMLDivElement>(true, {
    onEscape: closeNow(onClose),
  });
  useClaimFocus(ref);
  const strongestFirst = [...rows].reverse();
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key.toLowerCase() === "h" &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };
  return createPortal(
    <div
      data-te-cabinet=""
      className="fixed inset-0 z-50 flex justify-end bg-black/70 min-[1400px]:pointer-events-none min-[1400px]:justify-start min-[1400px]:bg-transparent"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hand-sheet-heading"
        aria-describedby="hand-sheet-note"
        onKeyDown={onKeyDown}
        className="flex h-dvh w-full min-w-0 flex-col border-zinc-700 bg-[color:var(--te-surface-0)] font-mono text-[color:var(--te-text)] sm:max-w-md sm:border-l min-[1400px]:pointer-events-auto min-[1400px]:w-[22rem] min-[1400px]:border-l-0 min-[1400px]:border-r"
        data-testid="hand-sheet"
      >
        <div className="flex min-w-0 items-start justify-between gap-2 border-b border-zinc-800 p-4">
          <div className="min-w-0">
            <h2
              id="hand-sheet-heading"
              className="text-sm font-bold uppercase tracking-wider break-words"
            >
              Hands
            </h2>
            <p
              id="hand-sheet-note"
              className="mt-1 text-[11px] text-zinc-400 break-words"
            >
              Strongest first, at this run&apos;s levels. Reading this is free.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-keyshortcuts="H Escape"
            className="min-h-[44px] shrink-0 border border-zinc-600 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-200 touch-manipulation hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
          >
            Close [H]
          </button>
        </div>
        <ol
          tabIndex={0}
          aria-labelledby="hand-sheet-heading"
          className="min-h-0 flex-1 overflow-y-auto p-4 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
        >
          {strongestFirst.map((row) => {
            const isRefused = refused.includes(row.handType);
            const isSelected = selected === row.handType;
            return (
              <li
                key={row.handType}
                className={`mb-2 min-w-0 border p-2 ${
                  isSelected
                    ? "border-amber-400 bg-amber-500/10"
                    : "border-zinc-800"
                } ${isRefused ? "border-dashed text-zinc-400" : ""}`}
                data-testid="hand-sheet-row"
                data-hand={row.handType}
                data-refused={isRefused || undefined}
                data-selected={isSelected || undefined}
              >
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
                  <h3 className="min-w-0 font-bold break-words">{row.name}</h3>
                  <span className="tabular-nums">
                    <span className={row.level > 1 ? "text-amber-300" : ""}>
                      Lv.{row.level}
                    </span>{" "}
                    <span
                      className={
                        isRefused ? "" : "text-[color:var(--te-chips)]"
                      }
                    >
                      {row.chips} Chips
                    </span>{" "}
                    <span
                      className={
                        isRefused ? "" : "text-[color:var(--te-plus-mult)]"
                      }
                    >
                      +{row.mult} Mult
                    </span>
                  </span>
                </div>
                {(isSelected || isRefused) && (
                  <p className="mt-1 flex flex-wrap gap-1 text-[10px] font-bold uppercase tracking-wider">
                    {isSelected && (
                      <span className="border border-amber-400 px-1 text-amber-300">
                        Your selection
                      </span>
                    )}
                    {isRefused && (
                      <span className="border border-zinc-600 px-1 text-zinc-400">
                        Refused this stage
                      </span>
                    )}
                  </p>
                )}
                <p className="mt-1 break-words">{row.description}.</p>
                <p className="mt-1 break-words text-zinc-400">
                  For example: {row.example}.
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </div>,
    portalTarget
  );
}
