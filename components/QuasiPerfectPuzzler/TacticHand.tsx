"use client";

import React from "react";
import { PanInfo } from "framer-motion";
import { TacticDef, TacticId } from "@/lib/quasi-perfect/types";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
import { getTacticBlock } from "@/lib/quasi-perfect/ram";
import { TacticCard } from "./TacticCard";
import { fanPose } from "./boardArt";

interface HandItem {
  id: TacticId;
  hypothesis?: string;
  labelOverride?: string;
}

interface TacticHandProps {
  availableTactics: (TacticId | HandItem)[];
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

export const TacticHand: React.FC<TacticHandProps> = ({
  availableTactics,
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
    const isDisabled =
      isProofComplete || getTacticBlock(tactic, currentRam) !== null;
    return { item, tacticId, tactic, isDisabled };
  });
  const playableCount = cards.filter((card) => !card.isDisabled).length;
  const fanned = cards.length <= MAX_FANNED_CARDS;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
          Tactic Hand
        </span>
        <span className="flex items-center gap-3 text-[11px] font-mono">
          {selectedTacticIndex !== null && (
            <span className="qp-text-accent-strong font-bold uppercase tracking-wider">
              Card Active · Tap Target Node
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
            ? "flex items-end justify-center px-2 pt-4 pb-2"
            : "flex flex-wrap items-end justify-center gap-2 pt-4 pb-2"
        }
      >
        {cards.map(({ item, tacticId, tactic, isDisabled }, idx) => {
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
                  compact={!fanned}
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
