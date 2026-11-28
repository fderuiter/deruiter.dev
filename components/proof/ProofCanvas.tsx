"use client";

import React, { RefObject, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import {
  IconRefresh,
  IconBulb,
  IconSparkles,
  IconAlertTriangle,
  IconPlayerPlay,
  IconWand,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconPlus,
  IconTarget,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  TheoremDefinition,
  Edge,
  AlignmentGuide,
  INFERENCE_RULES,
  FallacyDiagnosis,
  RuleMatch,
} from "@/lib/proof";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { TooltipButton } from "@/components/ui/Tooltip";
import { ProofMobileStackCanvas } from "./ProofMobileStackCanvas";

const emptySubscribe = () => () => {};

function ProofCanvasSurfaceSkeleton() {
  return (
    <div
      data-testid="proof-canvas-surface-skeleton"
      className="relative w-full h-full min-h-[760px] md:min-h-[520px] flex items-center justify-center"
    >
      <div className="text-slate-400 font-mono text-xs flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-slate-800 border-t-brand-cyan rounded-full motion-safe:animate-spin" />
        <span>Preparing Proof Canvas...</span>
      </div>
    </div>
  );
}

const DynamicProofFlowCanvas = dynamic(
  () => import("./ProofFlowCanvas").then((mod) => mod.ProofFlowCanvas),
  {
    ssr: false,
    loading: () => <ProofCanvasSurfaceSkeleton />,
  }
);

interface ProofCanvasProps {
  activeTheorem: TheoremDefinition;
  edges: Edge[];
  nodeOffsets: Record<string, { x: number; y: number }>;
  selectedNodeIds: string[];
  inspectedNodeId: string;
  isSnappingEnabled: boolean;
  activeGuides: AlignmentGuide[];
  dragConnection: {
    sourceId: string;
    sourceX: number;
    sourceY: number;
    currentX: number;
    currentY: number;
    hoveredTargetId: string | null;
    isValid: boolean;
    ruleBadge?: string;
  } | null;
  isSimulating: boolean;
  simulationProgress: { step: number; total: number; log: string } | null;
  toggleSnapping: () => void;
  handleAutoStep: () => void;
  handleResetLayout: () => void;
  activeTacticHint: { title: string; hint: string };
  handleNodePointerDown: (e: React.PointerEvent, id: string) => void;
  handleNodePointerMove: (e: React.PointerEvent, id: string) => void;
  handleNodePointerUp: (e: React.PointerEvent, id: string) => void;
  handleNodeClick: (id: string, addToSelection?: boolean) => void;
  handleHandlePointerDown: (e: React.PointerEvent, id: string) => void;
  handleCanvasPointerMove: (e: React.PointerEvent) => void;
  handleCanvasPointerUp: (e: React.PointerEvent) => void;
  handleApplyRule: (ruleId: string) => void;
  handleStartSimulation: (mode?: "normal" | "loop") => void;
  handleUndo?: () => void;
  handleRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canvasWrapperRef: RefObject<HTMLDivElement | null>;
  svgCanvasRef: RefObject<SVGSVGElement | null>;
  mobileActiveView: "canvas" | "ledger" | "systems" | "fallacy" | "terminal";
  currentFallacy?: FallacyDiagnosis | null;
  hasCommittedFallacyEdge?: boolean;
  handleRollback?: () => void;
  onDismissFallacy?: () => void;
  onInspectFallacy?: () => void;
  onConnectNodes?: (
    sourceId: string,
    targetId: string,
    ruleBadge?: string
  ) => void;
  onRejectConnection?: (sourceId: string, targetId: string) => void;
  onCommitNodeMove?: (nodeId: string, x: number, y: number) => void;
  ruleMatches?: RuleMatch[];
  onAddSandboxNode?: (
    role: "premise" | "conclusion",
    formula: string
  ) => { ok: boolean; error?: string; nodeId?: string };
  onUpdateSandboxNode?: (
    nodeId: string,
    formula: string
  ) => { ok: boolean; error?: string };
  onDeleteSandboxNode?: (nodeId: string) => void;
  onClearSandbox?: () => void;
  onLoadSandboxStarter?: () => void;
  onCheckCountermodel?: () => void;
  onOpenImportExport?: () => void;
}

export const ProofCanvas: React.FC<ProofCanvasProps> = ({
  activeTheorem,
  edges,
  nodeOffsets,
  selectedNodeIds,
  inspectedNodeId,
  isSnappingEnabled,
  activeGuides,
  dragConnection,
  isSimulating,
  simulationProgress,
  toggleSnapping,
  handleAutoStep,
  handleResetLayout,
  activeTacticHint,
  handleNodeClick,
  handleCanvasPointerMove,
  handleCanvasPointerUp,
  handleApplyRule,
  handleStartSimulation,
  handleUndo = () => {},
  handleRedo = () => {},
  canUndo = false,
  canRedo = false,
  canvasWrapperRef,
  svgCanvasRef,
  mobileActiveView,
  currentFallacy,
  hasCommittedFallacyEdge = false,
  handleRollback,
  onDismissFallacy,
  onInspectFallacy,
  onConnectNodes,
  onRejectConnection,
  onCommitNodeMove,
  ruleMatches,
  onAddSandboxNode,
  onUpdateSandboxNode,
  onDeleteSandboxNode,
  onClearSandbox,
  onLoadSandboxStarter,
  onCheckCountermodel,
  onOpenImportExport,
}) => {
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const isMobileStack = useMediaQuery("(max-width: 767px)");
  const [containerWidth, setContainerWidth] = React.useState<number>(760);
  const [activePopoverNodeId, setActivePopoverNodeId] = React.useState<
    string | null
  >(null);
  const counterexampleToggleRefs = React.useRef<Map<string, HTMLButtonElement>>(
    new Map()
  );
  const [draftFormula, setDraftFormula] = React.useState("");
  const [draftError, setDraftError] = React.useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = React.useState<string | null>(null);
  const [editingFormula, setEditingFormula] = React.useState("");
  const [editingError, setEditingError] = React.useState<string | null>(null);
  const formulaInputRef = React.useRef<HTMLInputElement>(null);

  const submitSandboxNode = (role: "premise" | "conclusion") => {
    if (!onAddSandboxNode) return;
    if (!draftFormula.trim()) {
      setDraftError(
        "Enter a formula (for example, P -> Q) before adding a node."
      );
      formulaInputRef.current?.focus();
      return;
    }
    const res = onAddSandboxNode(role, draftFormula);
    if (!res.ok) {
      setDraftError(res.error ?? "Invalid formula.");
      return;
    }
    setDraftFormula("");
    setDraftError(null);
    formulaInputRef.current?.focus();
  };

  const beginNodeEdit = React.useCallback(
    (nodeId: string, currentLabel: string) => {
      setEditingNodeId(nodeId);
      setEditingFormula(currentLabel);
      setEditingError(null);
    },
    []
  );

  const handleChangeEditingFormula = React.useCallback((value: string) => {
    setEditingFormula(value);
    setEditingError(null);
  }, []);

  const cancelNodeEdit = React.useCallback(() => {
    setEditingNodeId(null);
    setEditingError(null);
  }, []);

  const submitNodeEdit = React.useCallback(
    (e: React.FormEvent, nodeId: string) => {
      e.preventDefault();
      if (!onUpdateSandboxNode) return;
      const res = onUpdateSandboxNode(nodeId, editingFormula);
      if (!res.ok) {
        setEditingError(res.error ?? "Invalid formula.");
        return;
      }
      setEditingNodeId(null);
      setEditingFormula("");
      setEditingError(null);
    },
    [onUpdateSandboxNode, editingFormula]
  );

  const registerPopoverToggle = React.useCallback(
    (nodeId: string, element: HTMLButtonElement | null) => {
      if (element) {
        counterexampleToggleRefs.current.set(nodeId, element);
      } else {
        counterexampleToggleRefs.current.delete(nodeId);
      }
    },
    []
  );

  const restorePopoverToggleFocus = React.useCallback((nodeId: string) => {
    const toggle = counterexampleToggleRefs.current.get(nodeId);
    if (!toggle) return;
    toggle.focus();
    queueMicrotask(() => {
      if (toggle.isConnected && document.activeElement !== toggle) {
        toggle.focus();
      }
    });
  }, []);

  const handleTogglePopover = React.useCallback((nodeId: string) => {
    setActivePopoverNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleClosePopover = React.useCallback(
    (nodeId: string, restoreFocus = true) => {
      setActivePopoverNodeId(null);
      if (restoreFocus) {
        restorePopoverToggleFocus(nodeId);
      }
    },
    [restorePopoverToggleFocus]
  );

  React.useEffect(() => {
    if (!activePopoverNodeId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const targetNodeId = activePopoverNodeId;
      setActivePopoverNodeId(null);
      restorePopoverToggleFocus(targetNodeId);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePopoverNodeId, restorePopoverToggleFocus]);

  const handleRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        const prevEl = canvasWrapperRef.current;
        if (
          prevEl &&
          prevEl !== node &&
          prevEl.clientWidth > 0 &&
          node.clientWidth === 0
        ) {
          Object.defineProperty(node, "clientWidth", {
            value: prevEl.clientWidth,
            configurable: true,
          });
        }
        (
          canvasWrapperRef as React.MutableRefObject<HTMLDivElement | null>
        ).current = node;
        const w = node.clientWidth || node.getBoundingClientRect().width;
        if (w > 0) {
          setContainerWidth(Math.floor(w));
        }
      }
    },
    [canvasWrapperRef]
  );

  React.useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w > 0) {
        setContainerWidth(Math.floor(w));
      }
    };

    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width || el.clientWidth;
          if (w > 0) {
            setContainerWidth(Math.floor(w));
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [canvasWrapperRef]);

  return (
    <div
      className={`lg:col-span-8 flex flex-col gap-4 ${
        mobileActiveView === "canvas" ? "flex" : "hidden lg:flex"
      }`}
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden flex flex-col shadow-2xl relative">
        {/* Canvas Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-950/40">
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 shrink-0 motion-safe:animate-ping" />
            <span className="text-xs font-semibold text-white truncate">
              {activeTheorem.ruleName}
            </span>
          </div>
          <div
            role="toolbar"
            aria-label="Proof canvas controls"
            className="flex flex-wrap items-center gap-2"
          >
            {(!isHydrated || !isMobileStack) && (
              <TooltipButton
                onClick={toggleSnapping}
                className={`hidden md:flex px-2.5 py-1.5 pointer-coarse:min-h-11 rounded-lg border text-xs font-mono items-center gap-1.5 transition cursor-pointer active:scale-[0.98] ${
                  isSnappingEnabled
                    ? "bg-brand-cyan/15 border-brand-cyan/50 text-brand-cyan shadow-sm shadow-cyan-500/20"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
                tooltip="Toggle magnetic snapping & alignment guides [Shortcut: G]"
                aria-pressed={isSnappingEnabled}
                aria-label={`SNAP G, Magnetic Snapping: ${isSnappingEnabled ? "Enabled" : "Disabled"}. Press G to toggle.`}
              >
                <span className="text-[11px] font-bold">SNAP</span>{" "}
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSnappingEnabled
                      ? "bg-emerald-400 motion-safe:animate-pulse"
                      : "bg-slate-600"
                  }`}
                />
                <kbd className="hidden md:inline text-[9px] px-1 py-0.2 rounded bg-slate-950/70 border border-slate-800 text-slate-400 font-mono">
                  G
                </kbd>
              </TooltipButton>
            )}
            <TooltipButton
              onClick={handleUndo}
              disabled={!canUndo}
              className={`p-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 inline-flex items-center justify-center rounded-lg border text-xs font-mono transition cursor-pointer active:scale-[0.98] ${
                canUndo
                  ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                  : "bg-slate-950/40 border-slate-800/50 text-slate-600 cursor-not-allowed opacity-50"
              }`}
              tooltip="Undo proof step [Shortcut: Mod+Z]"
              aria-label="Undo proof step"
              aria-keyshortcuts="Meta+Z Control+Z"
            >
              <IconArrowBackUp className="w-4 h-4" />
            </TooltipButton>
            <TooltipButton
              onClick={handleRedo}
              disabled={!canRedo}
              className={`p-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 inline-flex items-center justify-center rounded-lg border text-xs font-mono transition cursor-pointer active:scale-[0.98] ${
                canRedo
                  ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                  : "bg-slate-950/40 border-slate-800/50 text-slate-600 cursor-not-allowed opacity-50"
              }`}
              tooltip="Redo proof step [Shortcut: Mod+Shift+Z]"
              aria-label="Redo proof step"
              aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
            >
              <IconArrowForwardUp className="w-4 h-4" />
            </TooltipButton>
            <TooltipButton
              onClick={handleAutoStep}
              className="px-2.5 py-1.5 pointer-coarse:min-h-11 rounded-lg bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-xs font-mono flex items-center gap-1 transition cursor-pointer active:scale-[0.98]"
              tooltip="Advance next valid deduction step"
            >
              <IconWand className="w-3.5 h-3.5" />
              Auto-Step
            </TooltipButton>
            <TooltipButton
              onClick={handleResetLayout}
              className="p-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer active:scale-[0.98]"
              tooltip="Reset node positions & connections"
              aria-label="Reset node positions and connections"
            >
              <IconRefresh className="w-4 h-4" />
            </TooltipButton>
          </div>
        </div>

        {/* Tactic Goal Ribbon */}
        <div className="bg-slate-950/60 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between gap-2 text-xs">
          <div className="flex min-w-0 items-start sm:items-center gap-2 text-slate-300">
            <IconBulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0">
              <span className="font-medium text-amber-300/90 mr-1.5">
                {activeTacticHint.title}:
              </span>
              <span className="text-slate-300 break-words">
                {activeTacticHint.hint}
              </span>
            </div>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
            {activeTheorem.targetNodeId
              ? `Goal: Node ${activeTheorem.targetNodeId}`
              : activeTheorem.isSandbox
                ? "Open Sandbox"
                : "Goal"}
          </span>
        </div>

        {/* Sandbox Authoring Controls */}
        {activeTheorem.isSandbox && (
          <div
            role="region"
            aria-label="Sandbox node authoring"
            className="px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/90 flex flex-col gap-2"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <input
                ref={formulaInputRef}
                type="text"
                value={draftFormula}
                onChange={(e) => {
                  setDraftFormula(e.target.value);
                  if (draftError) setDraftError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitSandboxNode(e.shiftKey ? "conclusion" : "premise");
                  }
                }}
                aria-label="Sandbox formula"
                placeholder="Formula (e.g. P -> Q, ~(A & B), R)"
                className="min-w-0 flex-1 basis-48 px-3 py-1.5 pointer-coarse:min-h-11 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-cyan"
              />
              <button
                type="button"
                onClick={() => submitSandboxNode("premise")}
                className="px-2.5 py-1.5 pointer-coarse:min-h-11 rounded-lg border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-xs font-mono font-bold inline-flex items-center gap-1 transition cursor-pointer active:scale-[0.98]"
              >
                <IconPlus className="w-3.5 h-3.5" />
                <span>Add Premise</span>
              </button>
              <button
                type="button"
                onClick={() => submitSandboxNode("conclusion")}
                className="px-2.5 py-1.5 pointer-coarse:min-h-11 rounded-lg border border-indigo-400/50 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 text-xs font-mono font-bold inline-flex items-center gap-1 transition cursor-pointer active:scale-[0.98]"
              >
                <IconTarget className="w-3.5 h-3.5" />
                <span>Add Goal</span>
              </button>
              {onCheckCountermodel && (
                <button
                  type="button"
                  onClick={onCheckCountermodel}
                  className="px-2.5 py-1.5 pointer-coarse:min-h-11 rounded-lg border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-mono font-bold inline-flex items-center gap-1 transition cursor-pointer active:scale-[0.98]"
                >
                  <IconAlertTriangle className="w-3.5 h-3.5" />
                  <span>Check Countermodel</span>
                </button>
              )}
              {activeTheorem.nodes.length > 0 && onClearSandbox && (
                <button
                  type="button"
                  onClick={onClearSandbox}
                  className="px-2.5 py-1.5 pointer-coarse:min-h-11 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-mono inline-flex items-center gap-1 transition cursor-pointer active:scale-[0.98]"
                >
                  <IconTrash className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
            {draftError && (
              <p
                role="alert"
                className="text-xs font-mono text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-lg px-2.5 py-1.5"
              >
                {draftError}
              </p>
            )}
          </div>
        )}

        <p
          id="proof-node-keyboard-help"
          className="px-4 py-2 text-xs text-slate-300 border-b border-slate-800/60"
        >
          Tab to a node. Enter or Space selects it; activate another node to
          connect. Hold Shift while activating nodes to select several premises
          for a rule. Connection handles also support Enter or Space. Use Mod+Z
          to undo and Mod+Shift+Z to redo.
        </p>

        {/* Inline Fallacy Diagnostics & Non-Destructive Dismissal Banner */}
        {currentFallacy && (
          <div className="px-3 py-2.5 bg-red-950/85 border-b border-red-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-red-200">
            <div className="flex items-start gap-2.5 min-w-0">
              <IconAlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-red-100 text-xs">
                    {currentFallacy.fallacyName}
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-red-900/80 text-red-200 rounded border border-red-700/80">
                    {currentFallacy.sourceId || currentFallacy.targetId
                      ? "FALLACY DETECTED"
                      : "COUNTERMODEL"}
                  </span>
                </div>
                <span className="text-[11px] text-red-200/95 font-mono break-words">
                  {currentFallacy.formalFormula}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {(currentFallacy.sourceId || currentFallacy.targetId) &&
              handleRollback ? (
                <button
                  type="button"
                  onClick={handleRollback}
                  className="shrink-0 min-h-9 pointer-coarse:min-h-11 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-950/80 transition cursor-pointer active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-red-300"
                  aria-label={
                    hasCommittedFallacyEdge
                      ? "Revert Edge: Strip invalid edge and clear fallacy diagnosis"
                      : "Dismiss Fallacy: Clear fallacy diagnosis and keep valid proof edges"
                  }
                >
                  {hasCommittedFallacyEdge ? (
                    <>
                      <IconRefresh className="w-3.5 h-3.5" />
                      <span>Revert Edge</span>
                    </>
                  ) : (
                    <>
                      <IconX className="w-3.5 h-3.5" />
                      <span>Dismiss Fallacy</span>
                    </>
                  )}
                </button>
              ) : onDismissFallacy ? (
                <button
                  type="button"
                  onClick={onDismissFallacy}
                  className="shrink-0 min-h-9 pointer-coarse:min-h-11 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-mono font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition cursor-pointer active:scale-[0.98]"
                  aria-label="Dismiss countermodel banner"
                >
                  <IconX className="w-3.5 h-3.5" />
                  <span>Dismiss</span>
                </button>
              ) : null}
            </div>
          </div>
        )}

        {/* Responsive Proof Workspace Surface: Mobile Topological Stack (< 768px) vs Desktop XYFlow Graph (>= 768px) */}
        <div
          ref={handleRef}
          tabIndex={0}
          role="region"
          aria-label="Proof workspace canvas"
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          className={
            !isHydrated
              ? "relative w-full min-h-[760px] md:min-h-[520px] md:h-[520px] bg-gradient-to-b from-slate-950/60 via-slate-900 to-slate-950 select-none overflow-hidden"
              : isMobileStack
                ? "relative w-full min-h-[520px] h-auto bg-[#080c10] select-none overflow-x-hidden"
                : "relative w-full h-[520px] bg-gradient-to-b from-slate-950/60 via-slate-900 to-slate-950 select-none overflow-hidden"
          }
        >
          {!isHydrated ? (
            <ProofCanvasSurfaceSkeleton />
          ) : isMobileStack ? (
            <ProofMobileStackCanvas
              activeTheorem={activeTheorem}
              edges={edges}
              selectedNodeIds={selectedNodeIds}
              inspectedNodeId={inspectedNodeId}
              currentFallacy={currentFallacy}
              hasCommittedFallacyEdge={hasCommittedFallacyEdge}
              activePopoverNodeId={activePopoverNodeId}
              onTogglePopover={handleTogglePopover}
              onClosePopover={handleClosePopover}
              onRegisterPopoverToggle={registerPopoverToggle}
              editingNodeId={editingNodeId}
              editingFormula={editingFormula}
              editingError={editingError}
              onBeginEdit={beginNodeEdit}
              onChangeEditingFormula={handleChangeEditingFormula}
              onSubmitEdit={submitNodeEdit}
              onCancelEdit={cancelNodeEdit}
              onUpdateSandboxNode={onUpdateSandboxNode}
              onDeleteSandboxNode={onDeleteSandboxNode}
              onLoadSandboxStarter={onLoadSandboxStarter}
              onOpenImportExport={onOpenImportExport}
              handleNodeClick={handleNodeClick}
              onConnectNodes={onConnectNodes}
              handleAutoStep={handleAutoStep}
              handleRollback={handleRollback}
              onInspectFallacy={onInspectFallacy}
            />
          ) : (
            <DynamicProofFlowCanvas
              activeTheorem={activeTheorem}
              edges={edges}
              nodeOffsets={nodeOffsets}
              selectedNodeIds={selectedNodeIds}
              inspectedNodeId={inspectedNodeId}
              isSnappingEnabled={isSnappingEnabled}
              activeGuides={activeGuides}
              dragConnection={dragConnection}
              containerWidth={containerWidth}
              currentFallacy={currentFallacy}
              hasCommittedFallacyEdge={hasCommittedFallacyEdge}
              activePopoverNodeId={activePopoverNodeId}
              onTogglePopover={handleTogglePopover}
              onClosePopover={handleClosePopover}
              onRegisterPopoverToggle={registerPopoverToggle}
              editingNodeId={editingNodeId}
              editingFormula={editingFormula}
              editingError={editingError}
              onBeginEdit={beginNodeEdit}
              onChangeEditingFormula={handleChangeEditingFormula}
              onSubmitEdit={submitNodeEdit}
              onCancelEdit={cancelNodeEdit}
              onUpdateSandboxNode={onUpdateSandboxNode}
              onDeleteSandboxNode={onDeleteSandboxNode}
              onLoadSandboxStarter={onLoadSandboxStarter}
              onOpenImportExport={onOpenImportExport}
              handleNodeClick={handleNodeClick}
              onConnectNodes={onConnectNodes}
              onRejectConnection={onRejectConnection}
              onCommitNodeMove={onCommitNodeMove}
              handleRollback={handleRollback}
              onInspectFallacy={onInspectFallacy}
            />
          )}

          {/* External Snapping Alignment Crosshairs & Fallback Drag Cord Overlay */}
          {(!isHydrated || !isMobileStack) && (
            <svg
              ref={svgCanvasRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 w-full h-full z-20"
            >
              {activeGuides.map((guide, idx) => {
                if (guide.type === "vertical") {
                  return (
                    <line
                      key={`guide-v-${idx}`}
                      x1={guide.pos}
                      y1={Math.max(0, guide.start)}
                      x2={guide.pos}
                      y2={Math.min(520, guide.end)}
                      stroke="#06b6d4"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  );
                }
                return (
                  <line
                    key={`guide-h-${idx}`}
                    x1={Math.max(0, guide.start)}
                    y1={guide.pos}
                    x2={Math.min(containerWidth || 760, guide.end)}
                    y2={guide.pos}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                );
              })}

              {dragConnection &&
                (() => {
                  const x1 = dragConnection.sourceX;
                  const y1 = dragConnection.sourceY;
                  const x2 = dragConnection.currentX;
                  const y2 = dragConnection.currentY;
                  const dx = Math.abs(x2 - x1) * 0.5;
                  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
                  const strokeColor = dragConnection.hoveredTargetId
                    ? dragConnection.isValid
                      ? "#10b981"
                      : "#f43f5e"
                    : "#06b6d4";

                  return (
                    <g>
                      <path
                        d={d}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="2.5"
                        strokeDasharray="3 3"
                      />
                      <circle cx={x2} cy={y2} r="5" fill={strokeColor} />
                    </g>
                  );
                })()}
            </svg>
          )}
        </div>

        {/* Floating Rule Palette Dock */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono uppercase text-slate-400 mr-1">
              Rule Palette:
            </span>
            {INFERENCE_RULES.map((rule) => {
              const match = ruleMatches?.find((m) => m.ruleId === rule.id);
              const isApplicable = Boolean(match?.isApplicable);
              const isRecommended = Boolean(match?.isRecommended);

              return (
                <TooltipButton
                  key={rule.id}
                  onClick={() => handleApplyRule(rule.id)}
                  className={`min-h-8 pointer-coarse:min-h-11 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                    isApplicable
                      ? isRecommended
                        ? "bg-emerald-950/80 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/80"
                        : "bg-brand-cyan/20 border-brand-cyan text-white shadow-lg shadow-cyan-500/20 ring-1 ring-brand-cyan/60"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 opacity-80 hover:opacity-100"
                  }`}
                  tooltip={`${rule.name}: ${match?.explanation || rule.template}`}
                  aria-label={`${rule.name} ${rule.symbol}${isApplicable && match?.resultFormula ? ` ${match.resultFormula}` : ""}: ${isApplicable ? `Applicable deriving ${match?.resultFormula}` : match?.explanation || rule.template}`}
                >
                  <span className="order-2 text-[11px] text-slate-300 hidden sm:inline font-medium">
                    {rule.name}
                  </span>{" "}
                  <span
                    className={`order-1 ${
                      isApplicable
                        ? isRecommended
                          ? "text-emerald-300 font-extrabold"
                          : "text-brand-cyan font-extrabold"
                        : "text-brand-cyan font-bold"
                    }`}
                  >
                    {rule.symbol}
                  </span>{" "}
                  {isApplicable && match?.resultFormula && (
                    <span
                      className={`order-3 px-1.5 py-0.5 text-[10px] font-bold rounded font-mono ${
                        isRecommended
                          ? "bg-emerald-400 text-slate-950"
                          : "bg-brand-cyan text-slate-950"
                      }`}
                    >
                      → {match.resultFormula}
                    </span>
                  )}
                </TooltipButton>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStartSimulation("normal")}
              disabled={isSimulating}
              className="min-h-8 pointer-coarse:min-h-11 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30 text-xs font-mono flex items-center gap-1 transition cursor-pointer active:scale-[0.98]"
            >
              <IconPlayerPlay className="w-3.5 h-3.5" />
              {isSimulating ? "Simulating..." : "Simulate"}
            </button>
          </div>
        </div>
      </div>

      {/* Simulation Progress Ribbon */}
      {isSimulating && simulationProgress && (
        <div className="p-3 rounded-xl border border-emerald-800/40 bg-emerald-950/20 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconSparkles className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>Background Tactic Simulation Running...</span>
            <span className="text-slate-400 font-mono">
              [{simulationProgress.step}/{simulationProgress.total}]{" "}
              {simulationProgress.log}
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
            THREAD: WEB WORKER (60FPS UI SAFE)
          </span>
        </div>
      )}
    </div>
  );
};
