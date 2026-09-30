"use client";

import React, { useCallback } from "react";
import { GameMode, PuzzlerLevelDef } from "@/lib/quasi-perfect/types";
import { describeModeRules } from "@/lib/quasi-perfect/ram";
import { ModalContainer } from "@/components/ui/ModalContainer";
import {
  IconSparkles,
  IconBook,
  IconCpu,
  IconShieldCheck,
  IconTarget,
  IconX,
} from "@tabler/icons-react";

interface TheoryBriefingModalProps {
  level: PuzzlerLevelDef;
  gameMode: GameMode;
  isOpen: boolean;
  onClose: () => void;
  onToggleMode: (mode: GameMode) => void;
}

export const TheoryBriefingModal: React.FC<TheoryBriefingModalProps> = ({
  level,
  gameMode,
  isOpen,
  onClose,
  onToggleMode,
}) => {
  const modeRules = describeModeRules(gameMode, level);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const concept = level.educationalConcept;

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      titleId="briefing-title"
      maxWidth="max-w-2xl"
      className="border-brand-cyan/40 bg-zinc-950 p-6 font-mono text-zinc-200 shadow-[0_0_50px_-10px_rgba(6,182,212,0.3)] animate-in fade-in duration-200"
    >
      {/* Close Button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close theory briefing"
        className="absolute top-4 right-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        <IconX className="w-5 h-5" />
      </button>

      {/* Header Badges & Title */}
      <div className="border-b border-zinc-800 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-brand-cyan/10 border border-brand-cyan/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-cyan">
            Chapter {level.chapter} · {level.chapterTitle}
          </span>
          <span className="text-zinc-400">/</span>
          <span className="text-[11px] font-bold text-zinc-400">
            {level.subtitle}
          </span>
        </div>
        <h3
          id="briefing-title"
          className="mt-2 text-xl font-extrabold text-zinc-100 flex items-center gap-2"
        >
          <IconSparkles className="w-5 h-5 text-brand-cyan" />
          <span>{concept.title}</span>
        </h3>
        <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
          {level.description}
        </p>
      </div>

      {/* Game Mode Selector in Briefing */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
        <div>
          <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
            <IconCpu className="w-4 h-4 text-brand-cyan" />
            <span>Current Simulation Mode</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            <span data-testid="briefing-mode-rules">
              {modeRules.heading} {modeRules.budget} {modeRules.failure}{" "}
              {modeRules.exhaustion} {modeRules.scoring}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => onToggleMode("story")}
            className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
              gameMode === "story"
                ? "bg-brand-cyan text-black"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Story Mode
          </button>
          <button
            type="button"
            onClick={() => onToggleMode("hacker")}
            className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
              gameMode === "hacker"
                ? "bg-amber-400 text-black font-extrabold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Hacker Mode
          </button>
        </div>
      </div>

      {/* Main Educational Sections */}
      <div className="mt-4 space-y-4 text-xs">
        {/* 1. Mathematical Intuition */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-brand-cyan flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
              <IconBook className="w-4 h-4" />
              <span>1. Mathematical Intuition</span>
            </span>
            {concept.mathNotation && (
              <span className="rounded bg-black/60 border border-brand-cyan/30 px-2 py-0.5 text-xs text-amber-300 font-semibold">
                {concept.mathNotation}
              </span>
            )}
          </div>
          <p className="text-zinc-300 leading-relaxed">
            {concept.mathIntuition || concept.summary}
          </p>
        </div>

        {/* 2. Formal Methods & Lean 4 Analogy */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-400 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
              <IconShieldCheck className="w-4 h-4" />
              <span>2. Formal Proof Assistant Analogy (Lean 4)</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {level.leanTheoremName}
            </span>
          </div>
          <p className="text-zinc-300 leading-relaxed">
            {concept.leanAnalogy ||
              "A Lean 4 proof assistant checks proof terms with its kernel; this playable transformation is only simulated here."}
          </p>
          <p className="text-zinc-400 text-xs">
            This playable level runs in a local TypeScript simulator; it does
            not invoke Lean.
          </p>
          <div className="bg-zinc-950/80 rounded-lg p-2 font-mono text-[11px] text-purple-300 border border-purple-500/20">
            <code>
              theorem {level.leanTheoremName} {level.leanTypeSignature}
            </code>
          </div>
        </div>

        {/* 3. Tactical Objective */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2">
          <span className="font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
            <IconTarget className="w-4 h-4" />
            <span>3. Your Mission &amp; Tactical Objective</span>
          </span>
          <p className="text-zinc-200 leading-relaxed font-semibold">
            {concept.tacticalObjective ||
              "Apply available tactics to transform the goal syntax tree to True."}
          </p>
          <div className="text-[11px] text-zinc-400 pt-1 border-t border-emerald-500/20">
            <strong className="text-zinc-300">Real-World Impact:</strong>{" "}
            {concept.realWorldApplication}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
        <div className="text-[11px] text-zinc-400">
          Press{" "}
          <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
            B
          </kbd>{" "}
          or{" "}
          <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
            Esc
          </kbd>{" "}
          anytime to reopen/close this briefing.
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-xl bg-brand-cyan px-5 py-2 text-xs font-bold text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:bg-cyan-400 transition-all font-extrabold"
        >
          <span>Start Proving</span>
          <span>→</span>
        </button>
      </div>
    </ModalContainer>
  );
};
