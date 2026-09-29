"use client";

import React, { useState, useEffect, useRef } from "react";
import { clamp } from "@/lib/game-utils";
import {
  IconTerminal,
  IconCornerDownLeft,
  IconHistory,
  IconCpu,
  IconRefresh,
  IconCheck,
  IconCircleDot,
} from "@tabler/icons-react";

interface Node {
  id: string;
  label: string;
  type: "premise" | "intermediate" | "conclusion";
  formula: string;
  description: string;
  x: number;
  y: number;
}

interface Edge {
  source: string;
  target: string;
}

interface ConsoleLog {
  id: string;
  type: "command" | "output" | "error" | "info" | "success";
  text: string;
}

const DEFAULT_NODES: Node[] = [
  {
    id: "A",
    label: "NODE A",
    type: "premise",
    formula: "P",
    description: "Premise P: Fact verification complete.",
    x: 100,
    y: 80,
  },
  {
    id: "B",
    label: "NODE B",
    type: "premise",
    formula: "P → Q",
    description: "Premise P → Q: Verification implies proper mapping.",
    x: 100,
    y: 280,
  },
  {
    id: "C",
    label: "NODE C",
    type: "intermediate",
    formula: "Q",
    description: "Intermediate Goal Q: Data mapping is consistent.",
    x: 360,
    y: 180,
  },
  {
    id: "D",
    label: "NODE D",
    type: "premise",
    formula: "Q → R",
    description: "Premise Q → R: Consistent mapping implies valid schema.",
    x: 360,
    y: 340,
  },
  {
    id: "E",
    label: "NODE E",
    type: "conclusion",
    formula: "R",
    description: "Goal R: Database schema is correct and optimal.",
    x: 620,
    y: 260,
  },
];

const DEFAULT_EDGES: Edge[] = [{ source: "A", target: "C" }];

export default function SchemaFlowWorkspace() {
  const [nodes] = useState<Node[]>(DEFAULT_NODES);
  const [edges, setEdges] = useState<Edge[]>(DEFAULT_EDGES);
  const [history, setHistory] = useState<Edge[][]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // CLI State
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([
    {
      id: "welcome",
      type: "info",
      text: "Logical Proof Assistant CLI v2.4\nType 'help' to review syntax. Hover nodes to read specifications.",
    },
  ]);
  const [cliHistory, setCliHistory] = useState<string[]>([]);
  const [cliHistoryIdx, setCliHistoryIdx] = useState(-1);
  const terminalLogsContainerRef = useRef<HTMLDivElement>(null);
  const consoleInputRef = useRef<HTMLInputElement>(null);

  // Telemetry Gauge State & Direct DOM Refs
  const ramValRef = useRef(42.5);
  const gaugeContainerRef = useRef<HTMLDivElement>(null);
  const ramTextRef = useRef<HTMLSpanElement>(null);
  const [isSolverLoopActive, setIsSolverLoopActive] = useState(false);
  const telemetryIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to add log messages
  const addLog = (type: ConsoleLog["type"], text: string) => {
    setConsoleLogs((prev) => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random()}`,
        type,
        text,
      },
    ]);
  };

  // Proof status evaluator memoized to re-calculate only when graph edges or nodes change
  const { isC_Proven, isE_Proven } = React.useMemo(() => {
    // C is proven if both A and B point to C
    const hasAtoC = edges.some((e) => e.source === "A" && e.target === "C");
    const hasBtoC = edges.some((e) => e.source === "B" && e.target === "C");
    const isC_Proven = hasAtoC && hasBtoC;

    // E is proven if isC_Proven and both C and D point to E
    const hasCtoE = edges.some((e) => e.source === "C" && e.target === "E");
    const hasDtoE = edges.some((e) => e.source === "D" && e.target === "E");
    const isE_Proven = isC_Proven && hasCtoE && hasDtoE;

    return { isC_Proven, isE_Proven };
  }, [edges]);

  const toggleSolverLoop = (newState?: boolean) => {
    setIsSolverLoopActive((prev) => {
      const next = newState !== undefined ? newState : !prev;
      if (next) {
        addLog(
          "info",
          "High-frequency mathematical solver loop initiated. RAM Telemetry active."
        );
      } else {
        addLog("info", "Solver loop telemetry simulation suspended.");
      }
      return next;
    });
  };

  // Handle high-frequency telemetry solver loop animation with direct DOM mutations
  useEffect(() => {
    if (isSolverLoopActive) {
      const baseVal = 42.5;
      let tick = 0;
      telemetryIntervalRef.current = setInterval(() => {
        tick += 1;
        // Fluctuating RAM simulating real solver calculation cycles
        const noise = Math.sin(tick * 0.4) * 8 + Math.cos(tick * 0.15) * 4;
        const newPercent = clamp(
          baseVal +
            noise +
            (tick % 7 === 0 ? 10 : 0) -
            (tick % 11 === 0 ? 8 : 0),
          30.2,
          98.4
        );
        ramValRef.current = newPercent;

        // Direct DOM mutations to transient telemetry UI metrics - zero Virtual DOM re-renders
        if (gaugeContainerRef.current) {
          gaugeContainerRef.current.style.setProperty(
            "--gauge-progress",
            newPercent.toString()
          );
        }
        if (ramTextRef.current) {
          ramTextRef.current.textContent = `${newPercent.toFixed(0)}%`;
        }
      }, 80); // ~12.5 updates per second
    } else {
      if (telemetryIntervalRef.current) {
        clearInterval(telemetryIntervalRef.current);
        telemetryIntervalRef.current = null;
      }
    }

    return () => {
      if (telemetryIntervalRef.current) {
        clearInterval(telemetryIntervalRef.current);
        telemetryIntervalRef.current = null;
      }
    };
  }, [isSolverLoopActive]);

  // Scroll console internally to bottom without shifting viewport
  useEffect(() => {
    if (terminalLogsContainerRef.current) {
      terminalLogsContainerRef.current.scrollTop =
        terminalLogsContainerRef.current.scrollHeight;
    }
  }, [consoleLogs]);

  // Connect two nodes
  const connectNodes = (src: string, tgt: string, quiet = false) => {
    const validIds = nodes.map((n) => n.id);
    if (!validIds.includes(src) || !validIds.includes(tgt)) {
      if (!quiet)
        addLog(
          "error",
          `Invalid node IDs: [${src}, ${tgt}]. Use A, B, C, D, E.`
        );
      return;
    }
    if (src === tgt) {
      if (!quiet) addLog("error", "Self-connections are forbidden.");
      return;
    }
    // Prevent reverse connections or duplicates
    const alreadyConnected = edges.some(
      (e) => e.source === src && e.target === tgt
    );
    if (alreadyConnected) {
      if (!quiet)
        addLog(
          "error",
          `Pathway from Node ${src} to Node ${tgt} is already active.`
        );
      return;
    }

    // Capture state in rollback stack
    setHistory((prev) => [...prev, edges]);
    setEdges((prev) => [...prev, { source: src, target: tgt }]);
    if (!quiet) {
      addLog("success", `Established directed path: Node ${src} → Node ${tgt}`);
    }
  };

  // Disconnect two nodes
  const disconnectNodes = (src: string, tgt: string) => {
    const edgeIndex = edges.findIndex(
      (e) => e.source === src && e.target === tgt
    );

    if (edgeIndex === -1) {
      addLog(
        "error",
        `No active pathway from Node ${src} to Node ${tgt} exists.`
      );
      return;
    }

    // Capture state in rollback stack
    setHistory((prev) => [...prev, edges]);
    setEdges((prev) => prev.filter((_, idx) => idx !== edgeIndex));
    addLog("success", `Severed path: Node ${src} ↛ Node ${tgt}`);
  };

  // Rollback state function
  const executeRollback = () => {
    if (history.length > 0) {
      const previousEdges = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      setEdges(previousEdges);
      addLog(
        "success",
        "Successfully rolled back proof connection configuration to previous state."
      );
    } else {
      addLog("error", "Rollback failed: No historical step state recorded.");
    }
  };

  // Click handler on nodes
  const handleNodeClick = (nodeId: string) => {
    if (selectedNodeId === null) {
      setSelectedNodeId(nodeId);
      addLog(
        "info",
        `Selected Node ${nodeId}. Click another node to establish a directed pathway.`
      );
    } else {
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
        addLog("info", `Deselected Node ${nodeId}.`);
      } else {
        // Attempt connect
        connectNodes(selectedNodeId, nodeId);
        setSelectedNodeId(null);
      }
    }
  };

  // Command parser
  const runCliCommand = (cmdText: string) => {
    const trimmed = cmdText.trim();
    if (!trimmed) return;

    // Log command
    setConsoleLogs((prev) => [
      ...prev,
      { id: `cmd-${Date.now()}`, type: "command", text: trimmed },
    ]);
    setConsoleInput("");

    // History queue
    setCliHistory((prev) => {
      const filtered = prev.filter((c) => c !== trimmed);
      return [...filtered, trimmed];
    });
    setCliHistoryIdx(-1);

    const tokens = trimmed.split(/\s+/);
    const op = tokens[0].toLowerCase();
    const arg1 = tokens[1]?.toUpperCase();
    const arg2 = tokens[2]?.toUpperCase();

    if (op === "help") {
      addLog(
        "info",
        "Command Reference Checklist:\n" +
          "  connect <S> <T>    - Establish pathway from Node S to Node T (e.g. connect A C)\n" +
          "  disconnect <S> <T> - Sever pathway from Node S to Node T\n" +
          "  rollback           - Roll back to previous connection structure\n" +
          "  simulate           - Toggle simulated mathematical solver loops (RAM updates)\n" +
          "  clear              - Clear terminal workspace\n" +
          "  help               - View commands"
      );
      return;
    }

    if (op === "clear") {
      setConsoleLogs([]);
      return;
    }

    if (op === "rollback") {
      executeRollback();
      return;
    }

    if (op === "simulate") {
      toggleSolverLoop();
      return;
    }

    if (op === "connect") {
      if (!arg1 || !arg2) {
        addLog(
          "error",
          "Syntax Error: 'connect' requires source and target. Example: connect A C"
        );
        return;
      }
      connectNodes(arg1, arg2);
      return;
    }

    if (op === "disconnect") {
      if (!arg1 || !arg2) {
        addLog(
          "error",
          "Syntax Error: 'disconnect' requires source and target. Example: disconnect A C"
        );
        return;
      }
      disconnectNodes(arg1, arg2);
      return;
    }

    addLog(
      "error",
      `Unrecognized command: '${tokens[0]}'. Type 'help' for registry references.`
    );
  };

  // Auto-complete suggestion
  const getSuggestion = (inputVal: string): string => {
    const val = inputVal.trim().toLowerCase();
    if (!val) return "";
    const commands = [
      "connect",
      "disconnect",
      "rollback",
      "simulate",
      "clear",
      "help",
    ];
    const match = commands.find((c) => c.startsWith(val));
    return match ? match : "";
  };

  const suggestion = getSuggestion(consoleInput);

  // Keyboard controls in Terminal
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runCliCommand(consoleInput);
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (suggestion) {
        setConsoleInput(suggestion);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cliHistory.length === 0) return;
      const nextIdx =
        cliHistoryIdx === -1
          ? cliHistory.length - 1
          : Math.max(0, cliHistoryIdx - 1);
      setCliHistoryIdx(nextIdx);
      setConsoleInput(cliHistory[nextIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cliHistoryIdx === -1) return;
      const nextIdx = cliHistoryIdx + 1;
      if (nextIdx >= cliHistory.length) {
        setCliHistoryIdx(-1);
        setConsoleInput("");
      } else {
        setCliHistoryIdx(nextIdx);
        setConsoleInput(cliHistory[nextIdx]);
      }
    }
  };

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
                onClick={() => {
                  setHistory((prev) => [...prev, edges]);
                  setEdges([]);
                  addLog("info", "All pathways cleared.");
                }}
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

                // Absolute line coordinate calculations
                const x1 = s.x + 90;
                const y1 = s.y + 40;
                const x2 = t.x + 90;
                const y2 = t.y + 40;

                // Double check if connection is part of proven proof branch
                const isC_Active =
                  isC_Proven && (edge.source === "C" || edge.target === "C");
                const pathColor =
                  isC_Active || isE_Proven ? "#06b6d4" : "#0891b2";

                return (
                  <path
                    key={`edge-${idx}`}
                    d={`M ${x1} ${y1} L ${x2} ${y2}`}
                    stroke={pathColor}
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

                // Determine proven/active state dynamically
                let isProven = true; // Premises default true
                if (node.id === "C") isProven = isC_Proven;
                if (node.id === "E") isProven = isE_Proven;

                const cardWidth = 180;
                const cardHeight = 80;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => handleNodeClick(node.id)}
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
            </svg>

            {/* Floating click prompt guidance label */}
            <div className="absolute bottom-3 left-3 right-3 bg-zinc-950/80 border border-zinc-900 rounded-xl p-2.5 flex items-center justify-between select-none">
              <span className="text-[10px] font-mono text-muted leading-none">
                {selectedNodeId
                  ? `👉 Selected NODE ${selectedNodeId}. Click target node to draw directed branch.`
                  : "💡 Click a node, then click another node to connect them dynamically."}
              </span>
              <span className="text-[9px] font-mono bg-zinc-900 px-2 py-0.5 border border-zinc-850 rounded text-brand-cyan font-bold">
                GRAPHICS ACCELERATION // ON
              </span>
            </div>
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
                  <h4 className="text-xs font-black uppercase text-zinc-300 tracking-wider">
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
                  <h4 className="text-xs font-black uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
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
                  ref={consoleInputRef}
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
              <button
                onClick={() => setConsoleInput("connect A C")}
                className="px-2 py-0.5 text-[9px] font-mono bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-brand-cyan hover:border-brand-cyan/20 rounded-md cursor-pointer"
              >
                connect A C
              </button>
              <button
                onClick={() => setConsoleInput("connect B C")}
                className="px-2 py-0.5 text-[9px] font-mono bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-brand-cyan hover:border-brand-cyan/20 rounded-md cursor-pointer"
              >
                connect B C
              </button>
              <button
                onClick={() => setConsoleInput("connect C E")}
                className="px-2 py-0.5 text-[9px] font-mono bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-brand-cyan hover:border-brand-cyan/20 rounded-md cursor-pointer"
              >
                connect C E
              </button>
              <button
                onClick={() => setConsoleInput("connect D E")}
                className="px-2 py-0.5 text-[9px] font-mono bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-brand-cyan hover:border-brand-cyan/20 rounded-md cursor-pointer"
              >
                connect D E
              </button>
              <button
                onClick={() => setConsoleInput("rollback")}
                className="px-2 py-0.5 text-[9px] font-mono bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-brand-cyan hover:border-brand-cyan/20 rounded-md cursor-pointer"
              >
                rollback
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
