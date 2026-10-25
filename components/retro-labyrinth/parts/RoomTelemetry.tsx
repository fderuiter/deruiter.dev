"use client";

import React from "react";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import type { ThreatLevel } from "@/components/retro-labyrinth/threat";
import { useLabyrinthSession } from "@/components/retro-labyrinth/RetroLabyrinthSession";
import {
  EXIT_X,
  EXIT_Y,
} from "@/components/retro-labyrinth/useRetroLabyrinthSession";

/**
 * The room as text for screen readers and tests (#2376): the telemetry group
 * a replay reads, and buttons for each action. The buttons are out of the
 * Tab order: every action has a key, and invisible tab stops between the
 * board and the toolbar lost sighted keyboard players (#1943).
 */
export function RoomTelemetry({
  threatLevel,
}: {
  /** The patrol warning the view shows, or "none". */
  readonly threatLevel: ThreatLevel;
}) {
  const { session } = useLabyrinthSession();
  const { view, intents } = session;
  const {
    playerPosition,
    exitLock: roomExitLock,
    gridData,
    nodeData,
    enemies,
    score,
    highScore: effectiveHighScore,
    stage,
    gameStatus,
    playerHp,
    maxPlayerHp,
    gameMode,
    boss,
    activeWeaponId,
    bypassChips,
  } = view;
  const { announce } = useAnnouncer();
  return (
    <div className="sr-only" aria-label="Retro Labyrinth Accessible Subtree">
      <fieldset>
        <legend>Retro Labyrinth Dungeon Crawl State and Controls</legend>

        <div
          role="group"
          aria-label="Dungeon Telemetry and Status"
          data-player-cell={`${playerPosition.x},${playerPosition.y}`}
          data-exit-cell={`${EXIT_X},${EXIT_Y}`}
          data-exit-locked={String(roomExitLock.locked)}
          data-threat={threatLevel}
          data-grid={gridData}
          data-nodes={nodeData}
          data-patrol-cells={enemies
            .filter((e) => e.state !== "stunned" && e.state !== "frozen")
            .map((e) => `${e.x},${e.y}`)
            .join(";")}
        >
          <output htmlFor="retro-score">Score: {score}</output>
          <output htmlFor="retro-highscore">
            High Score: {effectiveHighScore}
          </output>
          <output htmlFor="retro-stage">Stage: {stage}</output>
          <output htmlFor="retro-status">Game Status: {gameStatus}</output>
          <output htmlFor="retro-player-pos">
            Player Location: Grid ({playerPosition.x}, {playerPosition.y})
          </output>
          <output htmlFor="retro-hp">
            Cyberdeck Integrity: {playerHp} / {maxPlayerHp} HP
          </output>
          {gameMode === "roguelike" && boss && (
            <output htmlFor="retro-boss-hp">
              {boss.defeated
                ? "Boss defeated."
                : `Boss HP: ${boss.hp} / ${boss.maxHp}`}
            </output>
          )}
          <output htmlFor="retro-weapon">
            Active Cyberdeck Weapon: {activeWeaponId}
          </output>
          <output htmlFor="retro-bypass">Bypass Chips: {bypassChips}</output>
        </div>

        {/* Out of the Tab order: every action has a key, and invisible
              tab stops between the board and the toolbar lost sighted
              keyboard players (#1943). Screen readers still reach them. */}
        <div
          role="group"
          aria-label="Interactive Navigation and Combat Actions"
        >
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              intents.move("up");
              announce(
                `Moved Up to (${playerPosition.x}, ${Math.max(0, playerPosition.y - 1)})`,
                "polite"
              );
            }}
          >
            Move North / Up
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              intents.move("down");
              announce(
                `Moved Down to (${playerPosition.x}, ${playerPosition.y + 1})`,
                "polite"
              );
            }}
          >
            Move South / Down
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              intents.move("left");
              announce(
                `Moved Left to (${Math.max(0, playerPosition.x - 1)}, ${playerPosition.y})`,
                "polite"
              );
            }}
          >
            Move West / Left
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              intents.move("right");
              announce(
                `Moved Right to (${playerPosition.x + 1}, ${playerPosition.y})`,
                "polite"
              );
            }}
          >
            Move East / Right
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              intents.fireActive();
              announce(
                `Dispatched cyber weapon attack: ${activeWeaponId}`,
                "polite"
              );
            }}
          >
            Execute Selected Cyber Attack ({activeWeaponId})
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              intents.spendBypassChip();
              announce("Used hardware bypass chip.", "polite");
            }}
            disabled={bypassChips <= 0}
          >
            Consume Bypass Chip
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              intents.retry();
              announce("Restarted Cyberdeck Dungeon Simulation.", "polite");
            }}
          >
            Restart Dungeon Simulation
          </button>

          {gameStatus === "victory" && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                intents.continue();
                announce("Navigated to next cyberdeck room.", "polite");
              }}
            >
              Advance to Next Stage
            </button>
          )}
        </div>
      </fieldset>
    </div>
  );
}
