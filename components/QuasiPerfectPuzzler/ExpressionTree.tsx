"use client";

import React, { useMemo } from "react";
import { ASTNode } from "@/lib/quasi-perfect/types";
import { findNodeById, renderASTString } from "@/lib/quasi-perfect/engine";
import { ASTNodeView } from "./ASTNodeView";
import { IconFocus2, IconSparkles } from "@tabler/icons-react";

interface ExpressionTreeProps {
  goalAST: ASTNode;
  hypotheses: ASTNode[];
  selectedTargetId: string | null;
  hoveredTargetId: string | null;
  onSelectTarget: (nodeId: string) => void;
  onHoverTarget: (nodeId: string | null) => void;
  isProofComplete?: boolean;
  isTacticActive?: boolean;
  /** Rule shown before a tap so a wrong target is never a surprise penalty. */
  targetingHint?: string;
}

export const ExpressionTree: React.FC<ExpressionTreeProps> = ({
  goalAST,
  hypotheses,
  selectedTargetId,
  hoveredTargetId,
  onSelectTarget,
  onHoverTarget,
  isProofComplete = false,
  isTacticActive = false,
  targetingHint,
}) => {
  const mathematicalNotation = renderASTString(goalAST);

  const activeTargetId = selectedTargetId || hoveredTargetId;
  const inspectedNode = useMemo(() => {
    if (!activeTargetId) return null;
    return findNodeById(goalAST, activeTargetId);
  }, [goalAST, activeTargetId]);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* 1. Hypotheses Panel (Lean Proof Context) */}
      {hypotheses.length > 0 && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Active Hypotheses Context (Γ)
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {hypotheses.length} in context
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {hypotheses.map((hyp) => {
              const hypName = (hyp.metadata?.name as string) || "h";
              const hypFormula = renderASTString(hyp);
              const isSelected = selectedTargetId === hyp.id;
              const isHovered = hoveredTargetId === hyp.id;
              const isTargetEligible = isTacticActive && !isProofComplete;
              return (
                <button
                  type="button"
                  key={hyp.id}
                  data-node-id={hyp.id}
                  data-target-eligible={isTargetEligible ? "true" : undefined}
                  onClick={() => onSelectTarget(hyp.id)}
                  onMouseEnter={() => onHoverTarget(hyp.id)}
                  onMouseLeave={() => onHoverTarget(null)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono transition-all cursor-pointer ${
                    isSelected
                      ? "border-purple-400 bg-purple-600/30 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)] ring-2 ring-purple-400"
                      : isHovered
                        ? "border-purple-500/60 bg-purple-950/40 text-purple-100"
                        : isTargetEligible
                          ? "border-purple-400 bg-purple-950/60 text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.5)] ring-1 ring-purple-400"
                          : "border-purple-500/30 bg-purple-950/20 text-purple-200 hover:border-purple-400"
                  }`}
                >
                  <span className="font-bold text-purple-300">{hypName}:</span>
                  <span>{hypFormula}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Main Goal Tree Container */}
      <div className="relative flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/90 p-6 min-h-[220px] overflow-x-auto">
        {/* Goal Formula Banner */}
        <div className="w-full flex flex-wrap items-center justify-between border-b border-zinc-800/70 pb-3 mb-6 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-cyan tracking-wider font-mono">
              GOAL ⊢
            </span>
            <span className="text-sm font-semibold font-mono text-zinc-200">
              {isProofComplete
                ? "Q.E.D. (Proof Complete)"
                : mathematicalNotation}
            </span>
          </div>

          <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-2">
            {isProofComplete ? (
              <span className="text-emerald-400 font-bold">✔ Closed</span>
            ) : inspectedNode ? (
              <span className="rounded bg-brand-cyan/10 border border-brand-cyan/30 px-2 py-0.5 text-brand-cyan font-bold flex items-center gap-1">
                <IconFocus2 className="w-3 h-3" />
                <span>
                  {inspectedNode.type}:{" "}
                  <code className="text-white font-mono">
                    {renderASTString(inspectedNode)}
                  </code>
                </span>
              </span>
            ) : (
              <span>Target: Root Goal</span>
            )}
          </div>
        </div>

        {/* The Node Graph Tree */}
        <div className="w-full flex items-center justify-center py-2">
          <ASTNodeView
            node={goalAST}
            isRoot={true}
            selectedTargetId={selectedTargetId}
            hoveredTargetId={hoveredTargetId}
            onSelectTarget={onSelectTarget}
            onHoverTarget={onHoverTarget}
            isInteractive={!isProofComplete}
            isTacticActive={isTacticActive}
          />
        </div>

        {/* Tree Instructions Footer */}
        {!isProofComplete && (
          <div className="mt-4 text-center">
            <p className="text-[11px] text-zinc-400 font-mono">
              {selectedTargetId ? (
                <span className="text-brand-cyan font-semibold flex items-center justify-center gap-1">
                  <IconSparkles className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>
                    Subterm locked: &apos;
                    {inspectedNode
                      ? renderASTString(inspectedNode)
                      : selectedTargetId}
                    &apos;. Click or drop a tactic card!
                  </span>
                </span>
              ) : (
                <span>
                  Drag a tactic card onto any target node, or click a node then
                  click a card.
                </span>
              )}
            </p>
            {targetingHint && (
              <p
                data-testid="targeting-hint"
                className="mt-2 text-[11px] font-mono text-amber-300"
              >
                {targetingHint}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
