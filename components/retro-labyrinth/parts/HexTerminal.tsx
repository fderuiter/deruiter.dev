"use client";

import React, { type RefObject } from "react";
import { IconTerminal2 } from "@tabler/icons-react";
import { useLabyrinthSession } from "@/components/retro-labyrinth/RetroLabyrinthSession";

/** Props for {@link HexTerminal}. */
interface HexTerminalProps {
  /** Takes focus once the puzzle is finished (#1943). */
  readonly closeButtonRef: RefObject<HTMLButtonElement | null>;
  /** Closes the terminal and hands focus back to the board. */
  readonly onFinish: () => void;
}

/**
 * The hex buffer puzzle a room's terminal opens (#2376): the target, the
 * buffer, the grid and the bypass chip. Shown while the room is hacking.
 */
export function HexTerminal({ closeButtonRef, onFinish }: HexTerminalProps) {
  const { session } = useLabyrinthSession();
  const { view, intents } = session;
  const { gameStatus, hexPuzzle, hackingFeedback, bypassChips } = view;
  return (
    <>
      {/* Interactive Hex Matrix Hacking Modal Overlay */}
      {gameStatus === "hacking" && hexPuzzle && (
        <div className="absolute inset-0 bg-neutral-950/98 backdrop-blur-md flex flex-col items-center justify-between p-2 rounded-lg border border-zinc-700 z-40">
          <div className="w-full flex justify-between items-center text-xs font-bold text-amber-400 border-b border-zinc-800 pb-1">
            <div className="flex items-center gap-1">
              <IconTerminal2 className="w-3.5 h-3.5 text-amber-400" />
              <span>HEX BUFFER BYPASS MATRIX</span>
            </div>
            <div className="flex items-center gap-2">
              <span>TARGET: [{hexPuzzle.targetSequence.join(" ")}]</span>
              <span className="text-amber-400">
                +{hexPuzzle.rewardCrypto} CRYPTO
              </span>
            </div>
          </div>

          {/* Buffer Bar */}
          <div className="w-full flex items-center justify-between px-2 py-0.5 text-xs bg-neutral-900/80 rounded border border-neutral-800">
            <span className="text-neutral-400">
              BUFFER [{hexPuzzle.currentInput.length}/{hexPuzzle.maxBufferSize}
              ]:
            </span>
            <span className="text-zinc-100 font-bold">
              {hexPuzzle.currentInput.length > 0
                ? hexPuzzle.currentInput.join(" ")
                : "(EMPTY)"}
            </span>
            <span className="text-amber-300 font-bold">
              AXIS:{" "}
              {hexPuzzle.activeAxis === "row"
                ? `ROW ${hexPuzzle.activeIndex + 1}`
                : `COL ${hexPuzzle.activeIndex + 1}`}
            </span>
          </div>

          {/* Hex Grid: one visual row per puzzle row, so the highlighted
              row and column line up at any size (#2175). */}
          <div
            className="grid gap-1 my-1"
            data-testid="labyrinth-hex-grid"
            style={{
              gridTemplateColumns: `repeat(${hexPuzzle.grid[0]?.length ?? hexPuzzle.grid.length}, minmax(0, 1fr))`,
            }}
          >
            {hexPuzzle.grid.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const isSelectable =
                  (hexPuzzle.activeAxis === "row" &&
                    rIdx === hexPuzzle.activeIndex) ||
                  (hexPuzzle.activeAxis === "col" &&
                    cIdx === hexPuzzle.activeIndex);

                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    onClick={() => intents.selectHex(rIdx, cIdx)}
                    disabled={
                      cell.selected || hexPuzzle.solved || hexPuzzle.failed
                    }
                    className={`w-7 h-6 rounded flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                      cell.selected
                        ? "bg-neutral-900 text-neutral-600 border border-neutral-800"
                        : isSelectable
                          ? "bg-amber-500/15 text-amber-200 border border-amber-400 hover:bg-amber-500/30"
                          : "bg-neutral-900/60 text-neutral-500 border border-neutral-900"
                    }`}
                  >
                    {cell.byte}
                  </button>
                );
              })
            )}
          </div>

          {/* Feedback text */}
          <div className="text-xs font-bold text-center text-zinc-100 px-2 break-words w-full">
            {hackingFeedback}
          </div>

          {/* Minigame Action Footer */}
          <div className="w-full flex items-center justify-between gap-1 pt-1 border-t border-neutral-900/60 text-xs">
            <button
              onClick={intents.spendBypassChip}
              disabled={bypassChips <= 0 || hexPuzzle.solved}
              className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 hover:bg-emerald-900 disabled:opacity-40 cursor-pointer font-bold"
            >
              🔌 Hardware Chip ({bypassChips} left)
            </button>

            <button
              ref={closeButtonRef}
              onClick={onFinish}
              className="px-3 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 cursor-pointer font-bold"
            >
              {hexPuzzle.solved ? "Complete Decryption" : "Abort [ESC]"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
