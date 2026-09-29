"use client";

import React, { RefObject } from "react";
import { motion } from "framer-motion";
import {
  IconRefresh,
  IconBulb,
  IconSparkles,
  IconAlertTriangle,
  IconPlayerPlay,
  IconWand,
} from "@tabler/icons-react";
import {
  TheoremDefinition,
  Edge,
  AlignmentGuide,
  INFERENCE_RULES,
  getCompatibleTargets,
  evaluateProofStatus,
} from "@/lib/proof-utils";

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
  canvasWrapperRef: RefObject<HTMLDivElement | null>;
  svgCanvasRef: RefObject<SVGSVGElement | null>;
  mobileActiveView: "canvas" | "ledger" | "systems" | "fallacy" | "terminal";
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
  handleNodePointerDown,
  handleNodePointerMove,
  handleNodePointerUp,
  handleNodeClick,
  handleHandlePointerDown,
  handleCanvasPointerMove,
  handleCanvasPointerUp,
  handleApplyRule,
  handleStartSimulation,
  canvasWrapperRef,
  svgCanvasRef,
  mobileActiveView,
}) => {
  const proofStatus = evaluateProofStatus(edges, activeTheorem);
  return (
    <div
      className={`lg:col-span-8 flex flex-col gap-4 ${
        mobileActiveView === "canvas" ? "flex" : "hidden lg:flex"
      }`}
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden flex flex-col shadow-2xl relative">
        {/* Canvas Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 animate-ping" />
            <span className="text-xs font-semibold text-white">
              {activeTheorem.ruleName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSnapping}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition cursor-pointer active:scale-[0.98] ${
                isSnappingEnabled
                  ? "bg-brand-cyan/15 border-brand-cyan/50 text-brand-cyan shadow-sm shadow-cyan-500/20"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle magnetic snapping & alignment guides [Shortcut: G]"
              aria-pressed={isSnappingEnabled}
              aria-label={`Magnetic Snapping: ${isSnappingEnabled ? "Enabled" : "Disabled"}. Press G to toggle.`}
            >
              <span className="text-[11px] font-bold">SNAP</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSnappingEnabled
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-slate-600"
                }`}
              />
              <kbd className="hidden md:inline text-[9px] px-1 py-0.2 rounded bg-slate-950/70 border border-slate-800 text-slate-400 font-mono">
                G
              </kbd>
            </button>
            <button
              onClick={handleAutoStep}
              className="px-2.5 py-1.5 rounded-lg bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-xs font-mono flex items-center gap-1 transition cursor-pointer active:scale-[0.98]"
            >
              <IconWand className="w-3.5 h-3.5" />
              Auto-Step
            </button>
            <button
              onClick={handleResetLayout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer active:scale-[0.98]"
              title="Reset node positions & connections"
            >
              <IconRefresh className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tactic Goal Ribbon */}
        <div className="bg-slate-950/60 px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <IconBulb className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium text-amber-300/90">
              {activeTacticHint.title}:
            </span>
            <span className="text-slate-400">{activeTacticHint.hint}</span>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
            Goal: Node {activeTheorem.targetNodeId}
          </span>
        </div>

        <p
          id="proof-node-keyboard-help"
          className="px-4 py-2 text-xs text-slate-300"
        >
          Tab to a node. Enter or Space selects it; activate another node to
          connect. Hold Shift while activating nodes to select several premises
          for a rule. Connection handles also support Enter or Space.
        </p>
        {/* SVG Canvas Area (Responsive scroll wrapper) */}
        <div
          ref={canvasWrapperRef}
          tabIndex={0}
          role="region"
          aria-label="Proof workspace canvas"
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          className="relative w-full h-[420px] bg-gradient-to-b from-slate-950/60 via-slate-900 to-slate-950 select-none overflow-x-auto overflow-y-hidden"
        >
          <div className="relative min-w-[760px] h-full">
            <svg
              ref={svgCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              <defs>
                <pattern
                  id="canvas-grid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <circle
                    cx="2"
                    cy="2"
                    r="1"
                    fill="#334155"
                    opacity={isSnappingEnabled ? 0.45 : 0.15}
                  />
                </pattern>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" />
                </marker>
                <marker
                  id="arrow-emerald"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                </marker>
                <linearGradient
                  id="edgeGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>

              {/* Canvas Background Grid */}
              <rect width="100%" height="100%" fill="url(#canvas-grid)" />

              {/* Snapping Alignment Guides */}
              {activeGuides.map((guide, idx) => {
                if (guide.type === "vertical") {
                  return (
                    <line
                      key={`guide-v-${idx}`}
                      x1={guide.pos}
                      y1={Math.max(0, guide.start)}
                      x2={guide.pos}
                      y2={Math.min(420, guide.end)}
                      stroke="#06b6d4"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      className="animate-pulse"
                    />
                  );
                }
                return (
                  <line
                    key={`guide-h-${idx}`}
                    x1={Math.max(0, guide.start)}
                    y1={guide.pos}
                    x2={Math.min(760, guide.end)}
                    y2={guide.pos}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    className="animate-pulse"
                  />
                );
              })}

              {/* Render Bezier Curves for Graph Edges */}
              {edges.map((edge, idx) => {
                const sNode = activeTheorem.nodes.find(
                  (n) => n.id === edge.source
                );
                const tNode = activeTheorem.nodes.find(
                  (n) => n.id === edge.target
                );
                if (!sNode || !tNode) return null;

                const sOffset = nodeOffsets[sNode.id] || { x: 0, y: 0 };
                const tOffset = nodeOffsets[tNode.id] || { x: 0, y: 0 };

                const x1 = sNode.x + sOffset.x + 80;
                const y1 = sNode.y + sOffset.y + 35;
                const x2 = tNode.x + tOffset.x;
                const y2 = tNode.y + tOffset.y + 35;

                const dx = Math.abs(x2 - x1) * 0.5;
                const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                return (
                  <g key={`edge-${idx}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke="url(#edgeGradient)"
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                      className="animate-pulse"
                      markerEnd="url(#arrow)"
                    />
                  </g>
                );
              })}

              {/* Interactive Drag-to-Connect Cord */}
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
                        className="animate-pulse"
                        markerEnd={
                          dragConnection.isValid
                            ? "url(#arrow-emerald)"
                            : "url(#arrow)"
                        }
                      />
                      <circle
                        cx={x2}
                        cy={y2}
                        r="5"
                        fill={strokeColor}
                        className="animate-ping"
                      />
                    </g>
                  );
                })()}
            </svg>

            {/* Draggable Logic Nodes */}
            {activeTheorem.nodes.map((node) => {
              const offset = nodeOffsets[node.id] || { x: 0, y: 0 };
              const isSelected = selectedNodeIds.includes(node.id);
              const isInspected = inspectedNodeId === node.id;
              const isGivenPremise = node.type === "premise";
              const isNodeProven =
                isGivenPremise ||
                (node.id === activeTheorem.intermediateNodeId
                  ? proofStatus.isC_Proven
                  : proofStatus.isE_Proven);

              const isDimmed =
                dragConnection &&
                dragConnection.sourceId !== node.id &&
                dragConnection.hoveredTargetId !== node.id &&
                !dragConnection.isValid;

              const isHoveredInDrag =
                dragConnection?.hoveredTargetId === node.id;

              const compatibleTargets =
                selectedNodeIds.length === 1
                  ? getCompatibleTargets(
                      selectedNodeIds[0],
                      activeTheorem,
                      edges
                    )
                  : [];
              const isCompatible = compatibleTargets.some(
                (t) => t.targetId === node.id
              );
              const compTarget = compatibleTargets.find(
                (t) => t.targetId === node.id
              );

              return (
                <motion.div
                  key={node.id}
                  style={{
                    position: "absolute",
                    left: node.x + offset.x,
                    top: node.y + offset.y,
                  }}
                  onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                  onPointerMove={(e) => handleNodePointerMove(e, node.id)}
                  onPointerUp={(e) => handleNodePointerUp(e, node.id)}
                  className={`group w-[160px] p-2.5 rounded-xl border cursor-pointer transition-all shadow-md select-none ${
                    isDimmed ? "opacity-40" : "opacity-100"
                  } ${
                    isHoveredInDrag
                      ? dragConnection?.isValid
                        ? "bg-emerald-950/60 border-emerald-400 ring-2 ring-emerald-400/80 shadow-emerald-500/30 scale-105"
                        : "bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/80 shadow-rose-500/30 scale-105"
                      : isCompatible
                        ? "bg-emerald-950/30 border-emerald-500/70 ring-2 ring-emerald-500/50 shadow-emerald-500/20"
                        : isSelected
                          ? "bg-brand-cyan/20 border-brand-cyan ring-2 ring-brand-cyan/50 shadow-cyan-500/20"
                          : isInspected
                            ? "bg-slate-800 border-slate-600 ring-1 ring-slate-400"
                            : "bg-slate-900 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Compatible Rule Floating Badge */}
                  {isCompatible && compTarget && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-mono text-[9px] font-bold shadow-md shadow-emerald-950/50 flex items-center gap-1 z-30 whitespace-nowrap animate-bounce">
                      <IconSparkles className="w-2.5 h-2.5 shrink-0" />
                      <span>{compTarget.badgeLabel}</span>
                    </div>
                  )}

                  {/* Invalid Hover Floating Badge */}
                  {isHoveredInDrag && !dragConnection?.isValid && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold shadow-md flex items-center gap-1 z-30 whitespace-nowrap">
                      <IconAlertTriangle className="w-2.5 h-2.5 shrink-0" />
                      <span>Invalid Inference</span>
                    </div>
                  )}

                  <button
                    type="button"
                    tabIndex={0}
                    aria-label={`Node ${node.id}, ${node.label}, ${node.type}, ${isGivenPremise ? "given premise" : isNodeProven ? "proven" : "pending"}, ${isSelected ? "selected" : "not selected"}`}
                    aria-pressed={isSelected}
                    aria-describedby="proof-node-keyboard-help"
                    onClick={(event) =>
                      handleNodeClick(node.id, event.shiftKey)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.shiftKey &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        handleNodeClick(node.id, true);
                      }
                    }}
                    className="block w-full min-h-11 min-w-0 pr-4 text-left rounded-md cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400"
                  >
                    {/* Node Header & Status */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 text-slate-300">
                        Node {node.id}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                          isGivenPremise
                            ? "bg-slate-800 text-sky-300 border border-slate-600/40"
                            : isNodeProven
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                              : "bg-amber-950 text-amber-400 border border-amber-800/40"
                        }`}
                      >
                        {isGivenPremise
                          ? "GIVEN"
                          : isNodeProven
                            ? "PROVEN"
                            : "PENDING"}
                      </span>
                    </div>
                    <div className="min-w-0 break-words font-mono text-sm font-bold text-white mb-0.5">
                      {node.label}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                      {node.meaning}
                    </div>
                  </button>

                  {/* Connection Anchor Handle Port (Right Edge) */}
                  <button
                    type="button"
                    tabIndex={0}
                    onPointerDown={(e) => handleHandlePointerDown(e, node.id)}
                    onClick={() => handleNodeClick(node.id)}
                    className="absolute -right-6 top-1/2 -translate-y-1/2 w-11 h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 rounded-full bg-slate-950 border-2 border-brand-cyan/80 hover:border-brand-cyan hover:scale-125 hover:bg-brand-cyan transition-all shadow-md shadow-cyan-500/40 flex items-center justify-center cursor-crosshair z-20 group-hover:opacity-100 opacity-80"
                    title={`Connect Node ${node.id}: drag, or press Enter/Space then activate the target node`}
                    aria-label={`Drag connection handle from Node ${node.id}, ${node.label}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan group-hover:bg-slate-950" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Floating Rule Palette Dock */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono uppercase text-slate-400 mr-1">
              Rule Palette:
            </span>
            {INFERENCE_RULES.slice(0, 6).map((rule) => (
              <button
                key={rule.id}
                onClick={() => handleApplyRule(rule.id)}
                className="min-h-8 px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                title={`${rule.name}: ${rule.template}`}
              >
                <span className="text-brand-cyan font-bold">{rule.symbol}</span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  {rule.name}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStartSimulation("normal")}
              disabled={isSimulating}
              className="min-h-8 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30 text-xs font-mono flex items-center gap-1 transition cursor-pointer active:scale-[0.98]"
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
