"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { IconShoppingCart } from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/** One line of the Market, with its purchase state worked out by the game. */
export interface MarketRow {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly description: string;
  readonly note: string | null;
  readonly disabled: boolean;
  readonly label: string;
}

interface DarknetMarketProps {
  readonly crypto: number;
  readonly rows: ReadonlyArray<MarketRow>;
  readonly onBuy: (id: string) => void;
  readonly onClose: () => void;
}

/**
 * The darknet Market as a modal dialog. Focus stays inside it, Escape closes
 * it, and the item list is a labelled, keyboard-scrollable region with a cue
 * while more items sit below the fold.
 *
 * @param props - The purchasable rows, the crypto balance and the two actions.
 * @returns The dialog.
 */
export function DarknetMarket({
  crypto,
  rows,
  onBuy,
  onClose,
}: DarknetMarketProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: closeRef,
    onEscape: onClose,
  });

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setMoreBelow(list.scrollTop + list.clientHeight < list.scrollHeight - 4);
  }, []);

  // Resizes change how much fits, so the cue is re-measured on each one. The
  // observer's first callback runs after layout, so the cue is never stale.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className="absolute inset-0 bg-neutral-950/98 backdrop-blur-md flex flex-col items-center justify-between p-2.5 rounded-lg border border-zinc-700 z-40"
    >
      <div className="w-full flex justify-between items-center text-xs font-bold text-amber-300 border-b border-zinc-800 pb-1">
        <h2 id={titleId} className="flex items-center gap-1 text-xs font-bold">
          <IconShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
          <span>DARKNET EXPLOIT BLACK-MARKET</span>
        </h2>
        <span className="text-amber-300">🪙 {crypto} Crypto Available</span>
      </div>

      <div className="relative w-full flex-1 min-h-0 my-1">
        <div
          ref={listRef}
          role="region"
          aria-label="Market items"
          tabIndex={0}
          onScroll={measure}
          className="w-full h-full flex flex-col gap-1 overflow-y-auto pr-1"
        >
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-1 p-1 bg-neutral-900/80 border border-neutral-800 rounded text-xs"
            >
              <div className="flex items-center gap-1 min-w-0">
                <span aria-hidden="true">{row.icon}</span>
                <div className="min-w-0">
                  <div className="text-neutral-200 font-bold">{row.name}</div>
                  <div className="text-neutral-400 text-xs">
                    {row.description}
                    {row.note}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onBuy(row.id)}
                disabled={row.disabled}
                className="shrink-0 min-h-11 min-w-11 px-2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-40 font-bold cursor-pointer whitespace-nowrap [@media(pointer:fine)]:min-h-0 [@media(pointer:fine)]:min-w-0 [@media(pointer:fine)]:py-0.5"
              >
                {row.label}
              </button>
            </div>
          ))}
        </div>
        {moreBelow && (
          <div
            aria-hidden="true"
            data-testid="market-more-cue"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 flex items-end justify-center bg-gradient-to-t from-neutral-950 to-transparent pb-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300"
          >
            More below
          </div>
        )}
      </div>

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="w-full min-h-11 py-0.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded text-xs font-bold cursor-pointer [@media(pointer:fine)]:min-h-0"
      >
        Close Darknet Market
      </button>
    </div>
  );
}
