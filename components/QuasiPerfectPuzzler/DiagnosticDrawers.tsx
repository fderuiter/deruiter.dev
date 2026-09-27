"use client";

import React, { useState } from "react";
import {
  CompilerLogEntry,
  LeanProofStep,
  PuzzlerLevelDef,
} from "@/lib/quasi-perfect/types";
import { LeanIdeInspector } from "./LeanIdeInspector";
import { TerminalLog } from "./TerminalLog";
import {
  IconChevronDown,
  IconChevronUp,
  IconCode,
  IconTerminal2,
} from "@tabler/icons-react";

interface DiagnosticDrawersProps {
  level: PuzzlerLevelDef;
  proofSteps: LeanProofStep[];
  isComplete: boolean;
  logs: CompilerLogEntry[];
  isLeanInspectorOpen: boolean;
  onToggleLeanInspector: () => void;
  currentLevelIndex?: number;
}

export const DiagnosticDrawers: React.FC<DiagnosticDrawersProps> = ({
  level,
  proofSteps,
  isComplete,
  logs,
  isLeanInspectorOpen,
  onToggleLeanInspector,
}) => {
  const hasAdmittedStep = proofSteps.some((step) => step.tacticId === "sorry");
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return false;
    }
    return true;
  });

  return (
    <div
      className="w-full space-y-3 font-mono"
      data-testid="diagnostic-drawers"
    >
      {/* 1. Accordion Drawer: Lean IDE Inspector */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-md transition-all">
        <button
          type="button"
          onClick={onToggleLeanInspector}
          aria-expanded={isLeanInspectorOpen}
          aria-controls="lean-ide-drawer-content"
          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/90 hover:bg-zinc-850 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <IconCode className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-zinc-100">
              Generated Lean 4 Text &amp; Simulator Inspector
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isComplete
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-purple-500/20 text-purple-300 border-purple-500/30"
              }`}
            >
              {hasAdmittedStep
                ? "Goal admitted (sorry)"
                : isComplete
                  ? "Simulated goal closed ✔"
                  : "Simulating..."}
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-[10px] hidden sm:inline text-zinc-500">
              {isLeanInspectorOpen ? "Collapse Drawer" : "Expand Drawer"}
            </span>
            {isLeanInspectorOpen ? (
              <IconChevronUp className="w-4 h-4 text-purple-400" />
            ) : (
              <IconChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </div>
        </button>

        {isLeanInspectorOpen && (
          <div
            id="lean-ide-drawer-content"
            className="border-t border-zinc-800/80 p-1"
          >
            <LeanIdeInspector
              level={level}
              steps={proofSteps}
              isComplete={isComplete}
            />
          </div>
        )}
      </div>

      {/* 2. Accordion Drawer: Diagnostic Terminal Log */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-md transition-all">
        <button
          type="button"
          onClick={() => setIsTerminalOpen((prev) => !prev)}
          aria-expanded={isTerminalOpen}
          aria-controls="terminal-log-drawer-content"
          className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/90 hover:bg-zinc-850 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-cyan/50 cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <IconTerminal2 className="w-4 h-4 text-brand-cyan shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-zinc-100">
              Local Tactic Diagnostics &amp; TTY Feedback Log
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {logs.length} entries
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-[10px] hidden sm:inline text-zinc-500">
              {isTerminalOpen ? "Collapse Drawer" : "Expand Drawer"}
            </span>
            {isTerminalOpen ? (
              <IconChevronUp className="w-4 h-4 text-brand-cyan" />
            ) : (
              <IconChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </div>
        </button>

        {isTerminalOpen && (
          <div
            id="terminal-log-drawer-content"
            className="border-t border-zinc-800/80 p-1"
          >
            <TerminalLog logs={logs} />
          </div>
        )}
      </div>
    </div>
  );
};
