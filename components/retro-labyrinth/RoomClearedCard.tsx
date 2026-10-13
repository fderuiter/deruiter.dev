"use client";

import { IconArrowRight, IconRefresh, IconTrophy } from "@tabler/icons-react";

interface RoomClearedCardProps {
  readonly isFinalRoom: boolean;
  readonly campaignRoomCount: number;
  readonly runMoves: ReadonlyArray<number>;
  readonly runCrypto: number;
  readonly movesCount: number;
  readonly roomCrypto: number;
  readonly score: number;
  readonly highScore: number;
  readonly showNextRoom: boolean;
  readonly hint: string;
  readonly onNextRoom: () => void;
  readonly onRestart: () => void;
}

/**
 * The card shown when a room is cleared. A roguelike run offers the next
 * room; the last campaign room ends the run. Its buttons are at least 44px on
 * a coarse pointer.
 *
 * @param props - The run figures, the next-action flags and the two actions.
 * @returns The overlay card.
 */
export function RoomClearedCard({
  isFinalRoom,
  campaignRoomCount,
  runMoves,
  runCrypto,
  movesCount,
  roomCrypto,
  score,
  highScore,
  showNextRoom,
  hint,
  onNextRoom,
  onRestart,
}: RoomClearedCardProps) {
  return (
    <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-3 rounded-lg border border-zinc-700 z-30">
      <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-1 text-emerald-400">
        <IconTrophy className="w-4 h-4" aria-hidden="true" />
      </div>
      <h2 className="text-emerald-400 font-bold text-xs uppercase tracking-widest">
        {isFinalRoom ? "RUN COMPLETE" : "MAINFRAME TIER BREACHED"}
      </h2>
      {isFinalRoom && (
        <p className="text-xs text-neutral-400 mt-0.5">
          All {campaignRoomCount} rooms cleared.
        </p>
      )}
      {isFinalRoom ? (
        <>
          <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
            Run total:{" "}
            <span className="font-bold text-zinc-100">
              {runMoves.reduce((a, b) => a + b, 0)}
            </span>{" "}
            moves. Crypto Harvested:{" "}
            <span className="font-bold text-amber-400">+{runCrypto}</span>
          </p>
          <p
            className="text-xs text-neutral-400 font-mono tabular-nums"
            data-testid="labyrinth-run-rooms"
          >
            {runMoves
              .map((moves, i) => `R${String(i + 1).padStart(2, "0")} ${moves}`)
              .join(" · ")}
          </p>
        </>
      ) : (
        <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
          This room:{" "}
          <span className="font-bold text-zinc-100">{movesCount}</span> moves.
          Crypto Harvested:{" "}
          <span className="font-bold text-amber-400">+{roomCrypto}</span>
        </p>
      )}
      <p className="text-xs text-neutral-400">
        Final Score: <span className="font-bold text-zinc-100">{score}</span>
        {isFinalRoom && (
          <>
            {" "}
            · High Score:{" "}
            <span className="font-bold text-amber-400">{highScore}</span>
          </>
        )}
      </p>
      <div className="flex gap-2 mt-2">
        {showNextRoom ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNextRoom();
            }}
            className="inline-flex items-center gap-1 min-h-11 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md [@media(pointer:fine)]:min-h-0"
          >
            <span>Next Room</span>
            <IconArrowRight className="w-3 h-3" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestart();
            }}
            className="inline-flex items-center gap-1 min-h-11 px-3 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/40 text-neutral-200 hover:text-amber-300 text-xs font-bold rounded-lg transition-all cursor-pointer [@media(pointer:fine)]:min-h-0"
          >
            <IconRefresh className="w-3 h-3" aria-hidden="true" />
            {isFinalRoom ? "New Run" : "Play Again"}
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-500 mt-1">{hint}</p>
    </div>
  );
}
