"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { IconAlertTriangle, IconSparkles } from "@tabler/icons-react";
import { type FallacyDiagnosis, type ProofNode } from "@/lib/proof";
import { TooltipButton } from "@/components/ui/Tooltip";
import { ProofNodeBody } from "./ProofNodeBody";

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
  onClosePopover: (nodeId: string, restoreFocus?: boolean) => void;
  onRegisterPopoverToggle?: (
    nodeId: string,
    element: HTMLButtonElement | null
  ) => void;
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
    onRegisterPopoverToggle,
    onBeginEdit,
    onChangeEditingFormula,
    onSubmitEdit,
    onCancelEdit,
    onDeleteSandboxNode,
    onRollback,
    onInspectFallacy,
  } = data;

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

      <ProofNodeBody
        variant="flow"
        node={node}
        isSelected={isSelected}
        isGivenPremise={isGivenPremise}
        isNodeProven={isNodeProven}
        isFallacyTargetNode={isFallacyTargetNode}
        currentFallacy={currentFallacy}
        hasCommittedFallacyEdge={hasCommittedFallacyEdge}
        isPopoverOpen={isPopoverOpen}
        isSandbox={isSandbox}
        isEditing={isEditing}
        editingFormula={editingFormula}
        editingError={editingError}
        canEditSandboxNode={canEditSandboxNode}
        onNodeClick={onNodeClick}
        onTogglePopover={onTogglePopover}
        onClosePopover={onClosePopover}
        onRegisterPopoverToggle={onRegisterPopoverToggle}
        onBeginEdit={onBeginEdit}
        onChangeEditingFormula={onChangeEditingFormula}
        onSubmitEdit={onSubmitEdit}
        onCancelEdit={onCancelEdit}
        onDeleteSandboxNode={onDeleteSandboxNode}
        onRollback={onRollback}
        onInspectFallacy={onInspectFallacy}
      />

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
    </div>
  );
}
