"use client";

import React, { useRef, useState } from "react";
import {
  MAX_CUSTOM_THEOREMS,
  SANDBOX_PRESETS,
  type SandboxMedal,
} from "@/lib/quasi-perfect/sandbox";
import { renderASTString } from "@/lib/quasi-perfect/engine";
import { ExpressionTree } from "./ExpressionTree";
import { TacticHand } from "./TacticHand";
import { TerminalLog } from "./TerminalLog";
import {
  IconFlask,
  IconRotate,
  IconSparkles,
  IconEdit,
  IconCheck,
  IconAlertTriangle,
  IconCode,
  IconX,
  IconDeviceFloppy,
  IconDownload,
  IconUpload,
  IconTrash,
} from "@tabler/icons-react";
import { useQuasiSandboxSession } from "./useQuasiSandboxSession";

const MEDAL_LABEL: Record<SandboxMedal, string> = {
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

const FORMULA_SHORTCUTS = [
  {
    label: "Binomial Square",
    formula: "(a + b)^2 = a^2 + 2*a*b + b^2",
    hypotheses: "",
  },
  {
    label: "Logical Implication",
    formula: "P -> Q -> P",
    hypotheses: "",
  },
  {
    label: "Hypothesis Transitivity",
    formula: "a = c",
    hypotheses: "h1: a = b, h2: b = c",
  },
  {
    label: "De Morgan Conjunction",
    formula: "~(P \\/ Q) = ~P /\\ ~Q",
    hypotheses: "",
  },
];

const OPERATOR_SHORTCUTS = [
  "+",
  "-",
  "*",
  "/",
  "^",
  "=",
  "≠",
  "→",
  "∧",
  "∨",
  "¬",
  "≤",
  "∀",
  "∃",
  ",",
  "(",
  ")",
];

export const SandboxMode: React.FC = () => {
  const sandboxRef = useRef<HTMLDivElement>(null);
  const {
    activeFormulaTitle,
    activePreset,
    activeRecord,
    allTacticIds,
    bestMedal,
    currentGoal,
    currentHypotheses,
    customGoalInput,
    customHypothesesInput,
    customTheorems,
    customTitleInput,
    handleApplyCustomFormula,
    handleDeleteTheorem,
    handleExecuteTactic,
    handleExportTheorems,
    handleImportFile,
    handleLoadTheorem,
    handleSaveTheorem,
    hoveredTargetId,
    hypError,
    importStatus,
    insertSymbol,
    isComplete,
    loadPreset,
    logs,
    parseResult,
    parsedHypothesesList,
    ramUsed,
    runMedal,
    sandboxProgress,
    saveStatus,
    selectedPresetIdx,
    selectedTacticIndex,
    selectedTargetId,
    setCustomGoalInput,
    setCustomHypothesesInput,
    setCustomTitleInput,
    setHoveredTargetId,
    setSelectedTacticIndex,
    setSelectedTargetId,
    usedSorry,
  } = useQuasiSandboxSession();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  return (
    <div ref={sandboxRef} className="space-y-4 font-mono">
      {/* Sandbox Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[color:var(--qp-accent-soft)] border border-[color:var(--qp-accent-line)] qp-text-accent-strong">
            <IconFlask className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>Theorem Playground &amp; AST Sandbox</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                Pratt Compiler Active
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Local tactic simulation only: no Lean verification or campaign
              score. Select presets or compile custom infix formulas into
              interactive proof nodes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {SANDBOX_PRESETS.map((preset, idx) => {
            const verified = !!sandboxProgress[preset.id]?.verified;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => loadPreset(idx)}
                data-verified={verified ? "true" : undefined}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all active:scale-[0.98] ${
                  idx === selectedPresetIdx
                    ? "qp-btn-primary"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              >
                {/* The name is on the button, not only in a tooltip (#2202). */}
                <span>{preset.name}</span>
                {verified && <span className="sr-only"> (verified)</span>}
                {verified && (
                  <IconCheck
                    aria-hidden="true"
                    data-testid={`sandbox-preset-verified-${preset.id}`}
                    className="w-3 h-3 text-emerald-400"
                  />
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            aria-expanded={isDrawerOpen}
            aria-controls="custom-formula-drawer"
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
              isDrawerOpen
                ? "qp-btn-primary border-[color:var(--qp-accent-line)]"
                : "border-[color:var(--qp-accent-line)] bg-[color:var(--qp-accent-soft)] qp-text-accent-strong hover:bg-[color:var(--qp-accent-soft)]"
            }`}
          >
            <IconEdit className="w-3.5 h-3.5" />
            <span>Custom Formula Input</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedPresetIdx !== null) loadPreset(selectedPresetIdx);
              else handleApplyCustomFormula();
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-all"
          >
            <IconRotate className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Formula Editor Drawer / Quick-Input Bar */}
      {isDrawerOpen && (
        <div
          id="custom-formula-drawer"
          className="rounded-xl border border-[color:var(--qp-accent-line)] bg-[color:var(--qp-accent-soft)] p-4 space-y-3.5"
        >
          <div className="flex items-center justify-between border-b border-[color:var(--qp-accent-line)] pb-2">
            <div className="flex items-center gap-2">
              <IconCode className="w-4 h-4 qp-text-accent-strong" />
              <h4 className="text-xs font-bold qp-text-accent-strong uppercase tracking-wider">
                Custom Formula Pratt Compiler &amp; Editor
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="text-zinc-400 hover:text-zinc-200 p-1 rounded"
              aria-label="Close formula editor"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Shortcuts */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold qp-text-accent-strong">
              Preset Formula Shortcuts:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {FORMULA_SHORTCUTS.map((shortcut) => (
                <button
                  key={shortcut.label}
                  type="button"
                  onClick={() => {
                    setCustomGoalInput(shortcut.formula);
                    setCustomHypothesesInput(shortcut.hypotheses);
                  }}
                  className="px-2 py-0.5 text-[11px] font-semibold rounded bg-zinc-900 border border-[color:var(--qp-accent-line)] qp-text-accent-strong hover:bg-[color:var(--qp-accent-soft)] transition-all"
                >
                  {shortcut.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Operator Insertion */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-zinc-400">
              Insert Symbol:
            </span>
            {OPERATOR_SHORTCUTS.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => insertSymbol(sym)}
                className="px-1.5 py-0.5 text-xs font-bold rounded bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 transition-all"
              >
                {sym}
              </button>
            ))}
          </div>

          {/* Goal & Hypotheses Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label
                htmlFor="custom-goal-input"
                className="text-xs font-bold text-zinc-300"
              >
                Goal Formula (Infix Expression):
              </label>
              <input
                id="custom-goal-input"
                type="text"
                value={customGoalInput}
                onChange={(e) => setCustomGoalInput(e.target.value)}
                placeholder="e.g. (a + b)^2 = a^2 + 2*a*b + b^2"
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:border-[color:var(--qp-accent-line)]"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="custom-hypotheses-input"
                className="text-xs font-bold text-zinc-300"
              >
                Hypotheses (Optional):
              </label>
              <input
                id="custom-hypotheses-input"
                type="text"
                value={customHypothesesInput}
                onChange={(e) => setCustomHypothesesInput(e.target.value)}
                placeholder="e.g. h1: a = b, h2: b = c"
                className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:border-[color:var(--qp-accent-line)]"
              />
            </div>
          </div>

          {/* Live Preview Panel */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400">
                Live Pratt Compiler AST Preview:
              </span>
              {parseResult.ast && !hypError ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <IconCheck className="w-3 h-3" /> Valid AST Tree
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <IconAlertTriangle className="w-3 h-3" /> Syntax Error
                </span>
              )}
            </div>

            {parseResult.ast ? (
              <div className="text-xs text-emerald-400 font-mono bg-zinc-900 p-2 rounded border border-zinc-800">
                <div>
                  <strong>Root Type:</strong> {parseResult.ast.type} (
                  {parseResult.ast.value})
                </div>
                <div>
                  <strong>Formatted AST:</strong>{" "}
                  {renderASTString(parseResult.ast)}
                </div>
                {parsedHypothesesList.length > 0 && (
                  <div className="mt-1 qp-text-accent-strong text-[11px]">
                    <strong>Hypotheses ({parsedHypothesesList.length}):</strong>{" "}
                    {parsedHypothesesList
                      .map(
                        (h) =>
                          `${h.metadata?.name || "h"}: ${renderASTString(h)}`
                      )
                      .join(", ")}
                  </div>
                )}
              </div>
            ) : (
              <pre className="text-xs text-rose-400 font-mono bg-zinc-900 p-2 rounded border border-rose-900/50 whitespace-pre overflow-x-auto">
                {parseResult.error}
              </pre>
            )}

            {hypError && (
              <div className="text-xs text-rose-400 font-mono bg-zinc-900 p-2 rounded border border-rose-900/50">
                Hypothesis Syntax Error: {hypError}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleApplyCustomFormula}
              disabled={!parseResult.ast || !!hypError}
              className="qp-btn-primary qp-focus px-4 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              <IconSparkles className="w-3.5 h-3.5" />
              <span>Compile &amp; Set Active Goal</span>
            </button>
          </div>

          {/* Saved custom theorems, kept in this browser (#2518) */}
          <section
            aria-labelledby="custom-theorems-heading"
            className="space-y-2 border-t border-[color:var(--qp-accent-line)] pt-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5
                id="custom-theorems-heading"
                className="text-xs font-bold uppercase tracking-wider qp-text-accent-strong"
              >
                Saved theorems ({customTheorems.length}/{MAX_CUSTOM_THEOREMS})
              </h5>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportTheorems}
                  disabled={customTheorems.length === 0}
                  className="qp-btn-quiet qp-focus flex min-h-12 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconDownload aria-hidden="true" className="w-3.5 h-3.5" />
                  <span>Export all (.json)</span>
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="qp-btn-quiet qp-focus flex min-h-12 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors"
                >
                  <IconUpload aria-hidden="true" className="w-3.5 h-3.5" />
                  <span>Import (.json)</span>
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  data-testid="custom-theorems-import-input"
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <label
                  htmlFor="custom-theorem-title-input"
                  className="text-xs font-bold qp-text-accent-strong"
                >
                  Theorem title (optional):
                </label>
                <input
                  id="custom-theorem-title-input"
                  type="text"
                  value={customTitleInput}
                  onChange={(e) => setCustomTitleInput(e.target.value)}
                  placeholder="Defaults to the goal formula"
                  className="qp-focus w-full min-h-12 rounded-lg border border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] px-3 text-xs font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveTheorem}
                disabled={!parseResult.ast || !!hypError}
                className="qp-btn-quiet qp-focus flex min-h-12 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconDeviceFloppy aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Save theorem</span>
              </button>
            </div>

            <p role="status" className="text-xs qp-text-accent-strong">
              {saveStatus}
            </p>
            <p role="status" className="text-xs qp-text-accent-strong">
              {importStatus}
            </p>

            {customTheorems.length === 0 ? (
              <p className="text-xs text-[color:var(--qp-steel)]">
                No saved theorems yet. Save the formula above to keep it in this
                browser.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {customTheorems.map((theorem) => (
                  <li
                    key={theorem.id}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-[color:var(--qp-hairline)] bg-[color:var(--qp-panel)] px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="truncate font-bold">{theorem.title}</p>
                      <p className="truncate qp-text-accent">
                        {theorem.formula}
                        {theorem.hypotheses && ` · ${theorem.hypotheses}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLoadTheorem(theorem)}
                      className="qp-btn-quiet qp-focus min-h-12 rounded-lg px-3 text-xs font-bold transition-colors"
                    >
                      Load<span className="sr-only"> {theorem.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTheorem(theorem)}
                      aria-label={`Delete ${theorem.title}`}
                      className="qp-btn-quiet qp-focus flex min-h-12 min-w-12 items-center justify-center rounded-lg transition-colors"
                    >
                      <IconTrash aria-hidden="true" className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Preset Details */}
      <div className="text-xs text-zinc-400 flex items-center justify-between px-1">
        <span>
          Active:{" "}
          <strong className="text-zinc-200">{activeFormulaTitle}</strong>
        </span>
        {isComplete && (
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <IconSparkles className="w-3.5 h-3.5" />
            Sandbox simulation complete
          </span>
        )}
      </div>

      {/* Preset goals: RAM targets, this attempt, and the saved verified mark */}
      {activePreset && (
        <div
          data-testid="sandbox-goals"
          className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-400"
        >
          <span className="tabular-nums">
            <span className="font-bold text-amber-300">Gold</span>: use{" "}
            {activePreset.goldRamBudget} GB or less ·{" "}
            <span className="font-bold text-zinc-200">Silver</span>:{" "}
            {activePreset.silverRamBudget} GB or less
          </span>
          <span
            data-testid="sandbox-ram-used"
            className="tabular-nums text-zinc-300"
          >
            This attempt: {ramUsed} GB
            {runMedal ? ` · ${MEDAL_LABEL[runMedal]}` : ""}
            {isComplete && usedSorry ? " · admitted with sorry, no medal" : ""}
          </span>
          <span
            data-testid="sandbox-verified"
            data-verified={activeRecord ? "true" : "false"}
            title="Proved without sorry in the local simulator. No Lean kernel check is run."
            className={`ml-auto flex items-center gap-1 font-bold ${
              activeRecord ? "text-emerald-400" : "text-zinc-400"
            }`}
          >
            {activeRecord ? (
              <>
                <IconCheck aria-hidden="true" className="w-3.5 h-3.5" />
                <span>
                  Verified · best {activeRecord.bestRamUsed} GB
                  {bestMedal ? ` (${MEDAL_LABEL[bestMedal]})` : ""}
                </span>
              </>
            ) : (
              <span>Not verified yet</span>
            )}
          </span>
        </div>
      )}

      {/* Main Canvas */}
      <ExpressionTree
        goalAST={currentGoal}
        hypotheses={currentHypotheses}
        selectedTargetId={selectedTargetId}
        hoveredTargetId={hoveredTargetId}
        onSelectTarget={(id) => {
          if (selectedTacticIndex !== null) {
            handleExecuteTactic(selectedTacticIndex, id);
          } else {
            setSelectedTargetId((prev) => (prev === id ? null : id));
          }
        }}
        onHoverTarget={setHoveredTargetId}
        isProofComplete={isComplete}
      />

      {/* Tactic Hand with all tactics */}
      <TacticHand
        availableTactics={allTacticIds}
        currentRam={999}
        selectedTacticIndex={selectedTacticIndex}
        onSelectTactic={(idx) => {
          if (selectedTargetId !== null) {
            handleExecuteTactic(idx, selectedTargetId);
          } else {
            setSelectedTacticIndex((prev) => (prev === idx ? null : idx));
          }
        }}
        onCardDragStart={(idx) => setSelectedTacticIndex(idx)}
        onCardDragEnd={(idx, event) => {
          const clientX =
            "clientX" in event
              ? event.clientX
              : (event as TouchEvent).changedTouches?.[0]?.clientX;
          const clientY =
            "clientY" in event
              ? event.clientY
              : (event as TouchEvent).changedTouches?.[0]?.clientY;

          if (typeof clientX === "number" && typeof clientY === "number") {
            const elementsUnderPoint = document.elementsFromPoint(
              clientX,
              clientY
            );
            let targetNodeId: string | null = null;
            for (const el of elementsUnderPoint) {
              if (!sandboxRef.current?.contains(el)) continue;
              const nodeId =
                el.getAttribute("data-node-id") ||
                el.closest("[data-node-id]")?.getAttribute("data-node-id");
              if (nodeId) {
                targetNodeId = nodeId;
                break;
              }
            }
            handleExecuteTactic(idx, targetNodeId);
          }
        }}
        isProofComplete={isComplete}
      />

      {/* Terminal Log */}
      <TerminalLog logs={logs} />
    </div>
  );
};
