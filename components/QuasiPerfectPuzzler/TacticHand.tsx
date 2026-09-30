"use client";

import React from "react";
import { PanInfo } from "framer-motion";
import { TacticDef, TacticId } from "@/lib/quasi-perfect/types";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
import { getTacticBlock } from "@/lib/quasi-perfect/ram";
import { TacticCard } from "./TacticCard";

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

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
          Tactic Hand (Available Cards)
        </span>
        <span
          data-testid="tactic-hand-count"
          className="text-[10px] text-zinc-400 font-mono"
        >
          {cards.length} cards, {playableCount} playable
        </span>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {cards.map(({ item, tacticId, tactic, isDisabled }, idx) => {
          const hypothesisTarget =
            typeof item === "object" ? item.hypothesis : undefined;
          const labelOverride =
            typeof item === "object" ? item.labelOverride : undefined;

          return (
            <TacticCard
              key={`${tacticId}-${idx}`}
              tactic={tactic}
              labelOverride={labelOverride}
              hypothesisTarget={hypothesisTarget}
              isSelected={selectedTacticIndex === idx}
              disabled={isDisabled}
              onSelect={() => onSelectTactic(idx)}
              onDragStart={() => onCardDragStart(idx)}
              onDragEnd={(e, info) => onCardDragEnd(idx, e, info)}
            />
          );
        })}
      </div>
    </div>
  );
};
