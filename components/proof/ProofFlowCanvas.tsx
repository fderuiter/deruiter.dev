"use client";

import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { IconSparkles, IconUpload } from "@tabler/icons-react";
import {
  canConnect,
  computeMagneticSnap,
  evaluateProofStatus,
  getCompatibleTargets,
  type AlignmentGuide,
  type Edge,
  type FallacyDiagnosis,
  type TheoremDefinition,
} from "@/lib/proof";
import {
  PROOF_NODE_CARD_HEIGHT,
  PROOF_NODE_CARD_WIDTH,
  ProofNodeCard,
  type ProofFlowNode,
} from "./ProofNodeCard";
import { ProofRuleEdge, type ProofFlowEdge } from "./ProofRuleEdge";

const nodeTypes = { proofNode: ProofNodeCard };
const edgeTypes = { proofRule: ProofRuleEdge };

interface ProofFlowCanvasProps {
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
  containerWidth: number;
  svgCanvasRef: RefObject<SVGSVGElement | null>;
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
  onRejectConnection?: (sourceId: string, targetId: string) => void;
  onCommitNodeMove?: (nodeId: string, x: number, y: number) => void;
  handleRollback?: () => void;
  onInspectFallacy?: () => void;
}

function ProofFlowCanvasInner({
  activeTheorem,
  edges,
  nodeOffsets,
  selectedNodeIds,
  inspectedNodeId,
  isSnappingEnabled,
  activeGuides,
  dragConnection,
  containerWidth,
  svgCanvasRef,
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
  onRejectConnection,
  onCommitNodeMove,
  handleRollback,
  onInspectFallacy,
}: ProofFlowCanvasProps) {
  const flow = useReactFlow<ProofFlowNode, ProofFlowEdge>();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const [flowPositions, setFlowPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [flowGuides, setFlowGuides] = useState<AlignmentGuide[]>([]);

  useEffect(() => {
    return () => {
      if (
        dragRafRef.current !== null &&
        typeof cancelAnimationFrame === "function"
      ) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
    };
  }, []);

  const theoremLayoutSignature = useMemo(
    () =>
      `${activeTheorem.id}:${activeTheorem.nodes
        .map((n) => `${n.id}@${n.x},${n.y}:${n.label}`)
        .join("|")}:${Object.keys(nodeOffsets).length}`,
    [activeTheorem.id, activeTheorem.nodes, nodeOffsets]
  );

  const [prevSig, setPrevSig] = useState(theoremLayoutSignature);
  if (prevSig !== theoremLayoutSignature) {
    setPrevSig(theoremLayoutSignature);
    if (Object.keys(flowPositions).length > 0) {
      setFlowPositions({});
    }
    if (flowGuides.length > 0) {
      setFlowGuides([]);
    }
  }

  const safeFitView = useCallback(() => {
    if (activeTheorem.nodes.length === 0) return;
    try {
      void flow.fitView({
        padding: 0.07,
        minZoom: 0.85,
        maxZoom: 1,
        duration: 0,
      });
    } catch {
      // Safe no-op in JSDOM test environments lacking DOMMatrixReadOnly
    }
  }, [activeTheorem.nodes.length, flow]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    safeFitView();
    const raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(() => safeFitView())
        : null;
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => safeFitView());
      observer.observe(el);
      return () => {
        if (raf !== null && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(raf);
        }
        observer.disconnect();
      };
    }
    return () => {
      if (raf !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(raf);
      }
    };
  }, [safeFitView, theoremLayoutSignature]);

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

  const handleTogglePopover = useCallback(
    (nodeId: string) => {
      setActivePopoverNodeId((prev) => (prev === nodeId ? null : nodeId));
    },
    [setActivePopoverNodeId]
  );

  const handleClosePopover = useCallback(() => {
    setActivePopoverNodeId(null);
  }, [setActivePopoverNodeId]);

  const flowNodes = useMemo<ProofFlowNode[]>(() => {
    return activeTheorem.nodes.map((node) => {
      const extOffset = nodeOffsets[node.id] || { x: 0, y: 0 };
      const resolvedPos = flowPositions[node.id] ?? {
        x: node.x + extOffset.x,
        y: node.y + extOffset.y,
      };
      const isSelected = selectedNodeIds.includes(node.id);
      const isInspected = inspectedNodeId === node.id;
      const isGivenPremise = node.type === "premise";
      const isNodeProven = sandboxProvenSet
        ? sandboxProvenSet.has(node.id)
        : isGivenPremise ||
          (node.id === activeTheorem.intermediateNodeId
            ? proofStatus.isC_Proven
            : proofStatus.isE_Proven);

      const isDimmed = Boolean(
        dragConnection &&
        dragConnection.sourceId !== node.id &&
        dragConnection.hoveredTargetId !== node.id &&
        !dragConnection.isValid
      );
      const isHoveredInDrag = dragConnection?.hoveredTargetId === node.id;
      const compTarget = compatibleTargets.find((t) => t.targetId === node.id);
      const fallacyTargetId = currentFallacy?.targetId;
      const isFallacyTargetNode = Boolean(
        currentFallacy &&
        (fallacyTargetId
          ? node.id === fallacyTargetId
          : node.id === activeTheorem.targetNodeId)
      );

      return {
        id: node.id,
        type: "proofNode",
        position: resolvedPos,
        initialWidth: PROOF_NODE_CARD_WIDTH,
        initialHeight: PROOF_NODE_CARD_HEIGHT,
        width: PROOF_NODE_CARD_WIDTH,
        zIndex: activePopoverNodeId === node.id ? 40 : isSelected ? 20 : 10,
        data: {
          node,
          isSelected,
          isInspected,
          isGivenPremise,
          isNodeProven,
          isDimmed,
          isHoveredInDrag,
          dragIsValid: Boolean(dragConnection?.isValid),
          compatibleBadgeLabel: compTarget?.badgeLabel ?? null,
          isFallacyTargetNode,
          currentFallacy: currentFallacy ?? null,
          hasCommittedFallacyEdge,
          isPopoverOpen: activePopoverNodeId === node.id,
          isSandbox: Boolean(activeTheorem.isSandbox),
          isEditing: editingNodeId === node.id,
          editingFormula: editingNodeId === node.id ? editingFormula : "",
          editingError: editingNodeId === node.id ? editingError : null,
          canEditSandboxNode: Boolean(
            (node.type === "premise" || node.type === "conclusion") &&
            onUpdateSandboxNode
          ),
          onNodeClick: handleNodeClick,
          onTogglePopover: handleTogglePopover,
          onClosePopover: handleClosePopover,
          onBeginEdit,
          onChangeEditingFormula,
          onSubmitEdit,
          onCancelEdit,
          onDeleteSandboxNode,
          onRollback: handleRollback,
          onInspectFallacy,
        },
      };
    });
  }, [
    activeTheorem,
    nodeOffsets,
    flowPositions,
    selectedNodeIds,
    inspectedNodeId,
    sandboxProvenSet,
    proofStatus.isC_Proven,
    proofStatus.isE_Proven,
    dragConnection,
    compatibleTargets,
    currentFallacy,
    hasCommittedFallacyEdge,
    activePopoverNodeId,
    editingNodeId,
    editingFormula,
    editingError,
    onUpdateSandboxNode,
    handleNodeClick,
    handleTogglePopover,
    handleClosePopover,
    onBeginEdit,
    onChangeEditingFormula,
    onSubmitEdit,
    onCancelEdit,
    onDeleteSandboxNode,
    handleRollback,
    onInspectFallacy,
  ]);

  const flowEdges = useMemo<ProofFlowEdge[]>(() => {
    return edges.map((edge, idx) => {
      const isTargetProven = sandboxProvenSet
        ? sandboxProvenSet.has(edge.target)
        : edge.target === activeTheorem.intermediateNodeId
          ? proofStatus.isC_Proven
          : edge.target === activeTheorem.targetNodeId
            ? proofStatus.isE_Proven
            : false;

      return {
        id: `${edge.source}->${edge.target}-${idx}`,
        source: edge.source,
        target: edge.target,
        type: "proofRule",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isTargetProven ? "#10b981" : "#06b6d4",
          width: 18,
          height: 18,
        },
        data: {
          ruleLabel: edge.ruleApplied,
          isProven: isTargetProven,
        },
      };
    });
  }, [
    edges,
    sandboxProvenSet,
    activeTheorem.intermediateNodeId,
    activeTheorem.targetNodeId,
    proofStatus.isC_Proven,
    proofStatus.isE_Proven,
  ]);

  const handleNodeDrag: OnNodeDrag<ProofFlowNode> = useCallback(
    (_event, draggedNode) => {
      const peerNodes = activeTheorem.nodes
        .filter((n) => n.id !== draggedNode.id)
        .map((n) => {
          const extOffset = nodeOffsets[n.id] || { x: 0, y: 0 };
          const pos = flowPositions[n.id] ?? {
            x: n.x + extOffset.x,
            y: n.y + extOffset.y,
          };
          return {
            id: n.id,
            x: pos.x,
            y: pos.y,
            width: PROOF_NODE_CARD_WIDTH,
            height: PROOF_NODE_CARD_HEIGHT,
          };
        });

      const snapped = computeMagneticSnap(
        draggedNode.position.x,
        draggedNode.position.y,
        PROOF_NODE_CARD_WIDTH,
        PROOF_NODE_CARD_HEIGHT,
        peerNodes,
        {
          gridSize: 20,
          threshold: 12,
          enableGrid: isSnappingEnabled,
          enableAlignment: isSnappingEnabled,
        }
      );

      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
      }
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;
        setFlowPositions((prev) => ({
          ...prev,
          [draggedNode.id]: { x: snapped.x, y: snapped.y },
        }));
        setFlowGuides(snapped.guides);
      });
    },
    [activeTheorem.nodes, nodeOffsets, flowPositions, isSnappingEnabled]
  );

  const handleNodeDragStop: OnNodeDrag<ProofFlowNode> = useCallback(
    (_event, draggedNode) => {
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      const finalPos = flowPositions[draggedNode.id] ?? draggedNode.position;
      setFlowGuides([]);
      if (activeTheorem.isSandbox && onCommitNodeMove) {
        onCommitNodeMove(
          draggedNode.id,
          Math.round(finalPos.x),
          Math.round(finalPos.y)
        );
      }
    },
    [flowPositions, activeTheorem.isSandbox, onCommitNodeMove]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const check = canConnect(
        connection.source,
        connection.target,
        edges,
        activeTheorem
      );
      if (check.allowed) {
        const found = getCompatibleTargets(
          connection.source,
          activeTheorem,
          edges
        ).find((c) => c.targetId === connection.target);
        onConnectNodes?.(
          connection.source,
          connection.target,
          found?.badgeLabel || "Valid Inferred Target"
        );
      } else {
        onRejectConnection?.(connection.source, connection.target);
      }
    },
    [edges, activeTheorem, onConnectNodes, onRejectConnection]
  );

  const combinedGuides = activeGuides.length > 0 ? activeGuides : flowGuides;
  const maxGuideX = containerWidth || 760;

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <ReactFlow<ProofFlowNode, ProofFlowEdge>
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        nodesDraggable
        nodesConnectable
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        nodeDragThreshold={4}
        snapToGrid={isSnappingEnabled}
        snapGrid={[20, 20]}
        panOnDrag
        zoomOnPinch
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        minZoom={0.82}
        maxZoom={1.5}
        connectionRadius={48}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        className="!bg-transparent [&_.react-flow__controls]:!shadow-xl [&_.react-flow__controls-button]:!bg-slate-900 [&_.react-flow__controls-button]:!border-slate-700 [&_.react-flow__controls-button]:!text-slate-200 hover:[&_.react-flow__controls-button]:!bg-slate-800 [&_.react-flow__controls-button_svg]:!fill-current"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={isSnappingEnabled ? 1.5 : 1}
          color={isSnappingEnabled ? "#475569" : "#1e293b"}
        />
        <Controls
          showInteractive={false}
          position="bottom-right"
          fitViewOptions={{ padding: 0.07, minZoom: 0.85, maxZoom: 1 }}
        />
      </ReactFlow>

      {/* Snapping Alignment Crosshairs & Fallback Drag Cord Overlay */}
      <svg
        ref={svgCanvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full z-20"
      >
        {combinedGuides.map((guide, idx) => {
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
              x2={Math.min(maxGuideX, guide.end)}
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

      {/* Empty Sandbox Helper Card */}
      {activeTheorem.isSandbox && activeTheorem.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-20">
          <div className="pointer-events-auto max-w-md w-full rounded-2xl border border-slate-800 bg-slate-950/90 p-5 text-center shadow-2xl space-y-3">
            <div className="text-sm font-bold text-white">
              Open Sandbox Proof Canvas
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter propositional formulas in the bar above to add premise and
              goal cards, then select cards and fire tactics from the Rule
              Palette to spawn derived steps dynamically.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {onLoadSandboxStarter && (
                <button
                  type="button"
                  onClick={onLoadSandboxStarter}
                  className="px-3 py-1.5 pointer-coarse:min-h-11 rounded-lg border border-brand-cyan/50 bg-brand-cyan/15 hover:bg-brand-cyan/25 text-brand-cyan text-xs font-mono font-bold inline-flex items-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
                >
                  <IconSparkles className="w-3.5 h-3.5" />
                  <span>Load Starter Example</span>
                </button>
              )}
              {onOpenImportExport && (
                <button
                  type="button"
                  onClick={onOpenImportExport}
                  className="px-3 py-1.5 pointer-coarse:min-h-11 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-mono font-bold inline-flex items-center gap-1.5 transition cursor-pointer active:scale-[0.98]"
                >
                  <IconUpload className="w-3.5 h-3.5 text-brand-cyan" />
                  <span>Import .proof.json</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProofFlowCanvas(props: ProofFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <ProofFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
