"use client";

import React, { useSyncExternalStore } from "react";
import { PanInfo } from "framer-motion";
import { TacticDef, TacticId } from "@/lib/quasi-perfect/types";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
import { getTacticBlock } from "@/lib/quasi-perfect/ram";
import { TacticCard } from "./TacticCard";
import { fanPose } from "./boardArt";
import { useCabinetTouch } from "@/components/arcade/mobile";

interface HandItem {
  id: TacticId;
  hypothesis?: string;
  labelOverride?: string;
}

interface TacticHandProps {
  availableTactics: (TacticId | HandItem)[];
  /** A tactic the active variant bans (#2090); its card stays, marked Banned. */
  bannedTacticId?: TacticId;
  currentRam: number;
  selectedTacticIndex: number | null;
  onSelectTactic: (index: number) => void;
  onCardDragStart: (index: number) => void;
  onCardDragEnd: (
    index: number,
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => void;
  isProofComplete?: boolean;
}

/** Hands up to this size are fanned; larger ones (the sandbox deck) wrap. */
const MAX_FANNED_CARDS = 8;
// Below this width a fan of seven or eight full cards is wider than the
// docked hand, so it uses the compact card (#2249).
const NARROW_HAND_QUERY = "(max-width: 1179px)";
const CROWDED_HAND_CARDS = 7;

function subscribeNarrowHand(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(NARROW_HAND_QUERY);
  media.addEventListener?.("change", onChange);
  return () => media.removeEventListener?.("change", onChange);
}

function isNarrowHand() {
  return typeof window !== "undefined" && !!window.matchMedia
    ? window.matchMedia(NARROW_HAND_QUERY).matches
    : false;
}

export const TacticHand: React.FC<TacticHandProps> = ({
  availableTactics,
  bannedTacticId,
  currentRam,
  selectedTacticIndex,
  onSelectTactic,
  onCardDragStart,
  onCardDragEnd,
  isProofComplete = false,
}) => {
  const cards = availableTactics.map((item) => {
    const tacticId = typeof item === "string" ? item : item.id;
    const tactic: TacticDef = tacticDefs[tacticId] || tacticDefs.rfl;
    // The same rule the puzzler enforces: at 0 GB nothing is playable, not
    // even sorry (#1651).
    const isBanned =
      bannedTacticId !== undefined && tacticId === bannedTacticId;
    const isDisabled =
      isProofComplete ||
      isBanned ||
      getTacticBlock(tactic, currentRam) !== null;
    return { item, tacticId, tactic, isDisabled, isBanned };
  });
  const playableCount = cards.filter((card) => !card.isDisabled).length;
  const fanned = cards.length <= MAX_FANNED_CARDS;
  const narrow = useSyncExternalStore(
    subscribeNarrowHand,
    isNarrowHand,
    () => false
  );
  const compactCards =
    !fanned || (narrow && cards.length >= CROWDED_HAND_CARDS);
  // Desktop players click, or Shift+Tab back to the tree; touch players tap
  // (#2249).
  const touch = useCabinetTouch();

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
          Tactic Hand
        </span>
        <span className="flex items-center gap-3 text-[11px] font-mono">
          {selectedTacticIndex !== null && (
            <span className="qp-text-accent-strong font-bold uppercase tracking-wider">
              {touch
                ? "Card Active · Tap Target Node"
                : "Card Active · Click a Target Node or Shift+Tab to the Tree"}
            </span>
          )}
          <span data-testid="tactic-hand-count" className="text-zinc-400">
            {cards.length} cards, {playableCount} playable
          </span>
        </span>
      </div>

      <div
        role="group"
        aria-label="Tactic hand"
        className={
          fanned
            ? "flex items-end justify-center px-2 pt-4 pb-2 [@media(max-height:820px)]:pt-1"
            : "flex flex-wrap items-end justify-center gap-2 pt-4 pb-2 [@media(max-height:820px)]:pt-1"
        }
      >
        {cards.map(({ item, tacticId, tactic, isDisabled, isBanned }, idx) => {
          const hypothesisTarget =
            typeof item === "object" ? item.hypothesis : undefined;
          const labelOverride =
            typeof item === "object" ? item.labelOverride : undefined;
          const pose = fanned
            ? fanPose(idx, cards.length)
            : { rotate: 0, translateY: 0 };
          const isSelected = selectedTacticIndex === idx;

          return (
            <div
              key={`${tacticId}-${idx}`}
              className={`relative ${fanned && idx > 0 ? "-ml-1.5" : ""}`}
              style={{
                transform: `translateY(${pose.translateY}px) rotate(${pose.rotate}deg)`,
                transformOrigin: "50% 120%",
                zIndex: isSelected ? 20 : undefined,
              }}
            >
              <div
                className="qp-card-lift"
                data-selected={isSelected ? "true" : undefined}
              >
                <TacticCard
                  tactic={tactic}
                  labelOverride={labelOverride}
                  hypothesisTarget={hypothesisTarget}
                  isSelected={isSelected}
                  disabled={isDisabled}
                  banned={isBanned}
                  compact={compactCards}
                  onSelect={() => onSelectTactic(idx)}
                  onDragStart={() => onCardDragStart(idx)}
                  onDragEnd={(e, info) => onCardDragEnd(idx, e, info)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
