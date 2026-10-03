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
  // Board first (#1519): both drawers start collapsed; the latest log line
  // is shown on the proof board itself.
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(false);

  return (
    <div
      className="w-full space-y-3 font-mono"
      data-testid="diagnostic-drawers"
    >
      {/* 1. Accordion Drawer: Lean IDE Inspector */}
      <div className="rounded-xl border border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] overflow-hidden">
        <button
          type="button"
          onClick={onToggleLeanInspector}
          aria-expanded={isLeanInspectorOpen}
          aria-controls="lean-ide-drawer-content"
          className="qp-focus w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--qp-raised)] cursor-pointer"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <IconCode className="w-4 h-4 qp-text-accent shrink-0" />
            <span className="min-w-0 text-xs sm:text-sm font-bold text-zinc-100">
              Generated Lean 4 Text &amp; Simulator Inspector
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isComplete
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "qp-chip-accent"
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
            <span className="text-[10px] hidden sm:inline text-zinc-400">
              {isLeanInspectorOpen ? "Collapse Drawer" : "Expand Drawer"}
            </span>
            {isLeanInspectorOpen ? (
              <IconChevronUp className="w-4 h-4 qp-text-accent" />
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
      <div className="rounded-xl border border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsTerminalOpen((prev) => !prev)}
          aria-expanded={isTerminalOpen}
          aria-controls="terminal-log-drawer-content"
          className="qp-focus w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--qp-raised)] cursor-pointer"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <IconTerminal2 className="w-4 h-4 text-zinc-300 shrink-0" />
            <span className="min-w-0 text-xs sm:text-sm font-bold text-zinc-100">
              Local Tactic Diagnostics &amp; TTY Feedback Log
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[color:var(--qp-hairline)] text-zinc-300">
              {logs.length} entries
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-[10px] hidden sm:inline text-zinc-400">
              {isTerminalOpen ? "Collapse Drawer" : "Expand Drawer"}
            </span>
            {isTerminalOpen ? (
              <IconChevronUp className="w-4 h-4 text-zinc-300" />
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
