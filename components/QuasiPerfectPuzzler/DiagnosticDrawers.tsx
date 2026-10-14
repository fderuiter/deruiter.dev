"use client";

import React, { useState } from "react";
import {
  CompilerLogEntry,
  LeanProofStep,
  PuzzlerLevelDef,
} from "@/lib/quasi-perfect/types";
import { useCabinetTouch } from "@/components/arcade/mobile";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { LeanIdeInspector } from "./LeanIdeInspector";
import { TerminalLog } from "./TerminalLog";
import {
  IconChevronDown,
  IconChevronUp,
  IconCode,
  IconTerminal2,
  IconX,
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

interface CabinetSheetProps {
  id: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * An open drawer on the touch cabinet (#2042). Inline, it would push the board
 * and the tactic hand off a portrait iPad, so it opens as a bottom sheet over
 * them instead: a modal dialog with its own close button, a backdrop that
 * closes it, focus kept inside, and Escape to close.
 */
const CabinetSheet: React.FC<CabinetSheetProps> = ({
  id,
  title,
  onClose,
  children,
}) => {
  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onClose,
    returnFocus: true,
  });
  return (
    <>
      <div
        aria-hidden="true"
        data-testid="qp-sheet-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60"
      />
      <div
        id={id}
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[70dvh] flex-col rounded-t-2xl border border-b-0 border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] shadow-[0_-16px_40px_-12px_rgba(0,0,0,0.9)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-1">
          <span className="min-w-0 truncate text-sm font-bold text-zinc-100">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="qp-focus flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-300 hover:bg-[color:var(--qp-raised)]"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
          {children}
        </div>
      </div>
    </>
  );
};

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
  const inCabinet = useCabinetTouch();
  const closeTerminal = () => setIsTerminalOpen(false);

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
          <div
            className={`flex min-w-0 flex-wrap items-center gap-2.5${inCabinet ? " qp-touch-drawer-head" : ""}`}
          >
            <IconCode className="w-4 h-4 qp-text-accent shrink-0" />
            <span
              className={`min-w-0 text-xs sm:text-sm font-bold text-zinc-100${inCabinet ? " qp-touch-drawer-title" : ""}`}
            >
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
            <span
              className={`text-[10px] hidden sm:inline text-zinc-400${inCabinet ? " qp-touch-drawer-state" : ""}`}
            >
              {isLeanInspectorOpen ? "Collapse Drawer" : "Expand Drawer"}
            </span>
            {isLeanInspectorOpen ? (
              <IconChevronUp className="w-4 h-4 qp-text-accent" />
            ) : (
              <IconChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </div>
        </button>

        {isLeanInspectorOpen && inCabinet && (
          <CabinetSheet
            id="lean-ide-drawer-content"
            title="Generated Lean 4 Text and Simulator Inspector"
            onClose={onToggleLeanInspector}
          >
            <LeanIdeInspector
              level={level}
              steps={proofSteps}
              isComplete={isComplete}
            />
          </CabinetSheet>
        )}
        {isLeanInspectorOpen && !inCabinet && (
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
          <div
            className={`flex min-w-0 flex-wrap items-center gap-2.5${inCabinet ? " qp-touch-drawer-head" : ""}`}
          >
            <IconTerminal2 className="w-4 h-4 text-zinc-300 shrink-0" />
            <span
              className={`min-w-0 text-xs sm:text-sm font-bold text-zinc-100${inCabinet ? " qp-touch-drawer-title" : ""}`}
            >
              Local Tactic Diagnostics &amp; TTY Feedback Log
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-[color:var(--qp-hairline)] text-zinc-300">
              {logs.length} entries
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span
              className={`text-[10px] hidden sm:inline text-zinc-400${inCabinet ? " qp-touch-drawer-state" : ""}`}
            >
              {isTerminalOpen ? "Collapse Drawer" : "Expand Drawer"}
            </span>
            {isTerminalOpen ? (
              <IconChevronUp className="w-4 h-4 text-zinc-300" />
            ) : (
              <IconChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </div>
        </button>

        {isTerminalOpen && inCabinet && (
          <CabinetSheet
            id="terminal-log-drawer-content"
            title="Local Tactic Diagnostics and TTY Feedback Log"
            onClose={closeTerminal}
          >
            <TerminalLog logs={logs} />
          </CabinetSheet>
        )}
        {isTerminalOpen && !inCabinet && (
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
