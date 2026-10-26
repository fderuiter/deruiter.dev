"use client";

import React from "react";
import { useLabyrinthSession } from "@/components/retro-labyrinth/RetroLabyrinthSession";
import type { LabyrinthOverlay } from "@/components/retro-labyrinth/useRetroLabyrinthSession";

/** Props for {@link RoomStatusCards}. */
interface RoomStatusCardsProps {
  /** The touch cabinet draws the pause card solid, with no blur. */
  readonly touchCabinet: boolean;
  readonly resumeHint: string;
  readonly retryHint: string;
  readonly openOverlay: (overlay: LabyrinthOverlay) => void;
  /** Hands focus back to the board after a card's button. */
  readonly refocus: () => void;
}

/**
 * The pause and trace cards over the board (#2376). A cabinet with views
 * shows its own pause overlay instead of this pause card (#2357).
 */
export function RoomStatusCards({
  touchCabinet,
  resumeHint,
  retryHint,
  openOverlay,
  refocus,
}: RoomStatusCardsProps) {
  const { session, cabinetPause } = useLabyrinthSession();
  const { view, intents } = session;
  const { gameStatus, lastHitBy } = view;
  return (
    <>
      {/* Pause Overlay. A cabinet with views shows its own (#2357). */}
      {gameStatus === "paused" && !cabinetPause && (
        <div
          className={`absolute inset-0 ${touchCabinet ? "bg-black/90" : "bg-neutral-950/90 backdrop-blur-sm"} flex flex-col items-center justify-center text-center p-3 rounded-lg border border-zinc-700 z-30`}
        >
          <h2 className="text-zinc-100 font-bold text-xs uppercase tracking-widest">
            PAUSED
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              intents.resume();
              refocus();
            }}
            className="mt-2 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-all cursor-pointer [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-28"
          >
            Resume
          </button>
          <p className="text-xs text-neutral-400 mt-1">{resumeHint}</p>
        </div>
      )}

      {/* Caught / Game Over Overlay */}
      {gameStatus === "caught" && (
        <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-3 rounded-lg border border-rose-500/30 z-30">
          <h2 className="text-rose-400 font-bold text-xs uppercase tracking-widest">
            IP TRACE INTERCEPTED
          </h2>
          <p
            className="text-xs text-neutral-400 mt-1"
            data-testid="labyrinth-trace-cause"
          >
            {lastHitBy}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              intents.retry();
              refocus();
            }}
            className="mt-2 px-3 py-1 bg-neutral-900 text-rose-300 border border-rose-800 hover:bg-rose-950 text-xs font-bold rounded cursor-pointer transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-28"
          >
            RETRY BREACH
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openOverlay("firmware_bay");
            }}
            className="mt-1 px-3 py-1 bg-neutral-900 text-amber-300 border border-amber-700/50 hover:bg-amber-950/40 text-xs font-bold rounded cursor-pointer transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-28"
          >
            Firmware Upgrades
          </button>
          <p className="text-xs text-neutral-500 mt-1">{retryHint}</p>
        </div>
      )}
    </>
  );
}
