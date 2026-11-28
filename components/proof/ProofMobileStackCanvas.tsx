"use client";

import React, { useMemo } from "react";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconCheck,
  IconLink,
  IconPencil,
  IconRefresh,
  IconSparkles,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import {
  evaluateAst,
  evaluateProofStatus,
  getCompatibleTargets,
  type Edge,
  type FallacyDiagnosis,
  type ProofNode,
  type TheoremDefinition,
} from "@/lib/proof";
import { TooltipButton } from "@/components/ui/Tooltip";

interface ProofMobileStackCanvasProps {
  activeTheorem: TheoremDefinition;
  edges: Edge[];
  selectedNodeIds: string[];
  inspectedNodeId: string;
  currentFallacy?: FallacyDiagnosis | null;
  hasCommittedFallacyEdge?: boolean;
  activePopoverNodeId: string | null;
  setActivePopoverNodeId: React.Dispatch<React.SetStateAction<string | null>>;
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
  setActivePopoverNodeId,
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

    const statusText = isGivenPremise
      ? "GIVEN"
      : isNodeProven
        ? "PROVEN"
        : "PENDING";

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
        {editingNodeId === node.id && activeTheorem.isSandbox ? (
          <form
            onSubmit={(e) => onSubmitEdit(e, node.id)}
            className="space-y-2"
          >
            <div className="text-xs font-mono font-bold text-brand-cyan">
              Edit Node {node.id}
            </div>
            <input
              type="text"
              value={editingFormula}
              onChange={(e) => onChangeEditingFormula(e.target.value)}
              aria-label={`Edit formula for Node ${node.id}`}
              autoFocus
              className="w-full min-w-0 min-h-11 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-brand-cyan"
            />
            {editingError && (
              <p role="alert" className="text-xs font-mono text-rose-300">
                {editingError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                aria-label={`Save Node ${node.id}`}
                className="min-h-11 px-3 py-2 rounded-lg bg-brand-cyan text-slate-950 text-xs font-mono font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <IconCheck className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                aria-label={`Cancel editing Node ${node.id}`}
                className="min-h-11 px-3 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-mono cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-2.5 min-w-0">
            <button
              type="button"
              tabIndex={0}
              aria-label={`Node ${node.id}, ${statusText}, ${node.label}, ${node.meaning}, ${node.type}, ${isSelected ? "selected" : "not selected"}`}
              aria-pressed={isSelected}
              aria-describedby="proof-node-keyboard-help"
              onClick={(event) => handleNodeClick(node.id, event.shiftKey)}
              onKeyDown={(event) => {
                if (
                  event.shiftKey &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  handleNodeClick(node.id, true);
                }
              }}
              className="flex-1 min-w-0 min-h-11 text-left rounded-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span
                  className={`text-xs font-mono font-bold ${
                    isConclusion && !isNodeProven
                      ? "text-amber-300"
                      : isNodeProven && !isGivenPremise
                        ? "text-emerald-300"
                        : "text-slate-200"
                  }`}
                >
                  Node {node.id}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    isGivenPremise
                      ? "bg-slate-800 text-sky-300 border-slate-700"
                      : isNodeProven
                        ? "bg-emerald-950 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-950 text-amber-300 border-amber-500/40"
                  }`}
                >
                  {statusText}
                </span>
                {isConclusion && (
                  <span className="text-[10px] font-mono text-amber-300">
                    Proof Target
                  </span>
                )}
              </div>
              <div
                className={`w-full min-w-0 break-words font-mono text-base font-extrabold tracking-wide ${
                  isConclusion && !isNodeProven
                    ? "text-amber-300"
                    : isNodeProven && !isGivenPremise
                      ? "text-emerald-300"
                      : "text-cyan-300"
                }`}
              >
                {node.label}
              </div>
              <p className="text-xs text-slate-300 leading-snug mt-1 break-words">
                {node.meaning}
              </p>
            </button>

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
          </div>
        )}

        {/* Tap-to-Connect Compatible Target Action */}
        {compTarget && selectedNodeIds.length === 1 && (
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
        )}

        {/* Counterexample Disclosure Toggle + Drawer */}
        {isFallacyTargetNode && currentFallacy && (
          <div className="mt-2.5 pt-2 border-t border-rose-500/40 space-y-2">
            <button
              type="button"
              onClick={() =>
                setActivePopoverNodeId((prev) =>
                  prev === node.id ? null : node.id
                )
              }
              aria-expanded={isDrawerOpen}
              aria-label={`Counterexample badge for Node ${node.id}. Click to view variable valuations.`}
              className="w-full min-h-11 px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-mono text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <IconAlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
                <span className="truncate">Counterexample Valuation</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-rose-100 shrink-0">
                {isDrawerOpen ? "Hide" : "Inspect"}
              </span>
            </button>

            {isDrawerOpen && (
              <div
                role="dialog"
                aria-label={`Counterexample diagnostics popover for Node ${node.id}`}
                className="w-full p-3 rounded-xl bg-slate-950/95 border border-rose-500/60 text-xs text-slate-200 space-y-2"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-rose-300 text-xs break-words">
                      {currentFallacy.fallacyName}
                    </div>
                    <div className="font-mono text-[11px] text-slate-300 break-words">
                      {currentFallacy.formalFormula}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePopoverNodeId(null)}
                    aria-label="Close counterexample popover"
                    className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
                  >
                    <IconX className="w-4 h-4" />
                  </button>
                </div>

                {currentFallacy.counterexampleValuation && (
                  <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                    {Object.entries(currentFallacy.counterexampleValuation).map(
                      ([varName, val]) => (
                        <span
                          key={varName}
                          className={`px-2 py-0.5 rounded border font-bold ${
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
                )}

                {currentFallacy.premises &&
                  currentFallacy.premises.length > 0 && (
                    <div className="space-y-1 font-mono text-[11px]">
                      {currentFallacy.premises.map((p, idx) => {
                        const evalVal = currentFallacy.counterexampleValuation
                          ? evaluateAst(
                              p.ast,
                              currentFallacy.counterexampleValuation
                            )
                          : true;
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 bg-slate-900/80 p-1.5 rounded border border-slate-800 min-w-0"
                          >
                            <span className="text-slate-200 break-words min-w-0">
                              {p.label}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
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
                    </div>
                  )}

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {currentFallacy.plainEnglish}
                </p>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {onInspectFallacy && (
                    <button
                      type="button"
                      onClick={() => {
                        setActivePopoverNodeId(null);
                        onInspectFallacy();
                      }}
                      className="min-h-11 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 font-mono text-xs cursor-pointer"
                    >
                      Open Truth Table
                    </button>
                  )}
                  {handleRollback && (
                    <button
                      type="button"
                      onClick={() => {
                        setActivePopoverNodeId(null);
                        handleRollback();
                      }}
                      className="min-h-11 px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-mono font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <IconRefresh className="w-3.5 h-3.5" />
                      <span>
                        {hasCommittedFallacyEdge
                          ? "Revert Edge"
                          : "Dismiss Fallacy"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sandbox Node Inline Controls */}
        {activeTheorem.isSandbox && editingNodeId !== node.id && (
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-end gap-2">
            {(node.type === "premise" || node.type === "conclusion") &&
              onUpdateSandboxNode && (
                <button
                  type="button"
                  onClick={() => onBeginEdit(node.id, node.label)}
                  aria-label={`Edit Node ${node.id}`}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-brand-cyan hover:bg-slate-800 transition cursor-pointer"
                >
                  <IconPencil className="w-4 h-4" />
                </button>
              )}
            {onDeleteSandboxNode && (
              <button
                type="button"
                onClick={() => onDeleteSandboxNode(node.id)}
                aria-label={`Delete Node ${node.id}`}
                className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-950/60 transition cursor-pointer"
              >
                <IconTrash className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
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
