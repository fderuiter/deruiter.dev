"use client";

import React from "react";
import { useLabyrinthSession } from "@/components/retro-labyrinth/RetroLabyrinthSession";
import { formatCampaignRoomBadge } from "@/lib/dungeon";

/**
 * The desktop room's header (#2376): the room badge, the boss, HP, RAM,
 * crypto and score, then the room's objective.
 */
export function RoomHud() {
  const { session } = useLabyrinthSession();
  const {
    gameMode,
    currentRoom,
    roomIndex,
    runLength,
    wallShiftLabel,
    boss,
    playerHp,
    maxPlayerHp,
    currentRam,
    maxRam,
    cryptoBounty,
    score,
    highScore: effectiveHighScore,
    exitLock: roomExitLock,
    runComplete,
  } = session.view;
  return (
    <>
      {/* Header HUD: Subnet Badge, HP, RAM, Crypto, Score */}
      <div className="w-full flex flex-wrap justify-between items-center gap-x-3 gap-y-1 text-xs font-bold px-2 py-0.5 border-b border-neutral-900/60">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">
            SYSTEM_LABYRINTH.EXE ·{" "}
            {gameMode === "roguelike"
              ? formatCampaignRoomBadge(currentRoom.badge, roomIndex)
              : currentRoom.badge}
          </span>
          {gameMode === "roguelike" && (
            <span
              className="shrink-0 text-neutral-400 tabular-nums"
              data-testid="labyrinth-room-count"
            >
              Room {roomIndex + 1} of {runLength}
            </span>
          )}
          <span
            className="text-zinc-400 text-xs hidden sm:inline truncate max-w-[150px]"
            title={currentRoom.title}
          >
            [{currentRoom.title}]
          </span>
          {wallShiftLabel && (
            <span
              className="text-amber-300 text-xs"
              data-testid="labyrinth-wall-telegraph"
            >
              {wallShiftLabel}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Boss HP: the only other feedback is the mesh colour (#1667) */}
          {gameMode === "roguelike" && boss && (
            <div
              className="flex items-center gap-1 text-xs"
              data-testid="labyrinth-boss-hp"
            >
              <span className="text-rose-400">BOSS</span>
              {!boss.defeated && boss.phaseTitle && (
                <span
                  className="text-neutral-300 hidden xl:inline"
                  data-testid="labyrinth-boss-phase"
                >
                  {boss.phaseTitle}
                </span>
              )}
              <div className="w-14 h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className="h-full bg-rose-500 transition-all duration-200"
                  style={{
                    width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-neutral-300 font-bold">
                {boss.defeated ? "DOWN" : boss.hp}
              </span>
            </div>
          )}

          {/* Player HP */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-neutral-400">HP</span>
            <div className="w-14 h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div
                className={`h-full transition-all duration-200 ${
                  playerHp > 50
                    ? "bg-emerald-500"
                    : playerHp > 25
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
                style={{
                  width: `${Math.max(0, (playerHp / maxPlayerHp) * 100)}%`,
                }}
              />
            </div>
            <span className="text-neutral-300 font-bold">{playerHp}</span>
          </div>

          {/* Cyberdeck RAM */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400">RAM</span>
            <div className="w-14 h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-slate-400 transition-all duration-200"
                style={{
                  width: `${Math.max(0, (currentRam / maxRam) * 100)}%`,
                }}
              />
            </div>
            <span className="text-neutral-300 font-bold">{currentRam}</span>
          </div>

          {/* Crypto Balance */}
          <div
            className="flex items-center gap-1 text-xs font-mono text-amber-400 font-bold"
            title="Crypto"
          >
            <span aria-hidden="true">🪙</span>
            <span>{cryptoBounty} Crypto</span>
          </div>

          {/* Total Score & High Score */}
          <div
            className="flex items-center gap-1 text-xs font-mono text-zinc-100 font-bold"
            title="Score"
          >
            <span>SCORE: {score}</span>
            {effectiveHighScore > 0 && (
              <span className="text-neutral-400 font-normal">
                (BEST {effectiveHighScore})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Objective: always say what winning looks like. Short landscape
      screens need every row for the maze, and the in-maze
      "REACH THE EXIT" prompt already carries the goal there. Once the run
      is over there is nothing left to reach (#2841). */}
      {!runComplete && (
        <p className="w-full px-2 py-0.5 text-xs font-bold text-neutral-400 line-clamp-2 [@media(max-height:500px)]:hidden">
          <span className="text-amber-400">OBJECTIVE</span> ·{" "}
          {roomExitLock.locked ? (
            <>
              <span className="text-rose-400" data-testid="labyrinth-objective">
                {roomExitLock.objective}
              </span>{" "}
              to unlock the <span className="text-amber-400">EXIT</span> (bottom
              right), then guide your{" "}
              <span className="text-zinc-100">netrunner</span> there. Bugs and
              drones cost HP.
            </>
          ) : (
            <>
              <span
                className="text-amber-400"
                data-testid="labyrinth-objective"
              >
                REACH THE EXIT
              </span>
              : guide your <span className="text-zinc-100">netrunner</span> to
              the <span className="text-amber-400">EXIT</span> (bottom right).
              Bugs and drones cost HP.
            </>
          )}
        </p>
      )}
    </>
  );
}
