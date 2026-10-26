"use client";

import React from "react";
import { PhoneHud, type PhoneHudChip } from "@/components/arcade/mobile/ui";
import { useLabyrinthSession } from "@/components/retro-labyrinth/RetroLabyrinthSession";

/** Props for {@link LabyrinthPhoneHud}. */
interface LabyrinthPhoneHudProps {
  /** The Options key, so the sheet can hand focus back to it. */
  readonly optionsButtonRef: React.RefObject<HTMLButtonElement | null>;
  readonly optionsOpen: boolean;
  readonly onOptions: () => void;
}

/**
 * The phone's one-row HUD (#2918): Room, HP, Crypto and RAM, then the
 * Options key. In a boss room the boss bar takes Crypto's place. The row is
 * the shared PhoneHud, so its text stays at 12px or more and its changes are
 * read out politely.
 */
export function LabyrinthPhoneHud({
  optionsButtonRef,
  optionsOpen,
  onOptions,
}: LabyrinthPhoneHudProps) {
  const { session } = useLabyrinthSession();
  const {
    gameMode,
    stage,
    roomIndex,
    playerHp,
    currentRam,
    maxRam,
    cryptoBounty,
    boss,
  } = session.view;
  const roguelike = gameMode === "roguelike";
  const bossRoom = roguelike && !!boss;

  const chips: PhoneHudChip[] = [
    {
      id: "room",
      label: roguelike ? "Room" : "Subnet",
      value: roguelike ? String(roomIndex + 1).padStart(2, "0") : `0${stage}`,
      testId: "labyrinth-phone-floor",
    },
    { id: "hp", label: "HP", value: playerHp, testId: "labyrinth-phone-hp" },
    bossRoom
      ? {
          id: "boss",
          label: "Boss",
          value: boss.defeated ? "DOWN" : boss.hp,
          accent: true,
          testId: "labyrinth-phone-boss",
        }
      : {
          id: "crypto",
          label: "Crypto",
          value: cryptoBounty,
          testId: "labyrinth-phone-crypto",
        },
    {
      id: "ram",
      label: "RAM",
      value: `${currentRam}/${maxRam}`,
      testId: "labyrinth-phone-ram",
    },
  ];

  return (
    <PhoneHud
      label="Room status"
      chips={chips}
      action={
        <button
          ref={optionsButtonRef}
          type="button"
          onClick={onOptions}
          aria-expanded={optionsOpen}
          aria-controls="labyrinth-options-sheet"
          className="my-auto ml-1 h-11 shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs font-bold text-zinc-200 touch-manipulation active:scale-[0.98]"
        >
          Options
        </button>
      }
    />
  );
}
