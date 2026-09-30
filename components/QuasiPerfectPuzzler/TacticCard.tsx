"use client";

import React from "react";
import { motion, PanInfo } from "framer-motion";
import { TacticDef } from "@/lib/quasi-perfect/types";

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
}

export const TacticCard: React.FC<TacticCardProps> = ({
  tactic,
  labelOverride,
  hypothesisTarget,
  isSelected,
  disabled,
  onSelect,
  onDragStart,
  onDragEnd,
}) => {
  const isSorry = tactic.id === "sorry";
  const displayLabel = labelOverride || tactic.label || tactic.name;

  return (
    <motion.div
      drag={!disabled}
      dragSnapToOrigin={true}
      whileDrag={{ scale: 1.08, zIndex: 50, cursor: "grabbing" }}
      whileHover={!disabled ? { scale: 1.04, y: -2 } : {}}
      whileTap={!disabled ? { scale: 0.96 } : {}}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-tactic-id={tactic.id}
      data-tactic-arg={hypothesisTarget}
      className={`relative cursor-grab active:cursor-grabbing rounded-xl border p-3 font-mono transition-colors duration-150 select-none ${
        disabled
          ? "border-zinc-800/60 bg-zinc-950/40 opacity-40 cursor-not-allowed"
          : isSorry
            ? "border-rose-500/40 bg-rose-950/30 text-rose-300 hover:border-rose-500/70 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]"
            : isSelected
              ? "border-brand-cyan bg-cyan-950/50 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-2 ring-brand-cyan"
              : "border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:border-brand-cyan/60 hover:bg-zinc-850"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onSelect();
      }}
      role="button"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`Tactic ${displayLabel}. Costs ${tactic.baseRamCost} GB RAM. ${tactic.description}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2">
        <span
          className={`text-xs sm:text-sm font-bold tracking-tight break-words min-w-0 max-w-full ${
            isSorry
              ? "text-rose-400"
              : isSelected
                ? "text-brand-cyan"
                : "text-zinc-100"
          }`}
        >
          {displayLabel}
        </span>

        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            isSorry
              ? "bg-rose-500/20 text-rose-300"
              : tactic.baseRamCost >= 6
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
          }`}
        >
          {tactic.baseRamCost} GB
        </span>
      </div>

      <p className="mt-1.5 text-[10px] sm:text-[11px] leading-tight text-zinc-400 break-words line-clamp-2">
        {tactic.description}
      </p>

      {isSelected && (
        <div className="mt-2 text-[9px] uppercase tracking-wider text-brand-cyan font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-ping" />
          Card Active · Tap Target Node
        </div>
      )}
    </motion.div>
  );
};
