"use client";

import React from "react";
import { motion } from "framer-motion";
import { CopyButton } from "@/components/ui/CopyButton";
import { LevelScore, PuzzlerLevelDef } from "@/lib/quasi-perfect/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { IconCheck, IconCopy, IconSparkles } from "@tabler/icons-react";

interface VictoryModalProps {
  score: LevelScore;
  level: PuzzlerLevelDef;
  totalLevels: number;
  currentLevelIndex: number;
  leanCode?: string;
  onNextLevel: () => void;
  onRestartLevel: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  score,
  level,
  totalLevels,
  currentLevelIndex,
  leanCode,
  onNextLevel,
  onRestartLevel,
}) => {
  const isLastLevel = currentLevelIndex >= totalLevels - 1;
  const isSorry = score.usedSorry;
  const modalRef = useFocusTrap<HTMLDivElement>(true, {
    returnFocus: true,
  });

  return (
    <motion.div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
    >
      <div className="max-w-md w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-6 text-center shadow-2xl font-mono">
        {/* Title Badge */}
        {isSorry ? (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold mb-3">
            ⚠️ MATHEMATICAL MORALITY VIOLATION
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold mb-3">
            <IconSparkles className="w-3.5 h-3.5" />
            <span>AST GOAL DISCHARGED · SIMULATED</span>
          </div>
        )}

        <h3 className="text-xl font-extrabold text-white tracking-tight">
          {isSorry ? "GOAL ADMITTED VIA SORRY" : level.title}
        </h3>
        <p className="text-[11px] text-zinc-400 font-semibold mt-0.5">
          Chapter {level.chapter}: {level.chapterTitle}
        </p>

        <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
          {isSorry
            ? "The local simulator admitted this goal using 'sorry'. No Lean kernel check was run, and your score was penalized."
            : "The local AST goal was discharged without exhausting simulated RAM. The generated Lean text has not been compiled or kernel-checked."}
        </p>

        {/* Stars Display */}
        <div className="my-4 flex justify-center items-center gap-3">
          {[1, 2, 3].map((starIdx) => (
            <span
              key={starIdx}
              className={`text-3xl ${
                !isSorry && starIdx <= score.stars
                  ? "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                  : "text-zinc-700"
              }`}
            >
              ★
            </span>
          ))}
        </div>

        {/* Score & Memory Breakdown */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs mb-4">
          <div className="flex flex-col">
            <span className="text-zinc-500">Remaining RAM</span>
            <span className="font-bold text-brand-cyan text-sm">
              {score.remainingRam.toFixed(1)} GB
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-zinc-500">Mathematical Morality</span>
            <span
              className={`font-bold text-sm ${
                isSorry ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {score.morality > 0 ? `+${score.morality}` : score.morality}
            </span>
          </div>
        </div>

        {/* Lean 4 Code Preview Snippet */}
        {leanCode && !isSorry && (
          <div className="mb-4 text-left rounded-xl border border-zinc-800 bg-zinc-900/80 p-2.5">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1 border-b border-zinc-800 pb-1">
              <span>Generated Lean 4 Text · Not Compiled</span>
              <CopyButton
                text={leanCode}
                label="Copy"
                copiedLabel="Copied!"
                icon={<IconCopy className="w-3 h-3" />}
                copiedIcon={<IconCheck className="w-3 h-3 text-emerald-400" />}
                className="flex items-center gap-1 text-purple-400 hover:text-purple-300 font-bold cursor-pointer"
                aria-label="Copy Lean 4 Script"
                successMessage="Generated Lean text copied to clipboard"
              />
            </div>
            <pre className="text-[10px] text-zinc-300 font-mono whitespace-pre overflow-x-auto max-h-24">
              {leanCode}
            </pre>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRestartLevel}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-bold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500 transition-colors"
          >
            {isSorry ? "Try Honest Proof" : "Replay Level"}
          </button>

          {!isLastLevel && (
            <button
              type="button"
              onClick={onNextLevel}
              className="flex-1 rounded-xl bg-brand-cyan px-4 py-2.5 text-xs font-bold text-black hover:bg-cyan-300 transition-colors shadow-[0_0_15px_rgba(6,182,212,0.4)]"
            >
              Next Level →
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
