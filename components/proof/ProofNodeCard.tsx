"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  IconAlertTriangle,
  IconCheck,
  IconPencil,
  IconRefresh,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  evaluateAst,
  type FallacyDiagnosis,
  type ProofNode,
} from "@/lib/proof";
import { TooltipButton } from "@/components/ui/Tooltip";

export const PROOF_NODE_CARD_WIDTH = 180;
export const PROOF_NODE_CARD_HEIGHT = 108;

type ProofFlowNodeData = {
  node: ProofNode;
  isSelected: boolean;
  isInspected: boolean;
  isGivenPremise: boolean;
  isNodeProven: boolean;
  isDimmed: boolean;
  isHoveredInDrag: boolean;
  dragIsValid: boolean;
  compatibleBadgeLabel: string | null;
  isFallacyTargetNode: boolean;
  currentFallacy: FallacyDiagnosis | null;
  hasCommittedFallacyEdge: boolean;
  isPopoverOpen: boolean;
  isSandbox: boolean;
  isEditing: boolean;
  editingFormula: string;
  editingError: string | null;
  canEditSandboxNode: boolean;
  onNodeClick: (nodeId: string, addToSelection?: boolean) => void;
  onTogglePopover: (nodeId: string) => void;
  onClosePopover: () => void;
  onBeginEdit: (nodeId: string, currentLabel: string) => void;
  onChangeEditingFormula: (value: string) => void;
  onSubmitEdit: (e: React.FormEvent, nodeId: string) => void;
  onCancelEdit: () => void;
  onDeleteSandboxNode?: (nodeId: string) => void;
  onRollback?: () => void;
  onInspectFallacy?: () => void;
};

export type ProofFlowNode = Node<ProofFlowNodeData, "proofNode">;

export function ProofNodeCard({ data }: NodeProps<ProofFlowNode>) {
  const {
    node,
    isSelected,
    isInspected,
    isGivenPremise,
    isNodeProven,
    isDimmed,
    isHoveredInDrag,
    dragIsValid,
    compatibleBadgeLabel,
    isFallacyTargetNode,
    currentFallacy,
    hasCommittedFallacyEdge,
    isPopoverOpen,
    isSandbox,
    isEditing,
    editingFormula,
    editingError,
    canEditSandboxNode,
    onNodeClick,
    onTogglePopover,
    onClosePopover,
    onBeginEdit,
    onChangeEditingFormula,
    onSubmitEdit,
    onCancelEdit,
    onDeleteSandboxNode,
    onRollback,
    onInspectFallacy,
  } = data;

  const statusText = isGivenPremise
    ? "GIVEN"
    : isNodeProven
      ? "PROVEN"
      : "PENDING";

  const isPointerDraggingRef = useRef(false);
  const pointerRafRef = useRef<number | null>(null);

  const cancelPendingPointerFrame = useCallback(() => {
    if (
      pointerRafRef.current !== null &&
      typeof cancelAnimationFrame === "function"
    ) {
      cancelAnimationFrame(pointerRafRef.current);
      pointerRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelPendingPointerFrame();
    };
  }, [cancelPendingPointerFrame]);

  const handlePointerDown = useCallback(() => {
    isPointerDraggingRef.current = true;
  }, []);

  const handlePointerMove = useCallback(() => {
    if (!isPointerDraggingRef.current) return;
    if (
      pointerRafRef.current === null &&
      typeof requestAnimationFrame === "function"
    ) {
      pointerRafRef.current = requestAnimationFrame(() => {
        pointerRafRef.current = null;
      });
    }
  }, []);

  const handlePointerEnd = useCallback(() => {
    isPointerDraggingRef.current = false;
    cancelPendingPointerFrame();
  }, [cancelPendingPointerFrame]);

  return (
    <div
      style={{ width: PROOF_NODE_CARD_WIDTH }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className={`group relative p-[10px] rounded-xl border cursor-pointer transition-shadow shadow-md select-none ${
        isDimmed ? "opacity-45" : "opacity-100"
      } ${
        isFallacyTargetNode
          ? "bg-rose-950/75 border-rose-500/80 ring-2 ring-rose-500/60 shadow-rose-500/20"
          : isHoveredInDrag
            ? dragIsValid
              ? "bg-emerald-950/75 border-emerald-400 ring-2 ring-emerald-400/80 shadow-emerald-500/30"
              : "bg-rose-950/75 border-rose-500 ring-2 ring-rose-500/80 shadow-rose-500/30"
            : compatibleBadgeLabel
              ? "bg-emerald-950/50 border-emerald-500/70 ring-2 ring-emerald-500/50 shadow-emerald-500/20"
              : isSelected
                ? "bg-slate-900 border-brand-cyan ring-2 ring-brand-cyan/60 shadow-cyan-500/20"
                : isInspected
                  ? "bg-slate-800/95 border-slate-600 ring-1 ring-slate-400"
                  : "bg-slate-900/95 border-slate-800 hover:border-slate-700"
      }`}
    >
      {/* Left incoming connection target port */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectableStart={false}
        className="!w-5 !h-5 !-left-2.5 !bg-transparent !border-0 flex items-center justify-center"
      >
        <span className="pointer-events-none w-3 h-3 rounded-full bg-slate-950 border-2 border-slate-400" />
      </Handle>

      {/* Compatible Rule Floating Badge */}
      {compatibleBadgeLabel && (
        <div className="pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-mono text-[9px] font-bold shadow-md shadow-emerald-950/50 flex items-center gap-1 z-30 whitespace-nowrap">
          <IconSparkles className="w-2.5 h-2.5 shrink-0" />
          <span>{compatibleBadgeLabel}</span>
        </div>
      )}

      {/* Invalid Hover Floating Badge */}
      {isHoveredInDrag && !dragIsValid && !isFallacyTargetNode && (
        <div className="pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-rose-700 text-white font-mono text-[9px] font-bold shadow-md flex items-center gap-1 z-30 whitespace-nowrap">
          <IconAlertTriangle className="w-2.5 h-2.5 shrink-0" />
          <span>Invalid Inference</span>
        </div>
      )}

      {isEditing && isSandbox ? (
        <form
          onSubmit={(e) => onSubmitEdit(e, node.id)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="nodrag nopan space-y-1.5 pr-2"
        >
          <div className="text-[10px] font-mono font-bold text-brand-cyan">
            Edit Node {node.id}
          </div>
          <input
            type="text"
            value={editingFormula}
            onChange={(e) => onChangeEditingFormula(e.target.value)}
            aria-label={`Edit formula for Node ${node.id}`}
            autoFocus
            className="w-full min-w-0 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[12px] font-mono text-white focus:outline-none focus:border-brand-cyan"
          />
          {editingError && (
            <p role="alert" className="text-[10px] font-mono text-rose-300">
              {editingError}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              aria-label={`Save Node ${node.id}`}
              className="px-2 py-1 rounded bg-brand-cyan text-slate-950 text-[10px] font-mono font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <IconCheck className="w-3 h-3" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              aria-label={`Cancel editing Node ${node.id}`}
              className="px-2 py-1 rounded bg-slate-800 text-slate-200 text-[10px] font-mono cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          tabIndex={0}
          aria-label={`Node ${node.id}, ${statusText}, ${node.label}, ${node.meaning}, ${node.type}, ${isSelected ? "selected" : "not selected"}`}
          aria-pressed={isSelected}
          aria-describedby="proof-node-keyboard-help"
          onClick={(event) => onNodeClick(node.id, event.shiftKey)}
          onKeyDown={(event) => {
            if (
              event.shiftKey &&
              (event.key === "Enter" || event.key === " ")
            ) {
              event.preventDefault();
              onNodeClick(node.id, true);
            }
          }}
          className="block w-full min-h-[44px] min-w-0 pr-5 text-left rounded-md cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
        >
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] leading-tight font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 text-slate-200">
              Node {node.id}
            </span>{" "}
            <span
              className={`text-[9px] leading-tight font-mono font-bold px-1.5 py-0.5 rounded ${
                isGivenPremise
                  ? "bg-slate-800 text-sky-300 border border-slate-600/50"
                  : isNodeProven
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-700/50"
                    : "bg-amber-950 text-amber-300 border border-amber-700/50"
              }`}
            >
              {statusText}
            </span>
          </div>{" "}
          <div className="min-w-0 break-words font-mono text-[13px] leading-snug font-bold text-white mb-0.5">
            {node.label}
          </div>{" "}
          <div className="text-[10px] leading-tight text-slate-300 line-clamp-2">
            {node.meaning}
          </div>
        </button>
      )}

      {/* Fallacy Counterexample Inline Visual Badge Indicator (placed after main node button to preserve primary Tab order) */}
      {isFallacyTargetNode && currentFallacy && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePopover(node.id);
          }}
          className="nodrag nopan absolute -top-3.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-rose-700 hover:bg-rose-600 text-white font-mono text-[9px] font-bold shadow-md shadow-rose-950/80 flex items-center gap-1 z-30 whitespace-nowrap cursor-pointer transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          aria-expanded={isPopoverOpen}
          aria-label={`Counterexample badge for Node ${node.id}. Click to view variable valuations.`}
        >
          <IconAlertTriangle className="w-2.5 h-2.5 shrink-0 text-amber-300 motion-safe:animate-pulse" />
          <span>Counterexample</span>
        </button>
      )}

      {/* Sandbox Node Edit / Delete Actions */}
      {isSandbox && !isEditing && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="nodrag nopan mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-end gap-1 pr-3"
        >
          {canEditSandboxNode && (
            <button
              type="button"
              onClick={() => onBeginEdit(node.id, node.label)}
              aria-label={`Edit Node ${node.id}`}
              className="p-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11 inline-flex items-center justify-center rounded text-slate-300 hover:text-brand-cyan hover:bg-slate-800 transition cursor-pointer"
            >
              <IconPencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDeleteSandboxNode && (
            <button
              type="button"
              onClick={() => onDeleteSandboxNode(node.id)}
              aria-label={`Delete Node ${node.id}`}
              className="p-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11 inline-flex items-center justify-center rounded text-slate-300 hover:text-rose-400 hover:bg-rose-950/60 transition cursor-pointer"
            >
              <IconTrash className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Right outbound connection source port (>= 44x44px hit target even under slight fitView zoom) */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectableEnd={false}
        className="!w-[56px] !h-[56px] !-right-[28px] !top-1/2 !-translate-y-1/2 !bg-transparent !border-0 flex items-center justify-center z-20"
      >
        <TooltipButton
          type="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onNodeClick(node.id);
          }}
          className="w-[54px] h-[54px] rounded-full flex items-center justify-center cursor-crosshair group/port focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          tooltip={`Connect Node ${node.id}: drag, or press Enter/Space then activate the target node`}
          aria-label={`Drag connection handle from Node ${node.id}, ${node.label}`}
        >
          <span className="w-6 h-6 rounded-full bg-slate-950 border-2 border-brand-cyan/90 group-hover/port:border-brand-cyan group-hover/port:scale-110 group-hover/port:bg-brand-cyan transition-all shadow-md shadow-cyan-500/40 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan group-hover/port:bg-slate-950" />
          </span>
        </TooltipButton>
      </Handle>

      {/* Fallacy Counterexample Diagnostics Popover */}
      {isPopoverOpen && currentFallacy && (
        <div
          role="dialog"
          aria-label={`Counterexample diagnostics popover for Node ${node.id}`}
          className="nodrag nopan absolute top-full mt-2 left-0 w-[268px] p-3 rounded-xl bg-slate-950/95 border border-rose-500/60 shadow-2xl shadow-rose-950/80 backdrop-blur z-50 text-xs text-slate-200 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-2">
            <div className="min-w-0 pr-2">
              <div className="font-mono font-bold text-rose-300 text-[11px] uppercase tracking-wide flex items-center gap-1">
                <IconAlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                <span className="truncate">{currentFallacy.fallacyName}</span>
              </div>
              <div className="font-mono text-[10px] text-slate-300 break-words">
                {currentFallacy.formalFormula}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClosePopover();
              }}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Close counterexample popover"
            >
              <IconX className="w-3.5 h-3.5" />
            </button>
          </div>

          {currentFallacy.counterexampleValuation && (
            <div className="mb-2">
              <div className="text-[10px] font-mono font-semibold text-amber-300 mb-1 uppercase tracking-wider">
                Counterexample Valuation:
              </div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                {Object.entries(currentFallacy.counterexampleValuation).map(
                  ([varName, val]) => (
                    <span
                      key={varName}
                      className={`px-1.5 py-0.5 rounded border font-bold ${
                        val
                          ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
                          : "bg-rose-950/80 border-rose-500/50 text-rose-300"
                      }`}
                    >
                      {varName} = {val ? "TRUE (1)" : "FALSE (0)"}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {currentFallacy.premises && currentFallacy.premises.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] font-mono font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                AST Sub-Expression Evaluations:
              </div>
              <div className="space-y-1 font-mono text-[10px]">
                {currentFallacy.premises.map((p, idx) => {
                  const evalVal = currentFallacy.counterexampleValuation
                    ? evaluateAst(p.ast, currentFallacy.counterexampleValuation)
                    : true;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-900/80 p-1 rounded border border-slate-800"
                    >
                      <span className="text-slate-200 truncate max-w-[175px]">
                        {p.label}
                      </span>
                      <span
                        className={`px-1 rounded text-[9px] font-bold ${
                          evalVal
                            ? "bg-emerald-900/60 text-emerald-300"
                            : "bg-rose-900/60 text-rose-300"
                        }`}
                      >
                        {evalVal ? "T" : "F"}
                      </span>
                    </div>
                  );
                })}
                {currentFallacy.conclusion &&
                  (() => {
                    const conclEval = currentFallacy.counterexampleValuation
                      ? evaluateAst(
                          currentFallacy.conclusion.ast,
                          currentFallacy.counterexampleValuation
                        )
                      : false;
                    return (
                      <div className="flex items-center justify-between bg-rose-950/40 p-1 rounded border border-rose-800/50">
                        <span className="text-rose-200 truncate max-w-[175px]">
                          {currentFallacy.conclusion.label}
                        </span>
                        <span
                          className={`px-1 rounded text-[9px] font-bold ${
                            conclEval
                              ? "bg-emerald-900/60 text-emerald-300"
                              : "bg-rose-900/60 text-rose-300"
                          }`}
                        >
                          {conclEval ? "T" : "F"}
                        </span>
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-300 line-clamp-2 border-t border-slate-800/80 pt-1.5">
            {currentFallacy.plainEnglish}
          </div>

          {(onRollback || onInspectFallacy) && (
            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              {onInspectFallacy && (
                <button
                  type="button"
                  onClick={() => {
                    onClosePopover();
                    onInspectFallacy();
                  }}
                  className="px-2 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-mono text-[10px] cursor-pointer"
                >
                  Truth Table
                </button>
              )}
              {onRollback && (
                <button
                  type="button"
                  onClick={() => {
                    onClosePopover();
                    onRollback();
                  }}
                  className="px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-mono font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                >
                  <IconRefresh className="w-3 h-3" />
                  <span>
                    {hasCommittedFallacyEdge
                      ? "Revert Edge"
                      : "Dismiss Fallacy"}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
