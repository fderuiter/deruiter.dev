"use client";

import React from "react";
import {
  IconTerminal,
  IconCornerDownLeft,
  IconHistory,
  IconCpu,
  IconRefresh,
  IconCheck,
  IconCircleDot,
} from "@tabler/icons-react";
import {
  edgeColor,
  isNodeProven,
  tooltipPosition,
} from "./schemaflow/proof-graph";
import { useConsoleLog } from "./schemaflow/useConsoleLog";
import { useProofGraph } from "./schemaflow/useProofGraph";
import { useSolverTelemetry } from "./schemaflow/useSolverTelemetry";
import { useTacticConsole } from "./schemaflow/useTacticConsole";

const QUICK_COMMANDS = [
  "connect A C",
  "connect B C",
  "connect C E",
  "connect D E",
  "rollback",
];

export default function SchemaFlowWorkspace() {
  const { consoleLogs, addLog, clearLogs } = useConsoleLog();
  const {
    nodes,
    edges,
    history,
    status,
    isC_Proven,
    isE_Proven,
    selectedNodeId,
    hoveredNodeId,
    hoveredNode,
    inspectorNode: activeInspectorNode,
    setHoveredNodeId,
    connectNodes,
    disconnectNodes,
    executeRollback,
    resetCanvas,
    handleNodeClick,
  } = useProofGraph(addLog);
  const {
    isSolverLoopActive,
    toggleSolverLoop,
    gaugeContainerRef,
    ramTextRef,
  } = useSolverTelemetry(addLog);
  const {
    consoleInput,
    setConsoleInput,
    suggestion,
    runCliCommand,
    handleKeyDown,
  } = useTacticConsole({
    addLog,
    clearLogs,
    connectNodes,
    disconnectNodes,
    executeRollback,
    toggleSolverLoop,
  });
  const terminalLogsContainerRef = React.useRef<HTMLDivElement>(null);

  // Scroll console internally to bottom without shifting viewport
  React.useEffect(() => {
    if (terminalLogsContainerRef.current) {
      terminalLogsContainerRef.current.scrollTop =
        terminalLogsContainerRef.current.scrollHeight;
    }
  }, [consoleLogs]);

  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      {/* Inline styles for isolating dash paths and high-frequency CSS variable support without reflows */}
      <style jsx global>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -40;
          }
        }
        .flow-path {
          stroke-dasharray: 8 4;
          animation: dash 3s linear infinite;
        }
        .gauge-fill {
          stroke-dasharray: 251.2;
          stroke-dashoffset: calc(
            251.2 - (251.2 * var(--gauge-progress)) / 100
          );
          transition: stroke-dashoffset 80ms linear;
        }
        .svg-node {
          transition:
            filter 0.25s ease,
            stroke 0.25s ease;
        }
        .svg-node:hover {
          filter: drop-shadow(0px 0px 8px rgba(6, 182, 212, 0.45));
        }
      `}</style>

      {/* Main split dashboard workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch h-auto min-h-[520px]">
        {/* Left Side: Proof Canvas & Telemetry */}
        <div className="lg:col-span-8 flex flex-col gap-5 bg-zinc-950 border border-zinc-900 rounded-3xl p-5 relative overflow-hidden">
          {/* Header row */}
          <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-brand-cyan font-bold bg-brand-cyan/5 px-2 py-0.5 rounded border border-brand-cyan/20">
                declarative svg layout // no layout reflows
              </span>
              <h3 className="text-sm font-extrabold text-white mt-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-cyan animate-pulse"></span>
                Proof Tactic Vector Canvas
              </h3>
            </div>

            {/* Reset / Rollback quick actions */}
            <div className="flex gap-2">
              <button
                onClick={executeRollback}
                disabled={history.length === 0}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl hover:border-brand-cyan/40 disabled:opacity-40 disabled:hover:border-zinc-800 transition-colors cursor-pointer"
                title="Rollback last logical node branch connection"
              >
                <IconHistory className="w-3.5 h-3.5" />
                Rollback ({history.length})
              </button>
              <button
                onClick={resetCanvas}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-zinc-900 border border-zinc-850 text-zinc-400 rounded-xl hover:text-white cursor-pointer"
              >
                <IconRefresh className="w-3.5 h-3.5" />
                Reset Canvas
              </button>
            </div>
          </div>

          {/* Interactive Declarative SVG Proof Tree */}
          <div
            className="w-full h-[360px] bg-zinc-900/40 rounded-2xl border border-zinc-900 relative"
            role="region"
            aria-label="Mathematical Logic Tree Canvas. Clicking nodes executes directed connections."
          >
            <svg
              className="w-full h-full select-none"
              viewBox="0 0 800 420"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Arrow definitions */}
              <defs>
                <marker
                  id="arrow-cyan"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" />
                </marker>
                <marker
                  id="arrow-grey"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#27272a" />
                </marker>
              </defs>

              {/* Edge/Connection Paths */}
              {edges.map((edge, idx) => {
                const s = nodes.find((n) => n.id === edge.source);
                const t = nodes.find((n) => n.id === edge.target);
                if (!s || !t) return null;

                // Edges run between node centres
                return (
                  <path
                    key={`edge-${idx}`}
                    d={`M ${s.x + 90} ${s.y + 40} L ${t.x + 90} ${t.y + 40}`}
                    stroke={edgeColor(edge, status)}
                    strokeWidth="2.5"
                    fill="none"
                    className="flow-path"
                    markerEnd="url(#arrow-cyan)"
                  />
                );
              })}

              {/* Declarative Nodes as Groups (Completely layout-calculation free!) */}
              {nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isProven = isNodeProven(node.id, status);

                const cardWidth = 180;
                const cardHeight = 80;

                return (
                  <g
                    key={node.id}
                    data-testid={`node-${node.id}`}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => handleNodeClick(node.id)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    className="cursor-pointer svg-node focus:outline-none"
                    tabIndex={0}
                    role="button"
                    aria-label={`Node ${node.id} containing formula ${node.formula}. Type is ${node.type}. Status: ${isProven ? "Proven" : "Unproven"}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleNodeClick(node.id);
                      }
                    }}
                  >
                    {/* Background Rect with active/proven coloring */}
                    <rect
                      width={cardWidth}
                      height={cardHeight}
                      rx="12"
                      fill="#09090b"
                      stroke={
                        isSelected
                          ? "#06b6d4"
                          : isProven
                            ? "#10b981"
                            : "#27272a"
                      }
                      strokeWidth={isSelected ? "2.5" : "1.5"}
                      style={{
                        strokeDasharray: isSelected ? "4" : "none",
                      }}
                    />

                    {/* Node Header Code label */}
                    <text
                      x="14"
                      y="24"
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {node.label}
                    </text>

                    {/* Formula Text */}
                    <text
                      x="14"
                      y="50"
                      fill="#ffffff"
                      fontSize="14"
                      fontFamily="monospace"
                      fontWeight="900"
                    >
                      {node.formula}
                    </text>

                    {/* Type/Status label */}
                    <text
                      x="14"
                      y="68"
                      fill={isProven ? "#10b981" : "#a1a1aa"}
                      fontSize="8.5"
                      fontFamily="sans-serif"
                      fontWeight="bold"
                    >
                      {node.type.toUpperCase()}
                    </text>

                    {/* Proven Status Bullet */}
                    <circle
                      cx={cardWidth - 16}
                      cy="20"
                      r="4.5"
                      fill={isProven ? "#10b981" : "#52525b"}
                    />
                  </g>
                );
              })}

              {/* Floating Specification Tooltip Overlay */}
              {hoveredNode &&
                (() => {
                  const { x: tooltipX, y: tooltipY } =
                    tooltipPosition(hoveredNode);

                  return (
                    <g
                      data-testid="node-tooltip"
                      role="tooltip"
                      className="pointer-events-none transition-opacity duration-150"
                    >
                      <foreignObject
                        x={tooltipX}
                        y={tooltipY}
                        width="280"
                        height="52"
                        className="overflow-visible"
                      >
                        <div className="bg-zinc-950/95 border border-brand-cyan/70 rounded-xl p-2.5 shadow-xl shadow-black/90 backdrop-blur-md text-[10px] font-mono text-cyan-200 leading-tight select-none">
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="font-extrabold text-white flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-ping"></span>
                              {hoveredNode.label} SPECIFICATION
                            </span>
                            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                              {hoveredNode.type}
                            </span>
                          </div>
                          <div className="text-zinc-200 text-[9.5px] leading-snug break-words">
                            {hoveredNode.description}
                          </div>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })()}
            </svg>

            {/* Floating click prompt guidance label */}
            <div className="absolute bottom-3 left-3 right-3 bg-zinc-950/80 border border-zinc-900 rounded-xl p-2.5 flex items-center justify-between select-none">
              <span className="text-[10px] font-mono text-muted leading-none">
                {selectedNodeId
                  ? `👉 Selected NODE ${selectedNodeId}. Click target node to draw directed branch.`
                  : "💡 Hover or tap nodes to inspect specifications; tap two nodes to connect them."}
              </span>
              <span className="text-[9px] font-mono bg-zinc-900 px-2 py-0.5 border border-zinc-850 rounded text-brand-cyan font-bold">
                GRAPHICS ACCELERATION // ON
              </span>
            </div>
          </div>

          {/* Contextual Node Inspection Panel */}
          <div
            data-testid="node-inspector-panel"
            role="region"
            aria-label="Contextual Node Inspection Panel"
            className="w-full min-w-0 bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 transition-all duration-200 select-none"
          >
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5 mb-3 min-w-0 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-2 h-2 rounded-full ${activeInspectorNode ? "bg-brand-cyan animate-pulse" : "bg-zinc-600"}`}
                />
                <h4 className="text-xs font-mono font-extrabold uppercase tracking-wider text-zinc-200 truncate">
                  {activeInspectorNode
                    ? `INSPECTOR // ${activeInspectorNode.label}`
                    : "CONTEXTUAL NODE INSPECTOR"}
                </h4>
              </div>
              <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border border-zinc-800 bg-zinc-950 text-zinc-400 font-bold shrink-0">
                {hoveredNodeId
                  ? "HOVER PREVIEW"
                  : selectedNodeId
                    ? "TAP / SELECTED"
                    : "TOUCH & POINTER READY"}
              </span>
            </div>

            {activeInspectorNode ? (
              (() => {
                const isProven = isNodeProven(activeInspectorNode.id, status);

                return (
                  <div className="flex flex-col gap-3 min-w-0">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono min-w-0">
                      <div className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-2 min-w-0">
                        <span className="text-[9px] text-muted block uppercase tracking-wider mb-0.5">
                          Label
                        </span>
                        <span
                          data-testid="inspector-node-label"
                          className="font-extrabold text-white truncate block"
                        >
                          {activeInspectorNode.label}
                        </span>
                      </div>

                      <div className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-2 min-w-0">
                        <span className="text-[9px] text-muted block uppercase tracking-wider mb-0.5">
                          Formula
                        </span>
                        <span
                          data-testid="inspector-node-formula"
                          className="font-extrabold text-brand-cyan truncate block"
                        >
                          {activeInspectorNode.formula}
                        </span>
                      </div>

                      <div className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-2 min-w-0">
                        <span className="text-[9px] text-muted block uppercase tracking-wider mb-0.5">
                          Type
                        </span>
                        <span
                          data-testid="inspector-node-type"
                          className="font-bold text-zinc-300 uppercase truncate block"
                        >
                          {activeInspectorNode.type}
                        </span>
                      </div>

                      <div className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-2 min-w-0">
                        <span className="text-[9px] text-muted block uppercase tracking-wider mb-0.5">
                          Status
                        </span>
                        <span
                          data-testid="inspector-node-status"
                          className={`font-extrabold uppercase truncate block ${
                            isProven ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {isProven ? "PROVEN" : "UNPROVEN"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-zinc-950/90 border border-zinc-900 rounded-xl p-3 min-w-0">
                      <span className="text-[9px] font-mono text-muted uppercase tracking-wider block mb-1">
                        Specification Description
                      </span>
                      <p
                        data-testid="inspector-node-description"
                        className="text-xs text-zinc-200 leading-relaxed font-sans break-words"
                      >
                        {activeInspectorNode.description}
                      </p>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="py-2 text-[11px] text-muted font-mono leading-relaxed flex items-center justify-between gap-2">
                <span>
                  💡 Hover or tap any node on the proof canvas above to inspect
                  domain rules, formulas, and clinical specifications.
                </span>
              </div>
            )}
          </div>

          {/* Telemetry and Goal Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Goal completion monitor */}
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between select-none">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                    isE_Proven
                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60"
                      : "bg-zinc-900/50 text-muted border-zinc-850"
                  }`}
                >
                  {isE_Proven ? (
                    <IconCheck className="w-4 h-4" />
                  ) : (
                    <IconCircleDot className="w-4 h-4 animate-pulse" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase text-zinc-300 tracking-wider">
                    Goal R Verification
                  </h4>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    {isE_Proven
                      ? "Success: Conclusion verified successfully on GPU."
                      : isC_Proven
                        ? "Intermediate Q proven. Establish C → E & D → E pathways."
                        : "Required: Establish pathways (A & B) → C and (C & D) → E."}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-900 flex justify-between text-[10px] font-mono text-muted">
                <span>PATHWAYS ACTIVE:</span>
                <span className="text-brand-cyan font-extrabold">
                  {edges.length}
                </span>
              </div>
            </div>

            {/* RAM Progress Telemetry Gauge (Compositor css variables updates!) */}
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-4 flex gap-4 items-center relative select-none">
              {/* Radial gauge element */}
              <div
                ref={gaugeContainerRef}
                className="relative w-16 h-16 flex items-center justify-center shrink-0"
                style={
                  {
                    "--gauge-progress": 42.5,
                  } as React.CSSProperties
                }
              >
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#18181b"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#06b6d4"
                    strokeWidth="8"
                    fill="transparent"
                    strokeLinecap="round"
                    className="gauge-fill"
                  />
                </svg>
                {/* Embedded dynamic percent */}
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span
                    ref={ramTextRef}
                    className="text-[10px] font-mono font-bold text-white"
                  >
                    42%
                  </span>
                </div>
              </div>

              {/* Gauge description & controls */}
              <div className="flex-1 flex flex-col justify-between h-full py-1">
                <div>
                  <h4 className="text-xs font-bold uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                    <IconCpu className="w-3.5 h-3.5 text-brand-cyan" />
                    Solver RAM Telemetry
                  </h4>
                  <p className="text-[10px] text-muted mt-0.5 leading-relaxed">
                    Compositor thread updates. Zero main-thread layout
                    thrashing.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-zinc-900">
                  <button
                    onClick={() => toggleSolverLoop()}
                    className={`px-2.5 py-1 text-[9px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      isSolverLoopActive
                        ? "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                    }`}
                  >
                    {isSolverLoopActive
                      ? "■ Stop Solver Loop"
                      : "▶ Start Solver Loop"}
                  </button>
                  <span className="text-[9px] font-mono text-muted">
                    60FPS SECURE
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Accessible Command CLI Terminal */}
        <div
          className="lg:col-span-4 flex flex-col bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden relative"
          role="region"
          aria-label="Accessible command log console"
        >
          {/* Terminal window bar */}
          <div className="border-b border-zinc-900 bg-zinc-950/80 px-4 py-3 flex justify-between items-center select-none min-w-0 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 shrink-0"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 shrink-0"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 shrink-0"></span>
              <span className="text-[10px] font-mono text-muted font-bold ml-2 truncate min-w-0">
                PROOF-TACTIC-SHELL
              </span>
            </div>
            <IconTerminal className="w-4 h-4 text-zinc-600 shrink-0" />
          </div>

          {/* Console logs output */}
          <div
            ref={terminalLogsContainerRef}
            className="flex-1 p-4 font-mono text-[10px] leading-normal overflow-y-auto max-h-[300px] lg:max-h-[350px] min-h-[220px] space-y-3 scrollbar-thin text-zinc-300 select-text min-w-0"
            role="log"
            aria-label="Terminal feedback records"
          >
            {consoleLogs.map((log) => (
              <div key={log.id} className="space-y-0.5 min-w-0">
                {log.type === "command" && (
                  <div className="flex items-center gap-1.5 text-muted font-bold select-none min-w-0">
                    <span className="text-zinc-700 font-bold shrink-0">~</span>
                    <span className="text-muted shrink-0">tactic-cli $</span>
                    <span className="text-zinc-100 font-bold select-text min-w-0 break-all">
                      {log.text}
                    </span>
                  </div>
                )}
                {log.type === "info" && (
                  <div className="text-muted whitespace-pre-wrap leading-relaxed select-text min-w-0 break-all">
                    {log.text}
                  </div>
                )}
                {log.type === "error" && (
                  <div className="text-red-400 font-bold select-text min-w-0 break-all">
                    ✖ {log.text}
                  </div>
                )}
                {log.type === "success" && (
                  <div className="text-emerald-400 font-bold select-text min-w-0 break-all">
                    ✔ {log.text}
                  </div>
                )}
                {log.type === "output" && (
                  <div className="text-zinc-300 whitespace-pre-wrap select-text leading-relaxed min-w-0 break-all">
                    {log.text}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input Prompt panel */}
          <div className="border-t border-zinc-900 bg-zinc-950 px-4 py-3 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 relative min-w-0">
              <span className="text-zinc-700 font-bold font-mono text-[10px] select-none shrink-0">
                ~
              </span>
              <span className="text-muted font-bold font-mono text-[10px] select-none shrink-0 truncate max-w-[90px] xs:max-w-none">
                tactic-cli $
              </span>

              <div className="flex-1 relative flex items-center min-h-[1.5rem] min-w-0">
                {suggestion && (
                  <div className="absolute inset-0 pointer-events-none font-mono text-[10px] text-zinc-700 flex items-center select-none z-0 truncate">
                    <span>{consoleInput}</span>
                    <span>{suggestion.substring(consoleInput.length)}</span>
                  </div>
                )}

                <input
                  type="text"
                  value={consoleInput}
                  onChange={(e) => setConsoleInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type 'help' or syntax commands..."
                  className="w-full min-w-0 bg-transparent border-none outline-none font-mono text-[10px] text-zinc-100 placeholder-zinc-800 caret-brand-cyan z-10 select-text"
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  aria-label="Tactic prompt terminal command input"
                />
              </div>

              <button
                onClick={() => runCliCommand(consoleInput)}
                disabled={!consoleInput.trim()}
                className="p-0.5 text-zinc-600 hover:text-brand-cyan disabled:text-zinc-850 disabled:hover:text-zinc-850 transition-colors cursor-pointer"
                title="Execute CLI Tactic"
              >
                <IconCornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Suggested command line helpers */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-900 select-none">
              {QUICK_COMMANDS.map((command) => (
                <button
                  key={command}
                  onClick={() => setConsoleInput(command)}
                  className="px-2 py-0.5 text-[9px] font-mono bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-brand-cyan hover:border-brand-cyan/20 rounded-md cursor-pointer"
                >
                  {command}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
