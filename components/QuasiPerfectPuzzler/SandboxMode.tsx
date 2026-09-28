"use client";

import React, { useRef, useState } from "react";
import { ASTNode } from "@/lib/quasi-perfect/types";
import { tacticDefs } from "@/lib/quasi-perfect/tactics";
import {
  cloneAST,
  findNodeById,
  isProofComplete,
} from "@/lib/quasi-perfect/engine";
import { ExpressionTree } from "./ExpressionTree";
import { TacticHand } from "./TacticHand";
import { TerminalLog } from "./TerminalLog";
import { CompilerLogEntry, TacticResult } from "@/lib/quasi-perfect/types";
import { IconFlask, IconRotate, IconSparkles } from "@tabler/icons-react";

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

export const SandboxMode: React.FC = () => {
  const sandboxRef = useRef<HTMLDivElement>(null);
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number>(0);
  const currentPreset = SANDBOX_PRESETS[selectedPresetIdx];

  const [currentGoal, setCurrentGoal] = useState<ASTNode>(() =>
    cloneAST(currentPreset.goal)
  );
  const [currentHypotheses, setCurrentHypotheses] = useState<ASTNode[]>(() =>
    currentPreset.hypotheses.map(cloneAST)
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
      text: "Interactive Sandbox Mode active. Unlimited RAM. Test any tactic freely.",
    },
  ]);

  const loadPreset = (idx: number) => {
    const p = SANDBOX_PRESETS[idx];
    setSelectedPresetIdx(idx);
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

  const handleExecuteTactic = (tacticIdx: number, targetId: string | null) => {
    const allTactics = Object.keys(tacticDefs) as (keyof typeof tacticDefs)[];
    const tacticKey = allTactics[tacticIdx];
    const tactic = tacticDefs[tacticKey];
    if (!tactic) return;

    const targetNode = targetId ? findNodeById(currentGoal, targetId) : null;
    // Only local rewrites preserve the surrounding goal when applied to a child.
    // Goal tactics may fall back to the root or change the hypothesis scope.
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
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <IconFlask className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>Theorem Playground &amp; AST Sandbox</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                Unlimited RAM
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Local tactic simulation only: no Lean verification or campaign
              score. Use rw, simp or norm_num on child expressions; other
              tactics require the GOAL node. Multiple proof goals are
              unsupported.
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
                  ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
              }`}
            >
              Preset {idx + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => loadPreset(selectedPresetIdx)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition-all"
          >
            <IconRotate className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Preset Details */}
      <div className="text-xs text-zinc-400 flex items-center justify-between px-1">
        <span>
          Active:{" "}
          <strong className="text-zinc-200">{currentPreset.name}</strong>.{" "}
          {currentPreset.description}
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
