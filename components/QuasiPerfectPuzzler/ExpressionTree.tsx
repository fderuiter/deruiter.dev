"use client";

import React, { useMemo, useState } from "react";
import { ASTNode } from "@/lib/quasi-perfect/types";
import { findNodeById, renderASTString } from "@/lib/quasi-perfect/engine";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { ASTNodeView } from "./ASTNodeView";
import {
  DEFAULT_PROOF_LAYOUT,
  countLeaves,
  fitSlotWidth,
  layoutProofTree,
  prettyMath,
} from "./boardArt";
import { useCalmMotion } from "./useCalmMotion";
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
  /** Latest simulator message, shown on the board so feedback stays in view. */
  statusMessage?: {
    text: string;
    type: "info" | "success" | "warning" | "error";
  };
}

const STATUS_TONE: Record<
  NonNullable<ExpressionTreeProps["statusMessage"]>["type"],
  string
> = {
  info: "text-zinc-300",
  success: "text-emerald-300",
  warning: "text-amber-300",
  error: "text-rose-300",
};

/**
 * The proof board: the goal as a large typeset formula, the hypotheses in
 * context, and the goal's AST drawn as a tree with SVG edges. Nodes are
 * buttons, so a tactic can be dropped or tapped onto any of them.
 */
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
  statusMessage,
}) => {
  const calm = useCalmMotion();
  const mathematicalNotation = renderASTString(goalAST);
  const [boardWidth, setBoardWidth] = useState(0);
  const boardRef = useResizeObserver<HTMLDivElement>((entry) => {
    setBoardWidth(Math.floor(entry.contentRect.width));
  });

  const layout = useMemo(() => {
    const slotWidth = fitSlotWidth(boardWidth, countLeaves(goalAST));
    return layoutProofTree(goalAST, { ...DEFAULT_PROOF_LAYOUT, slotWidth });
  }, [goalAST, boardWidth]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const item of layout.nodes) map.set(item.id, { x: item.x, y: item.y });
    return map;
  }, [layout]);

  const activeTargetId = selectedTargetId || hoveredTargetId;
  const inspectedNode = useMemo(() => {
    if (!activeTargetId) return null;
    return findNodeById(goalAST, activeTargetId);
  }, [goalAST, activeTargetId]);

  const isNodeInteractive = !isProofComplete;

  return (
    <div className="qp-board relative w-full rounded-2xl font-mono">
      {/* Goal formula, the largest thing on the board */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-3">
        <div className="min-w-0">
          <span className="qp-text-accent text-[10px] font-bold tracking-[0.2em]">
            GOAL ⊢
          </span>
          <p className="mt-0.5 flex min-w-0 flex-wrap items-baseline text-zinc-100">
            <span className="qp-math min-w-0 break-words text-[32px] leading-tight tracking-tight">
              {isProofComplete
                ? "Q.E.D. (Proof Complete)"
                : prettyMath(mathematicalNotation)}
            </span>
          </p>
        </div>

        <div className="flex min-w-0 max-w-[55%] flex-col items-end gap-2 pt-1">
          <div className="text-[11px] text-zinc-400 flex items-center gap-2">
            {isProofComplete ? (
              <span className="text-emerald-300 font-bold">✔ Closed</span>
            ) : inspectedNode ? (
              <span className="qp-chip-accent rounded border px-2 py-0.5 font-bold flex items-center gap-1">
                <IconFocus2 className="w-3 h-3" />
                <span>
                  {inspectedNode.type}:{" "}
                  <code className="text-zinc-100 font-mono">
                    {renderASTString(inspectedNode)}
                  </code>
                </span>
              </span>
            ) : (
              <span>Target: Root Goal</span>
            )}
          </div>
          {/* Hypotheses in context (Γ) */}
          {hypotheses.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className="qp-math text-base text-zinc-300"
                title="Active Hypotheses Context"
              >
                Γ
              </span>
              <span className="sr-only">
                Active Hypotheses Context (Γ), {hypotheses.length} in context
              </span>
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
                    className={`qp-focus inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm transition-colors cursor-pointer ${
                      isSelected || isHovered
                        ? "border-[color:var(--qp-accent)] bg-[color:var(--qp-accent-soft)] text-zinc-100"
                        : isTargetEligible
                          ? "border-dashed border-[color:var(--qp-accent)] bg-[color:var(--qp-raised)] text-zinc-100"
                          : "border-[color:var(--qp-hairline)] bg-[color:var(--qp-raised)] text-zinc-200 hover:border-[color:var(--qp-accent-line)]"
                    }`}
                  >
                    <span className="font-mono text-xs font-bold qp-text-accent-strong">
                      {hypName}:
                    </span>
                    <span className="qp-math">{prettyMath(hypFormula)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* The AST, drawn top-down with SVG edges */}
      <div ref={boardRef} className="relative mt-2 w-full overflow-x-auto">
        <div
          className="relative mx-auto"
          style={{ width: layout.width, height: layout.height }}
          data-testid="proof-board-tree"
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 overflow-visible"
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
          >
            {layout.edges.map((edge) => {
              const lit =
                activeTargetId !== null &&
                (edge.toId === activeTargetId ||
                  edge.fromId === activeTargetId);
              return (
                <path
                  key={`${edge.id}:${edge.d}`}
                  d={edge.d}
                  fill="none"
                  stroke={lit ? "#818cf8" : "#94a3b8"}
                  strokeOpacity={lit ? 0.9 : isProofComplete ? 0.2 : 0.4}
                  strokeWidth={lit ? 2 : 1.5}
                  strokeLinecap="round"
                  className={`qp-edge ${lit ? "[stroke:var(--qp-accent)]" : ""}`}
                />
              );
            })}
          </svg>

          {layout.nodes.map((item) => {
            const origin = (item.parentId && positions.get(item.parentId)) || {
              x: item.x,
              y: item.y - 24,
            };
            return (
              <ASTNodeView
                key={item.id}
                item={item}
                origin={origin}
                selectedTargetId={selectedTargetId}
                hoveredTargetId={hoveredTargetId}
                onSelectTarget={onSelectTarget}
                onHoverTarget={onHoverTarget}
                isInteractive={isNodeInteractive}
                isTacticActive={isTacticActive}
                isSettled={isProofComplete}
                calm={calm}
              />
            );
          })}

          {isProofComplete && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span
                data-animate={calm ? undefined : "true"}
                className="qp-stamp rounded-lg px-4 py-1.5 font-mono text-xl font-extrabold tracking-[0.18em]"
              >
                ∎ Q.E.D.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Board footer: what to do next, the rule before a tap, last result */}
      <div className="border-t border-[color:var(--qp-hairline)] px-5 py-2.5 text-center">
        {!isProofComplete && (
          <p className="text-[11px] text-zinc-400 font-mono">
            {selectedTargetId ? (
              <span className="qp-text-accent-strong font-semibold flex items-center justify-center gap-1">
                <IconSparkles className="w-3.5 h-3.5" />
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
        )}
        {!isProofComplete && targetingHint && (
          <p
            data-testid="targeting-hint"
            className="mt-1.5 text-[11px] font-mono text-amber-300"
          >
            {targetingHint}
          </p>
        )}
        {statusMessage && (
          <p
            role="status"
            data-testid="board-status"
            className={`mt-1.5 text-[11px] font-mono break-words ${STATUS_TONE[statusMessage.type]}`}
          >
            {statusMessage.text}
          </p>
        )}
      </div>
    </div>
  );
};
