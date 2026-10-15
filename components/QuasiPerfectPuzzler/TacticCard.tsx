"use client";

import React from "react";
import { motion, PanInfo } from "framer-motion";
import { TacticDef } from "@/lib/quasi-perfect/types";
import { tacticCardArt } from "./boardArt";

interface TacticCardProps {
  tactic: TacticDef;
  labelOverride?: string;
  hypothesisTarget?: string;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDragStart?: () => void;
  onDragEnd?: (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => void;
  /** Smaller card for wide hands such as the sandbox's full deck. */
  compact?: boolean;
  /** Banned by the active variant (#2090): shown with a text stamp. */
  banned?: boolean;
}

const RARITY_LABEL = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  cursed: "Cursed",
} as const;

/**
 * A tactic as a playing card: a rarity edge along the top, the glyph and
 * RAM cost in the corner, a large glyph in the middle, the tactic's name and
 * a one-line description. It can be tapped or dragged onto a board node.
 */
export const TacticCard: React.FC<TacticCardProps> = ({
  tactic,
  labelOverride,
  hypothesisTarget,
  isSelected,
  disabled,
  onSelect,
  onDragStart,
  onDragEnd,
  compact = false,
  banned = false,
}) => {
  const displayLabel = labelOverride || tactic.label || tactic.name;
  const art = tacticCardArt(tactic.id, tactic.baseRamCost);

  return (
    <motion.div
      drag={!disabled}
      dragSnapToOrigin={true}
      whileDrag={{ scale: 1.08, zIndex: 50, cursor: "grabbing" }}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-tactic-id={tactic.id}
      data-tactic-arg={hypothesisTarget}
      data-rarity={art.rarity}
      data-banned={banned ? "true" : undefined}
      data-selected={isSelected ? "true" : undefined}
      className={`qp-card qp-focus relative flex flex-col overflow-hidden rounded-xl font-mono select-none shadow-[0_10px_24px_-14px_rgba(0,0,0,0.9)] ${
        compact ? "h-[128px] w-[96px]" : "h-[140px] w-[108px]"
      } ${
        banned
          ? "grayscale cursor-not-allowed"
          : disabled
            ? "opacity-45 grayscale cursor-not-allowed"
            : "cursor-grab active:cursor-grabbing"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onSelect();
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`Tactic ${displayLabel}.${banned ? " Banned in this variant." : ""} Costs ${tactic.baseRamCost} GB RAM. ${tactic.description}`}
    >
      {banned && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 -rotate-12 border-y border-rose-400 bg-zinc-950/90 py-0.5 text-center text-[11px] font-bold uppercase tracking-widest text-rose-200"
        >
          Banned
        </span>
      )}
      {/* Rarity edge */}
      <span aria-hidden="true" className="qp-card-edge h-1 w-full shrink-0" />

      {/* Corner index: glyph and RAM cost */}
      <div
        aria-hidden="true"
        className="flex items-start justify-between px-2 pt-1.5"
      >
        <span className="qp-card-glyph qp-math text-sm leading-none">
          {art.glyph}
        </span>
        <span className="text-[13px] font-bold leading-none tabular-nums text-zinc-100">
          {tactic.baseRamCost}
          <span className="text-[9px] font-bold tracking-wider text-zinc-400">
            {" GB"}
          </span>
        </span>
      </div>

      {/* Face */}
      <div
        aria-hidden="true"
        className={`qp-card-glyph qp-math flex flex-1 items-center justify-center leading-none ${
          compact ? "text-3xl" : "text-4xl"
        }`}
      >
        {art.glyph}
      </div>

      <div className="px-2 pb-2">
        <span
          // Long names such as trans [succ_le_double] wrap to two lines
          // instead of being cut off (#2249).
          className={`block min-w-0 line-clamp-2 break-words text-center font-bold leading-tight tracking-tight ${
            displayLabel.length > 12 ? "text-[10px]" : "text-xs"
          } ${art.rarity === "cursed" ? "text-rose-300" : "text-zinc-100"}`}
          title={displayLabel}
        >
          {displayLabel}
        </span>
        <p
          className={`mt-0.5 text-center text-[9px] leading-tight text-zinc-400 break-words ${
            compact ? "line-clamp-1" : "line-clamp-2"
          }`}
        >
          {tactic.description}
        </p>
        {/* Cost pips and rarity */}
        <div
          aria-hidden="true"
          className="mt-1 flex items-center justify-center gap-1"
          title={`${RARITY_LABEL[art.rarity]} card`}
        >
          {[1, 2, 3].map((pip) => (
            <span
              key={pip}
              data-on={pip <= art.pips ? "true" : "false"}
              className="qp-pip h-1.5 w-1.5 rounded-full"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};
