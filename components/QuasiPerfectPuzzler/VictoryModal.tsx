"use client";

import React from "react";
import { motion } from "framer-motion";
import { CopyButton } from "@/components/ui/CopyButton";
import { LevelScore, PuzzlerLevelDef } from "@/lib/quasi-perfect/types";
import type { PuzzlerVariantDef } from "@/lib/quasi-perfect";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useCabinetTouch } from "@/components/arcade/mobile";
import { IconCheck, IconCopy, IconSparkles } from "@tabler/icons-react";

interface VictoryModalProps {
  score: LevelScore;
  /** Best saved result for this level; may differ from the run just finished. */
  savedBest?: LevelScore;
  level: PuzzlerLevelDef;
  totalLevels: number;
  currentLevelIndex: number;
  leanCode?: string;
  /** Simulated RAM this run spent, in GB; mode-independent, like the star targets. */
  ramUsed?: number;
  /** The level's step par in tactics, or null when it has none (#2059). */
  par?: number | null;
  /** Best stars saved across every level, for the campaign-complete card. */
  campaignStars?: { earned: number; possible: number; proven: number };
  onNextLevel: () => void;
  onRestartLevel: () => void;
  /** Starts the campaign again from the first level. */
  onRestartCampaign?: () => void;
  /** Hides the modal so the finished proof board can be read (Escape). */
  onDismiss?: () => void;
  /** The variant this run was played under, or null for the base level (#2090). */
  variant?: PuzzlerVariantDef | null;
  /** Whether the run cleared that variant. */
  variantCleared?: boolean;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  score,
  savedBest,
  level,
  totalLevels,
  currentLevelIndex,
  leanCode,
  ramUsed,
  par = null,
  campaignStars,
  onNextLevel,
  onRestartLevel,
  onRestartCampaign,
  onDismiss,
  variant = null,
  variantCleared = false,
}) => {
  const isLastLevel = currentLevelIndex >= totalLevels - 1;
  const isSorry = score.usedSorry;
  // First focus lands on the main action, not the Copy button (#1939).
  const primaryRef = React.useRef<HTMLButtonElement | null>(null);
  const modalRef = useFocusTrap<HTMLDivElement>(true, {
    returnFocus: true,
    initialFocusRef: primaryRef,
  });
  // On the touch cabinet the card is at most the screen tall and scrolls, so
  // an iPad mini in landscape still reaches every action (#2042).
  const inCabinet = useCabinetTouch();
  const campaignDone = !!campaignStars && campaignStars.proven >= totalLevels;
  // RAM budgets per star, stated as RAM spent so they read the same in Story
  // and Hacker modes (computeLevelStars compares the hacker equivalent).
  const goldBudget = Math.max(0, level.initialRam - level.goldRamTarget);
  const silverBudget = Math.max(0, level.initialRam - level.silverRamTarget);
  const shownStars = isSorry ? 0 : score.stars;
  const runGolfed = !isSorry && score.golfed === true;
  const steps = score.steps;

  return (
    <motion.div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={isSorry ? "Goal admitted via sorry" : `${level.title} solved`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDismiss?.();
        }
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
    >
      <div
        className={`max-w-md w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-6 text-center shadow-2xl font-mono${inCabinet ? " max-h-[calc(100dvh-2rem)] overflow-y-auto" : ""}`}
      >
        {/* Title Badge */}
        {isSorry ? (
          <div className="arcade-result-stamp inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold mb-3">
            ⚠️ MATHEMATICAL MORALITY VIOLATION
          </div>
        ) : (
          <div className="arcade-result-stamp inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold mb-3">
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

        <p
          data-testid="victory-run-label"
          className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400"
        >
          This run
        </p>

        {variant && (
          <div
            data-testid="victory-variant"
            className={`my-4 rounded-xl border p-3 text-left text-xs ${
              variantCleared
                ? "border-emerald-500/40 bg-emerald-500/10 text-zinc-200"
                : "border-rose-500/40 bg-rose-500/10 text-zinc-200"
            }`}
          >
            <p
              className={`font-bold ${variantCleared ? "text-emerald-300" : "text-rose-300"}`}
            >
              {variantCleared
                ? `Variant cleared: ${variant.title}`
                : `Variant not cleared: ${variant.title}`}
            </p>
            <p className="mt-1 text-zinc-300">{variant.rule}</p>
            <p className="mt-1 text-zinc-400">
              {steps !== undefined &&
                `${steps} tactic${steps === 1 ? "" : "s"} applied. `}
              {variantCleared
                ? "Saved on the level map. The base level's stars are unchanged."
                : "A proof with sorry does not clear a variant."}
            </p>
          </div>
        )}

        {!variant && (
          <>
            {/* Stars Display */}
            <div
              role="img"
              aria-label={`${shownStars} of 3 stars`}
              data-testid="victory-stars"
              className="my-4 flex justify-center items-center gap-3"
            >
              {[1, 2, 3].map((starIdx) => (
                <span
                  key={starIdx}
                  aria-hidden="true"
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

            {!isSorry && (
              <p
                data-testid="victory-star-targets"
                className="-mt-2 mb-4 text-[11px] text-zinc-400"
              >
                {ramUsed !== undefined && `You used ${ramUsed.toFixed(1)} GB. `}
                Gold: use {goldBudget} GB or less. Silver: {silverBudget} GB or
                less.
              </p>
            )}

            {!isSorry && par !== null && (
              <div
                data-testid="victory-par"
                className="-mt-2 mb-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-400"
              >
                <span className="tabular-nums">
                  {steps !== undefined &&
                    `${steps} tactic${steps === 1 ? "" : "s"} applied. `}
                  Par {par} tactic{par === 1 ? "" : "s"}.
                </span>
                {runGolfed ? (
                  <span
                    data-testid="victory-golfed"
                    className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
                  >
                    GOLFED · at or under par
                  </span>
                ) : (
                  <span className="text-zinc-400">
                    Prove it in {par} or fewer for the Golfed badge.
                  </span>
                )}
              </div>
            )}

            {isLastLevel && !isSorry && campaignStars && (
              <div
                data-testid="victory-campaign-complete"
                className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-left text-xs text-zinc-200"
              >
                <p className="font-bold text-amber-300">
                  {campaignDone ? "Campaign complete" : "Final level cleared"}
                </p>
                <p className="mt-1 text-zinc-300">
                  {campaignStars.proven} of {totalLevels} levels proven
                  honestly, {campaignStars.earned} of {campaignStars.possible}{" "}
                  stars.{" "}
                  {campaignDone
                    ? "Replay any level from the map to chase gold."
                    : "Open the level map to prove the levels still unsolved."}
                </p>
              </div>
            )}
          </>
        )}

        {/* Score & Memory Breakdown */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs mb-4">
          <div className="flex flex-col">
            <span className="text-zinc-400">Remaining RAM</span>
            <span className="font-bold qp-text-accent-strong text-sm">
              {score.remainingRam.toFixed(1)} GB
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-zinc-400">Mathematical Morality</span>
            <span
              className={`font-bold text-sm ${
                isSorry ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {score.morality > 0 ? `+${score.morality}` : score.morality}
            </span>
          </div>
        </div>

        {savedBest && savedBest.completed && !savedBest.usedSorry && (
          <p
            data-testid="victory-saved-best"
            className="mb-4 text-[11px] text-zinc-400"
          >
            Saved best: {savedBest.stars} of 3 stars,{" "}
            {savedBest.remainingRam.toFixed(1)} GB remaining
            {savedBest.golfed === true ? ", Golfed" : ""}
            {isSorry ? " (this run did not replace it)" : ""}
          </p>
        )}

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
                className="flex items-center gap-1 qp-text-accent-strong hover:text-zinc-100 font-bold cursor-pointer"
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
            ref={isSorry ? primaryRef : undefined}
            type="button"
            onClick={onRestartLevel}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-bold text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500 transition-colors"
          >
            {isSorry
              ? "Try Honest Proof"
              : variant
                ? "Replay Variant"
                : "Replay Level"}
          </button>

          {isLastLevel ? (
            onRestartCampaign && (
              <button
                ref={isSorry ? undefined : primaryRef}
                type="button"
                onClick={onRestartCampaign}
                className="qp-btn-primary qp-focus flex-1 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors"
              >
                Back to Level 1
              </button>
            )
          ) : (
            <button
              ref={isSorry ? undefined : primaryRef}
              type="button"
              onClick={onNextLevel}
              className="qp-btn-primary qp-focus flex-1 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors"
            >
              Next Level →
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
