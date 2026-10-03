"use client";

import React, { useState } from "react";
import {
  IconBulb,
  IconChevronRight,
  IconLock,
  IconSparkles,
} from "@tabler/icons-react";

interface HintSystemProps {
  hints: [string, string, string];
  onTierChange?: (tier: number) => void;
  onClose?: () => void;
}

export const HintSystem: React.FC<HintSystemProps> = ({
  hints,
  onTierChange,
}) => {
  const [unlockedTier, setUnlockedTier] = useState<number>(1);

  const handleUnlockNext = () => {
    setUnlockedTier((prev) => {
      const nextTier = prev + 1;
      onTierChange?.(nextTier);
      return nextTier;
    });
  };

  const tierLabels = [
    {
      tier: 1,
      title: "Tier 1 · Strategy Clue",
      color: "qp-text-accent-strong",
    },
    {
      tier: 2,
      title: "Tier 2 · Subtree Target Focus",
      color: "text-amber-400",
    },
    {
      tier: 3,
      title: "Tier 3 · Recommended Tactic",
      color: "qp-text-accent-strong",
    },
  ];

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 font-mono">
      <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
          <IconBulb className="w-4 h-4 text-amber-400" />
          <span>Interactive Proof Coach · Progressive Hints</span>
        </div>
        <span className="text-[10px] text-zinc-400">
          Tier {unlockedTier} of 3 Unlocked
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        {tierLabels.map((tierInfo, idx) => {
          const isUnlocked = unlockedTier >= tierInfo.tier;
          const hintText =
            hints[idx] || "Think about the foundational logic rules.";

          return (
            <div
              key={tierInfo.tier}
              className={`rounded-xl border p-3 transition-all ${
                isUnlocked
                  ? "border-zinc-800 bg-zinc-900/80"
                  : "border-zinc-850 bg-zinc-950/40 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-bold ${tierInfo.color} flex items-center gap-1.5`}
                >
                  {isUnlocked ? (
                    <IconSparkles className="w-3.5 h-3.5" />
                  ) : (
                    <IconLock className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  {tierInfo.title}
                </span>
                {!isUnlocked && idx === unlockedTier && (
                  <button
                    type="button"
                    onClick={handleUnlockNext}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all"
                  >
                    <span>Reveal Next Hint</span>
                    <IconChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {isUnlocked ? (
                <p className="mt-1.5 text-xs text-zinc-300 leading-relaxed">
                  {hintText}
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-zinc-400 italic">
                  Unlock this tier to reveal deeper mathematical guidance.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
