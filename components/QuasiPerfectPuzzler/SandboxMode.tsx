"use client";

import React, { useRef, useState } from "react";
import { ASTNode } from "@/lib/quasi-perfect/types";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
import {
  cloneAST,
  findNodeById,
  isProofComplete,
  renderASTString,
} from "@/lib/quasi-perfect/engine";
import {
  parseFormulaWithError,
  parseHypotheses,
} from "@/lib/quasi-perfect/compiler";
import { ExpressionTree } from "./ExpressionTree";
import { TacticHand } from "./TacticHand";
import { TerminalLog } from "./TerminalLog";
import { CompilerLogEntry, TacticResult } from "@/lib/quasi-perfect/types";
import {
  IconFlask,
  IconRotate,
  IconSparkles,
  IconEdit,
  IconCheck,
  IconAlertTriangle,
  IconCode,
  IconX,
} from "@tabler/icons-react";

const SANDBOX_PRESETS: {
  name: string;
  description: string;
  goal: ASTNode;
  hypotheses: ASTNode[];
}[] = [
  {
    name: "Binomial Expansion (a + b)²",
    description: "Verify polynomial identity using ring.",
    goal: {
      id: "sb-goal-1",
      type: "Equality",
      value: "=",
      children: [
        {
          id: "sb-pow",
          type: "Operator",
          value: "^",
          children: [
            {
              id: "sb-add",
              type: "Operator",
              value: "+",
              children: [
                { id: "sb-a", type: "Variable", value: "a" },
                { id: "sb-b", type: "Variable", value: "b" },
              ],
            },
            { id: "sb-2", type: "Constant", value: 2 },
          ],
        },
        {
          id: "sb-exp",
          type: "Operator",
          value: "+",
          children: [
            {
              id: "sb-a2",
              type: "Operator",
              value: "^",
              children: [
                { id: "sb-a-r", type: "Variable", value: "a" },
                { id: "sb-2-r", type: "Constant", value: 2 },
              ],
            },
            {
              id: "sb-mid",
              type: "Operator",
              value: "+",
              children: [
                {
                  id: "sb-2ab",
                  type: "Operator",
                  value: "*",
                  children: [
                    {
                      id: "sb-2a",
                      type: "Operator",
                      value: "*",
                      children: [
                        { id: "sb-c2", type: "Constant", value: 2 },
                        { id: "sb-va", type: "Variable", value: "a" },
                      ],
                    },
                    { id: "sb-vb", type: "Variable", value: "b" },
                  ],
                },
                {
                  id: "sb-b2",
                  type: "Operator",
                  value: "^",
                  children: [
                    { id: "sb-b-r", type: "Variable", value: "b" },
                    { id: "sb-2-r2", type: "Constant", value: 2 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    hypotheses: [],
  },
  {
    name: "Tautology P → P",
    description: "Practice intro and exact logic tactics.",
    goal: {
      id: "sb-goal-2",
      type: "Implication",
      value: "→",
      children: [
        { id: "sb-P1", type: "Variable", value: "P" },
        { id: "sb-P2", type: "Variable", value: "P" },
      ],
    },
    hypotheses: [],
  },
  {
    name: "Arithmetic Decidability (3 + 7 = 10)",
    description: "Verify concrete numerical evaluation with decide / norm_num.",
    goal: {
      id: "sb-goal-3",
      type: "Equality",
      value: "=",
      children: [
        {
          id: "sb-add37",
          type: "Operator",
          value: "+",
          children: [
            { id: "c3", type: "Constant", value: 3 },
            { id: "c7", type: "Constant", value: 7 },
          ],
        },
        { id: "c10", type: "Constant", value: 10 },
      ],
    },
    hypotheses: [],
  },
];

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
  "(",
  ")",
];

export const SandboxMode: React.FC = () => {
  const sandboxRef = useRef<HTMLDivElement>(null);
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number | null>(0);

  const [currentGoal, setCurrentGoal] = useState<ASTNode>(() =>
    cloneAST(SANDBOX_PRESETS[0].goal)
  );
  const [currentHypotheses, setCurrentHypotheses] = useState<ASTNode[]>(() =>
    SANDBOX_PRESETS[0].hypotheses.map(cloneAST)
  );

  const [customGoalInput, setCustomGoalInput] = useState<string>(
    "(a + b)^2 = a^2 + 2*a*b + b^2"
  );
  const [customHypothesesInput, setCustomHypothesesInput] =
    useState<string>("");
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeFormulaTitle, setActiveFormulaTitle] = useState<string>(
    SANDBOX_PRESETS[0].name
  );

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [selectedTacticIndex, setSelectedTacticIndex] = useState<number | null>(
    null
  );

  const [logs, setLogs] = useState<CompilerLogEntry[]>([
    {
      id: "sb-init",
      timestamp: "00:00:01",
      type: "info",
      text: "Interactive Sandbox Mode active. Unlimited RAM. Test any tactic freely or compile custom infix formulas.",
    },
  ]);

  // Live compilation analysis
  const parseResult = parseFormulaWithError(customGoalInput, "custom-goal");
  let parsedHypothesesList: ASTNode[] = [];
  let hypError: string | null = null;
  if (customHypothesesInput.trim()) {
    try {
      parsedHypothesesList = parseHypotheses(
        customHypothesesInput,
        "custom-hyp"
      );
    } catch (e) {
      hypError = e instanceof Error ? e.message : String(e);
    }
  }

  const loadPreset = (idx: number) => {
    const p = SANDBOX_PRESETS[idx];
    setSelectedPresetIdx(idx);
    setActiveFormulaTitle(p.name);
    setCurrentGoal(cloneAST(p.goal));
    setCurrentHypotheses(p.hypotheses.map(cloneAST));
    setSelectedTargetId(null);
    setSelectedTacticIndex(null);
    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type: "info",
        text: `Loaded preset: ${p.name}`,
      },
    ]);
  };

  const handleApplyCustomFormula = () => {
    if (!parseResult.ast || hypError) return;

    setSelectedPresetIdx(null);
    setActiveFormulaTitle(
      `Custom Formula: ${renderASTString(parseResult.ast)}`
    );
    setCurrentGoal(parseResult.ast);
    setCurrentHypotheses(parsedHypothesesList);
    setSelectedTargetId(null);
    setSelectedTacticIndex(null);

    setLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
        type: "success",
        text: `Successfully compiled and loaded AST for custom formula: "${customGoalInput}"`,
      },
    ]);
  };

  const insertSymbol = (symbol: string) => {
    setCustomGoalInput(
      (prev) => prev + (prev && !prev.endsWith(" ") ? " " : "") + symbol + " "
    );
  };

  const handleExecuteTactic = (tacticIdx: number, targetId: string | null) => {
    const allTactics = Object.keys(tacticDefs) as (keyof typeof tacticDefs)[];
    const tacticKey = allTactics[tacticIdx];
    const tactic = tacticDefs[tacticKey];
    if (!tactic) return;

    const targetNode = targetId ? findNodeById(currentGoal, targetId) : null;
    const supportsChildTarget = ["rw", "simp", "norm_num"].includes(tacticKey);
    let result: TacticResult;
    if (!targetNode) {
      result = {
        success: false,
        ramConsumed: 0,
        message:
          "Select a node in the current goal. Hypotheses and empty space are not tactic targets in Sandbox.",
      };
    } else if (targetNode.id !== currentGoal.id && !supportsChildTarget) {
      result = {
        success: false,
        ramConsumed: 0,
        message: `'${tacticKey}' requires the root goal in Sandbox. Select the GOAL node; use rw, simp or norm_num for child rewrites.`,
      };
    } else if (tacticKey === "cases" || tacticKey === "split") {
      result = {
        success: false,
        ramConsumed: 0,
        message: `'${tacticKey}' requires multiple proof goals, which Sandbox does not support. The current goal is unchanged.`,
      };
    } else {
      result = tactic.execute(targetNode, currentGoal, currentHypotheses);
    }

    if (result.success && result.newAST) {
      setCurrentGoal(result.newAST);
      if (result.newHypotheses) {
        setCurrentHypotheses(result.newHypotheses);
      }
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          type: "success",
          text: result.message,
        },
      ]);
    } else {
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          type: "error",
          text: result.message,
        },
      ]);
    }

    setSelectedTacticIndex(null);
    setSelectedTargetId(null);
  };

  const isComplete = isProofComplete(currentGoal);
  const allTacticIds = Object.keys(tacticDefs) as (keyof typeof tacticDefs)[];

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
          {SANDBOX_PRESETS.map((preset, idx) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => loadPreset(idx)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                idx === selectedPresetIdx
                  ? "qp-btn-primary"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
            >
              Preset {idx + 1}
            </button>
          ))}
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
