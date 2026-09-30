"use client";

import React from "react";
import { PanInfo } from "framer-motion";
import { TacticDef, TacticId } from "@/lib/quasi-perfect/types";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
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
  // At 0 GB the simulated tactic session has stopped: no card is playable,
  // sorry included, until the level is reset.
  const isPlayable = (item: TacticId | HandItem): boolean => {
    const tacticId = typeof item === "string" ? item : item.id;
    const tactic: TacticDef = tacticDefs[tacticId] || tacticDefs.rfl;
    return (
      !isProofComplete && currentRam > 0 && currentRam >= tactic.baseRamCost
    );
  };
  const playableCount = availableTactics.filter(isPlayable).length;
  const counterText =
    playableCount === availableTactics.length
      ? `${availableTactics.length} cards available`
      : `${availableTactics.length} cards, ${playableCount} playable`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
          Tactic Hand (Available Cards)
        </span>
        <span className="text-[10px] text-zinc-400 font-mono">
          {counterText}
        </span>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {availableTactics.map((item, idx) => {
          const tacticId = typeof item === "string" ? item : item.id;
          const hypothesisTarget =
            typeof item === "object" ? item.hypothesis : undefined;
          const labelOverride =
            typeof item === "object" ? item.labelOverride : undefined;
          const tactic: TacticDef = tacticDefs[tacticId] || tacticDefs.rfl;

          const isDisabled = !isPlayable(item);

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
