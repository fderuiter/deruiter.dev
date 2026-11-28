"use client";

import React, { useMemo } from "react";
import {
  IconArrowDown,
  IconLink,
  IconSparkles,
  IconUpload,
} from "@tabler/icons-react";
import {
  evaluateProofStatus,
  getCompatibleTargets,
  type Edge,
  type FallacyDiagnosis,
  type ProofNode,
  type TheoremDefinition,
} from "@/lib/proof";
import { TooltipButton } from "@/components/ui/Tooltip";
import { ProofNodeBody } from "./ProofNodeBody";

interface ProofMobileStackCanvasProps {
  activeTheorem: TheoremDefinition;
  edges: Edge[];
  selectedNodeIds: string[];
  inspectedNodeId: string;
  currentFallacy?: FallacyDiagnosis | null;
  hasCommittedFallacyEdge?: boolean;
  activePopoverNodeId: string | null;
  onTogglePopover: (nodeId: string) => void;
  onClosePopover: (nodeId: string, restoreFocus?: boolean) => void;
  onRegisterPopoverToggle: (
    nodeId: string,
    element: HTMLButtonElement | null
  ) => void;
  editingNodeId: string | null;
  editingFormula: string;
  editingError: string | null;
  onBeginEdit: (nodeId: string, currentLabel: string) => void;
  onChangeEditingFormula: (value: string) => void;
  onSubmitEdit: (e: React.FormEvent, nodeId: string) => void;
  onCancelEdit: () => void;
  onUpdateSandboxNode?: (
    nodeId: string,
    formula: string
  ) => { ok: boolean; error?: string };
  onDeleteSandboxNode?: (nodeId: string) => void;
  onLoadSandboxStarter?: () => void;
  onOpenImportExport?: () => void;
  handleNodeClick: (id: string, addToSelection?: boolean) => void;
  onConnectNodes?: (
    sourceId: string,
    targetId: string,
    ruleBadge?: string
  ) => void;
  handleAutoStep: () => void;
  handleRollback?: () => void;
  onInspectFallacy?: () => void;
}

type StageGrouping = {
  stage1: ProofNode[];
  stage2: ProofNode[];
  stage3: ProofNode[];
};

function groupTopologicalStages(theorem: TheoremDefinition): StageGrouping {
  if (theorem.isSandbox) {
    return {
      stage1: theorem.nodes.filter((n) => n.type === "premise"),
      stage2: theorem.nodes.filter((n) => n.type === "intermediate"),
      stage3: theorem.nodes.filter((n) => n.type === "conclusion"),
    };
  }

  const intermediateId = theorem.intermediateNodeId;
  const targetId = theorem.targetNodeId;
  const stage1PremiseIds = new Set(
    theorem.validPairs
      .filter(([, target]) => target === intermediateId)
      .map(([source]) => source)
  );

  const stage1: ProofNode[] = [];
  const stage2: ProofNode[] = [];
  const stage3: ProofNode[] = [];

  for (const node of theorem.nodes) {
    if (node.id === targetId || node.type === "conclusion") {
      stage3.push(node);
    } else if (
      node.id === intermediateId ||
      node.type === "intermediate" ||
      (node.type === "premise" &&
        stage1PremiseIds.size > 0 &&
        !stage1PremiseIds.has(node.id))
    ) {
      stage2.push(node);
    } else {
      stage1.push(node);
    }
  }

  return { stage1, stage2, stage3 };
}

export function ProofMobileStackCanvas({
  activeTheorem,
  edges,
  selectedNodeIds,
  inspectedNodeId,
  currentFallacy,
  hasCommittedFallacyEdge = false,
  activePopoverNodeId,
  onTogglePopover,
  onClosePopover,
  onRegisterPopoverToggle,
  editingNodeId,
  editingFormula,
  editingError,
  onBeginEdit,
  onChangeEditingFormula,
  onSubmitEdit,
  onCancelEdit,
  onUpdateSandboxNode,
  onDeleteSandboxNode,
  onLoadSandboxStarter,
  onOpenImportExport,
  handleNodeClick,
  onConnectNodes,
  handleAutoStep,
  handleRollback,
  onInspectFallacy,
}: ProofMobileStackCanvasProps) {
  const proofStatus = useMemo(
    () => evaluateProofStatus(edges, activeTheorem),
    [edges, activeTheorem]
  );

  const sandboxProvenSet = useMemo(
    () =>
      activeTheorem.isSandbox ? new Set(proofStatus.provenNodeIds ?? []) : null,
    [activeTheorem.isSandbox, proofStatus.provenNodeIds]
  );

  const compatibleTargets = useMemo(
    () =>
      selectedNodeIds.length === 1
        ? getCompatibleTargets(selectedNodeIds[0], activeTheorem, edges)
        : [],
    [selectedNodeIds, activeTheorem, edges]
  );

  const stages = useMemo(
    () => groupTopologicalStages(activeTheorem),
    [activeTheorem]
  );

  const stage1DerivedRule = useMemo(() => {
    const cEdge = edges.find(
      (e) => e.target === activeTheorem.intermediateNodeId && e.ruleApplied
    );
    if (cEdge?.ruleApplied) return cEdge.ruleApplied;
    return activeTheorem.ruleName.split("(")[0].trim() || "Deduction";
  }, [edges, activeTheorem.intermediateNodeId, activeTheorem.ruleName]);

  const guidedQuickConnect = useMemo(() => {
    if (activeTheorem.isSandbox || proofStatus.isE_Proven) return null;
    if (!proofStatus.isC_Proven && activeTheorem.intermediateNodeId) {
      const reqs = activeTheorem.validPairs
        .filter(([, tgt]) => tgt === activeTheorem.intermediateNodeId)
        .map(([src]) => src);
      if (reqs.length > 0) {
        return {
          label: `Connect ${reqs.join(" + ")} → Node ${activeTheorem.intermediateNodeId}`,
          pairs: reqs.map(
            (src) => [src, activeTheorem.intermediateNodeId] as const
          ),
        };
      }
    }
    if (proofStatus.isC_Proven && activeTheorem.targetNodeId) {
      const reqs = activeTheorem.validPairs
        .filter(([, tgt]) => tgt === activeTheorem.targetNodeId)
        .map(([src]) => src);
      if (reqs.length > 0) {
        return {
          label: `Connect ${reqs.join(" + ")} → Node ${activeTheorem.targetNodeId}`,
          pairs: reqs.map((src) => [src, activeTheorem.targetNodeId] as const),
        };
      }
    }
    return null;
  }, [
    activeTheorem.isSandbox,
    activeTheorem.intermediateNodeId,
    activeTheorem.targetNodeId,
    activeTheorem.validPairs,
    proofStatus.isC_Proven,
    proofStatus.isE_Proven,
  ]);

  const handleQuickConnect = () => {
    if (!guidedQuickConnect) return;
    if (onConnectNodes) {
      for (const [sourceId, targetId] of guidedQuickConnect.pairs) {
        const exists = edges.some(
          (e) => e.source === sourceId && e.target === targetId
        );
        if (!exists) {
          onConnectNodes(sourceId, targetId);
        }
      }
      return;
    }
    handleAutoStep();
  };

  if (activeTheorem.isSandbox && activeTheorem.nodes.length === 0) {
    return (
      <div className="w-full p-4" data-testid="proof-mobile-topological-stack">
        <div className="w-full rounded-2xl border border-slate-800 bg-slate-950/90 p-5 text-center shadow-xl space-y-3">
          <div className="text-sm font-bold text-white">
            Open Sandbox Proof Stack
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Enter propositional formulas above to add premise and conclusion
            cards into the vertical topological stack.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {onLoadSandboxStarter && (
              <button
                type="button"
                onClick={onLoadSandboxStarter}
                className="min-h-11 px-3 py-2 rounded-lg border border-brand-cyan/50 bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan text-xs font-mono font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <IconSparkles className="w-4 h-4" />
                <span>Load Starter Example</span>
              </button>
            )}
            {onOpenImportExport && (
              <button
                type="button"
                onClick={onOpenImportExport}
                className="min-h-11 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-mono font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <IconUpload className="w-4 h-4 text-brand-cyan" />
                <span>Import .proof.json</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const renderStageCard = (node: ProofNode) => {
    const isSelected = selectedNodeIds.includes(node.id);
    const isInspected = inspectedNodeId === node.id;
    const isGivenPremise = node.type === "premise";
    const isConclusion = node.type === "conclusion";
    const isNodeProven = sandboxProvenSet
      ? sandboxProvenSet.has(node.id)
      : isGivenPremise ||
        (node.id === activeTheorem.intermediateNodeId
          ? proofStatus.isC_Proven
          : proofStatus.isE_Proven);

    const compTarget = compatibleTargets.find((t) => t.targetId === node.id);
    const fallacyTargetId = currentFallacy?.targetId;
    const isFallacyTargetNode = Boolean(
      currentFallacy &&
      (fallacyTargetId
        ? node.id === fallacyTargetId
        : node.id === activeTheorem.targetNodeId)
    );
    const isDrawerOpen = activePopoverNodeId === node.id;

    return (
      <div
        key={node.id}
        data-testid={`mobile-proof-node-${node.id}`}
        className={`w-full min-w-0 rounded-xl p-3 transition shadow-md ${
          isFallacyTargetNode
            ? "bg-rose-950/55 border border-rose-500/80 ring-1 ring-rose-500/60"
            : compTarget
              ? "bg-emerald-950/45 border border-emerald-400/80 ring-1 ring-emerald-400/50"
              : isSelected
                ? "bg-cyan-950/45 border border-brand-cyan ring-2 ring-brand-cyan/60"
                : isConclusion && !isNodeProven
                  ? "bg-[#191b22] border-2 border-dashed border-amber-500/70"
                  : isNodeProven && !isGivenPremise
                    ? "bg-[#132422] border border-emerald-500/60"
                    : isInspected
                      ? "bg-[#17202b] border border-slate-600"
                      : "bg-[#151c24] border border-[#232f3e]"
        }`}
      >
        <ProofNodeBody
          variant="stack"
          node={node}
          isSelected={isSelected}
          isGivenPremise={isGivenPremise}
          isNodeProven={isNodeProven}
          isFallacyTargetNode={isFallacyTargetNode}
          currentFallacy={currentFallacy ?? null}
          hasCommittedFallacyEdge={hasCommittedFallacyEdge}
          isPopoverOpen={isDrawerOpen}
          isSandbox={Boolean(activeTheorem.isSandbox)}
          isEditing={editingNodeId === node.id}
          editingFormula={editingNodeId === node.id ? editingFormula : ""}
          editingError={editingNodeId === node.id ? editingError : null}
          canEditSandboxNode={Boolean(
            (node.type === "premise" || node.type === "conclusion") &&
            onUpdateSandboxNode
          )}
          onNodeClick={handleNodeClick}
          onTogglePopover={onTogglePopover}
          onClosePopover={onClosePopover}
          onRegisterPopoverToggle={onRegisterPopoverToggle}
          onBeginEdit={onBeginEdit}
          onChangeEditingFormula={onChangeEditingFormula}
          onSubmitEdit={onSubmitEdit}
          onCancelEdit={onCancelEdit}
          onDeleteSandboxNode={onDeleteSandboxNode}
          onRollback={handleRollback}
          onInspectFallacy={onInspectFallacy}
          trailingAction={
            <TooltipButton
              type="button"
              tabIndex={0}
              onClick={() => handleNodeClick(node.id)}
              className={`w-11 h-11 min-w-11 min-h-11 shrink-0 rounded-xl border flex items-center justify-center transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                isSelected
                  ? "bg-brand-cyan text-slate-950 border-brand-cyan shadow-md shadow-cyan-500/30"
                  : compTarget
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400"
                    : "bg-slate-950 text-brand-cyan border-slate-700 hover:border-brand-cyan"
              }`}
              tooltip={`Connect Node ${node.id}: tap or press Enter/Space then select target`}
              aria-label={`Drag connection handle from Node ${node.id}, ${node.label}`}
            >
              <IconLink className="w-4 h-4" />
            </TooltipButton>
          }
          afterMainContent={
            compTarget && selectedNodeIds.length === 1 ? (
              <div className="mt-2.5 pt-2 border-t border-emerald-500/30">
                <button
                  type="button"
                  onClick={() => handleNodeClick(node.id)}
                  className="w-full min-h-11 px-3 py-2 rounded-lg bg-emerald-950/90 hover:bg-emerald-900/80 border border-emerald-400/70 text-emerald-200 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <IconSparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span className="min-w-0 break-words">
                    Tap to Connect Node {selectedNodeIds[0]} → Node {node.id} (
                    {compTarget.badgeLabel})
                  </span>
                </button>
              </div>
            ) : null
          }
        />
      </div>
    );
  };

  return (
    <div
      className="w-full p-3 space-y-3 bg-[#080c10]"
      data-testid="proof-mobile-topological-stack"
    >
      {/* STAGE 1: GIVEN PREMISES */}
      {stages.stage1.length > 0 && (
        <section
          aria-label="Stage 1 Given Premises"
          className="space-y-2"
          data-testid="proof-mobile-stage-1"
        >
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
            <h2 className="text-[11px] font-mono font-bold tracking-wider text-slate-300 uppercase">
              STAGE 1 · GIVEN PREMISES
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {stages.stage1.map(renderStageCard)}
          </div>
        </section>
      )}

      {/* Stage 1 -> Stage 2 Topological Derivation Pill */}
      {stages.stage1.length > 0 && stages.stage2.length > 0 && (
        <div className="flex justify-center py-0.5" aria-hidden="true">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono font-bold ${
              proofStatus.isC_Proven
                ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-sm shadow-emerald-950"
                : "bg-slate-900/90 border-slate-700 text-slate-300"
            }`}
          >
            {proofStatus.isC_Proven ? (
              <>
                <span>✔</span>
                <span>{stage1DerivedRule}</span>
                <IconArrowDown className="w-3.5 h-3.5 text-emerald-300" />
              </>
            ) : (
              <>
                <IconArrowDown className="w-3.5 h-3.5 text-cyan-300" />
                <span>
                  {activeTheorem.intermediateNodeId
                    ? `Derive Node ${activeTheorem.intermediateNodeId}`
                    : "Intermediate Stage"}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* STAGE 2: INTERMEDIATE & PREMISE */}
      {stages.stage2.length > 0 && (
        <section
          aria-label="Stage 2 Intermediate Lemma and Premise"
          className="space-y-2"
          data-testid="proof-mobile-stage-2"
        >
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <h2 className="text-[11px] font-mono font-bold tracking-wider text-slate-300 uppercase">
              STAGE 2 · INTERMEDIATE &amp; PREMISE
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {stages.stage2.map(renderStageCard)}
          </div>
        </section>
      )}

      {/* Stage 2 -> Stage 3 Topological Derivation Pill */}
      {stages.stage3.length > 0 &&
        (stages.stage2.length > 0 || stages.stage1.length > 0) && (
          <div className="flex justify-center py-0.5" aria-hidden="true">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono font-bold ${
                proofStatus.isE_Proven
                  ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-300"
                  : "bg-slate-900/90 border-slate-700 text-slate-300"
              }`}
            >
              <IconArrowDown className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {proofStatus.isE_Proven
                  ? "Q.E.D. Discharged"
                  : activeTheorem.targetNodeId
                    ? `Discharge Node ${activeTheorem.targetNodeId}`
                    : "Target Conclusion"}
              </span>
            </div>
          </div>
        )}

      {/* STAGE 3: TARGET CONCLUSION */}
      {stages.stage3.length > 0 && (
        <section
          aria-label="Stage 3 Target Conclusion"
          className="space-y-2.5"
          data-testid="proof-mobile-stage-3"
        >
          <div className="flex items-center gap-1.5 px-0.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <h2 className="text-[11px] font-mono font-bold tracking-wider text-slate-300 uppercase">
              STAGE 3 · TARGET CONCLUSION
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {stages.stage3.map(renderStageCard)}
          </div>

          {/* Primary Guided Tap-to-Connect Action (placed after Node E in DOM order so initial Tab 1..10 reaches all nodes first) */}
          {guidedQuickConnect && (
            <button
              type="button"
              onClick={handleQuickConnect}
              className="w-full min-h-11 py-2.5 px-3 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/70 border border-cyan-400/80 text-cyan-200 text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-md shadow-cyan-950/50 active:scale-[0.99] transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <IconLink className="w-4 h-4 text-cyan-300 shrink-0" />
              <span className="min-w-0 break-words">
                {guidedQuickConnect.label}
              </span>
            </button>
          )}
        </section>
      )}
    </div>
  );
}
