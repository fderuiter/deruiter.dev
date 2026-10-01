"use client";

import React, { useState, useEffect, useRef } from "react";
import { clamp } from "@/lib/game-utils";
import { copyToClipboard } from "@/lib/clipboard";
import {
  IconTerminal,
  IconCornerDownLeft,
  IconHistory,
  IconCpu,
  IconRefresh,
  IconCheck,
  IconCircleDot,
  IconFileCode,
  IconGitCompare,
  IconCopy,
  IconDownload,
  IconX,
} from "@tabler/icons-react";
import type {
  StudyProtocol,
  CRFForm,
  EditCheckRule,
  StudyVisit,
} from "@/lib/crf/types";
import {
  UniversalCrfProtocolSchema,
  exportUniversalCrfJson,
  exportUniversalCrfYaml,
} from "@/lib/crf/universal-schema";
import { exportStudyToCdiscOdmXml } from "@/lib/crf/odm-xml-serializer";
import { compareStudyToBaseline } from "@/lib/crf/study-baseline-diff";

export interface Node {
  id: string;
  label: string;
  type: "premise" | "intermediate" | "conclusion";
  formula: string;
  description: string;
  x: number;
  y: number;
}

export interface Edge {
  source: string;
  target: string;
}

export interface ConsoleLog {
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

/**
 * Client-Side In-Memory Schema Compiler
 * Compiles active visual node and edge graph state into a standardized StudyProtocol data structure
 * adhering to Zod UniversalCrfProtocolSchema specification.
 */
export function compileGraphToProtocol(
  nodes: Node[],
  edges: Edge[]
): StudyProtocol {
  const forms: CRFForm[] = nodes.map((node) => {
    const domain =
      node.type === "premise"
        ? "DM"
        : node.type === "intermediate"
          ? "QS"
          : "DS";
    const varName = `VAR_${node.id}`;

    // Map directed edges targeting or originating from this node into CDISC edit check rules
    const formRules: EditCheckRule[] = edges
      .filter((e) => e.target === node.id)
      .map((edge) => ({
        id: `RULE_${edge.source}_TO_${edge.target}`,
        name: `Pathway Dependency: Node ${edge.source} -> Node ${edge.target}`,
        description: `Enforces directed logical pathway dependency from ${edge.source} to ${edge.target}`,
        triggerFieldIds: [`FLD_${edge.source}`],
        targetFieldId: `FLD_${edge.target}`,
        actionType: "require_field",
        conditions: [
          {
            fieldId: `FLD_${edge.source}`,
            operator: "is_not_empty",
            value: "active",
          },
        ],
        logicalOperator: "AND",
      }));

    return {
      id: `FORM_${node.id}`,
      name: `${node.label} (${node.type.toUpperCase()})`,
      domain,
      description: node.description,
      version: "1.0",
      sections: [
        {
          id: `SEC_${node.id}`,
          title: `${node.label} Specification Section`,
          description: `Specification section for visual node ${node.id}`,
          fields: [
            {
              id: `FLD_${node.id}`,
              variableName: varName,
              label: `${node.label}: ${node.description}`,
              description: node.description,
              dataType: "text",
              columnSpan: 6,
              required: true,
              calculationFormula: node.formula,
              cdashMetadata: {
                domain,
                sdtmVariable: varName,
                cdashLabel: node.label,
                core: "HR",
                acrfAnnotation: `${domain}.${varName}`,
              },
            },
          ],
        },
      ],
      rules: formRules,
    };
  });

  const visits: StudyVisit[] = [
    {
      id: "VISIT_PREMISES",
      oid: "VISIT_PREMISES",
      name: "Premise Inputs & Baseline",
      visitType: "Scheduled",
      targetDay: 1,
      windowBefore: 0,
      windowAfter: 0,
      assignedFormIds: nodes
        .filter((n) => n.type === "premise")
        .map((n) => `FORM_${n.id}`),
    },
    {
      id: "VISIT_INTERMEDIATE",
      oid: "VISIT_INTERMEDIATE",
      name: "Intermediate Reasoning Flow",
      visitType: "Scheduled",
      targetDay: 14,
      windowBefore: 2,
      windowAfter: 2,
      assignedFormIds: nodes
        .filter((n) => n.type === "intermediate")
        .map((n) => `FORM_${n.id}`),
    },
    {
      id: "VISIT_CONCLUSION",
      oid: "VISIT_CONCLUSION",
      name: "Conclusion Verification",
      visitType: "Scheduled",
      targetDay: 28,
      windowBefore: 3,
      windowAfter: 3,
      assignedFormIds: nodes
        .filter((n) => n.type === "conclusion")
        .map((n) => `FORM_${n.id}`),
    },
  ];

  return {
    $schema: "https://schema.deruiter.dev/universal-crf/v1.0.0.json",
    schemaVersion: "1.0.0",
    id: "SCHEMAFLOW-PROTOCOL-001",
    protocolNumber: "SFLOW-2026-001",
    protocolId: "SFLOW-2026-001",
    studyName: "SchemaFlow Reactive Compiled Protocol",
    title: "SchemaFlow Interactive Graph Protocol",
    phase: "Phase III",
    sponsor: "SchemaFlow Data Management",
    therapeuticArea: "Clinical Informatics",
    version: "1.0.0",
    lastModified: "2026-10-01T00:00:00.000Z",
    forms,
    visits,
    codelists: [],
    rules: [],
    arms: [
      {
        id: "ARM_MAIN",
        name: "Main Logical Tactic Arm",
        type: "Experimental",
        description: "Primary branch for graph evaluation",
      },
    ],
    epochs: [
      {
        id: "EPOCH_MAIN",
        name: "Protocol Execution Epoch",
        sequenceNumber: 1,
      },
    ],
    cohorts: [],
    biomedicalConcepts: [],
    testScenarios: [],
  };
}

export default function SchemaFlowWorkspace() {
  const [nodes] = useState<Node[]>(DEFAULT_NODES);
  const [edges, setEdges] = useState<Edge[]>(DEFAULT_EDGES);
  const [history, setHistory] = useState<Edge[][]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Initial baseline snapshot for SDTM structural diff comparisons
  const [baselineSnapshot, setBaselineSnapshot] = useState<StudyProtocol>(() =>
    compileGraphToProtocol(DEFAULT_NODES, DEFAULT_EDGES)
  );
  const [baselineVersionTag, setBaselineVersionTag] = useState("v1.0.0");

  // Export & Diff UI Drawers State
  const [isExportDrawerOpen, setIsExportDrawerOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "yaml" | "odm">(
    "json"
  );
  const [isDiffPanelOpen, setIsDiffPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Synchronous, memoized client-side protocol compilation
  const compiledStudy = React.useMemo(() => {
    const study = compileGraphToProtocol(nodes, edges);
    // Sanity-check Zod validation
    UniversalCrfProtocolSchema.safeParse(study);
    return study;
  }, [nodes, edges]);

  // Synchronous, memoized real-time SDTM baseline diff comparison
  const diffResult = React.useMemo(() => {
    return compareStudyToBaseline(compiledStudy, baselineSnapshot, {
      id: "baseline-snapshot",
      versionTag: baselineVersionTag,
      label: "Initial Protocol Snapshot",
    });
  }, [compiledStudy, baselineSnapshot, baselineVersionTag]);

  // Synchronous, memoized format serialization
  const exportOutput = React.useMemo(() => {
    switch (exportFormat) {
      case "json":
        return exportUniversalCrfJson(compiledStudy);
      case "yaml":
        return exportUniversalCrfYaml(compiledStudy);
      case "odm":
        return exportStudyToCdiscOdmXml(compiledStudy);
      default:
        return exportUniversalCrfJson(compiledStudy);
    }
  }, [compiledStudy, exportFormat]);

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
        // prettier-ignore
        if (gaugeContainerRef.current) { gaugeContainerRef.current.style.setProperty("--gauge-progress", newPercent.toString()); }
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

  // File Download Helper
  const handleDownloadExport = () => {
    const extensionMap = {
      json: "json",
      yaml: "yaml",
      odm: "xml",
    };
    const mimeMap = {
      json: "application/json",
      yaml: "text/yaml",
      odm: "application/xml",
    };
    const ext = extensionMap[exportFormat];
    const mime = mimeMap[exportFormat];
    const blob = new Blob([exportOutput], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schemaflow-protocol-export.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog(
      "success",
      `Downloaded compiled schema file: schemaflow-protocol-export.${ext}`
    );
  };

  // Clipboard Copy Helper
  const handleCopyExport = async () => {
    try {
      await copyToClipboard(exportOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addLog(
        "info",
        `Copied ${exportFormat.toUpperCase()} schema export to clipboard.`
      );
    } catch (err) {
      addLog(
        "error",
        `Failed to copy schema export: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  // Update baseline snapshot
  const handleSnapshotBaseline = () => {
    setBaselineSnapshot(compiledStudy);
    const parts = baselineVersionTag.replace(/^v/, "").split(".");
    const minor = parseInt(parts[1] || "0", 10) + 1;
    const nextTag = `v${parts[0] || "1"}.${minor}.0`;
    setBaselineVersionTag(nextTag);
    addLog(
      "success",
      `✔ Baseline snapshot updated to ${nextTag}. Current graph is now baseline.`
    );
  };

  // Command parser
  const runCliCommand = (cmdText: string) => {
    const trimmed = cmdText.trim();
    if (!trimmed) return;

    // Log command
    setConsoleLogs((prev) => [
      ...prev,
      {
        id: `cmd-${Date.now()}-${Math.random()}`,
        type: "command",
        text: trimmed,
      },
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
    const arg1 = tokens[1]?.toLowerCase();
    const arg2 = tokens[2]?.toLowerCase();

    if (op === "help") {
      addLog(
        "info",
        "Command Reference Checklist:\n" +
          "  connect <S> <T>        - Establish pathway from Node S to Node T (e.g. connect A C)\n" +
          "  disconnect <S> <T>     - Sever pathway from Node S to Node T\n" +
          "  export [json|yaml|odm] - Export compiled schema in JSON, YAML, or CDISC ODM XML\n" +
          "  diff                   - Open live SDTM structural diff panel\n" +
          "  rollback               - Roll back to previous connection structure\n" +
          "  simulate               - Toggle simulated mathematical solver loops (RAM updates)\n" +
          "  clear                  - Clear terminal workspace\n" +
          "  help                   - View commands"
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

    if (op === "export") {
      const formatArg = arg1 || "json";
      let targetFmt: "json" | "yaml" | "odm" = "json";
      if (formatArg === "yaml" || formatArg === "yml") targetFmt = "yaml";
      else if (formatArg === "odm" || formatArg === "xml") targetFmt = "odm";
      else targetFmt = "json";

      setExportFormat(targetFmt);
      setIsExportDrawerOpen(true);
      addLog(
        "success",
        `✔ Exported schema as ${targetFmt.toUpperCase()} (${(exportOutput.length / 1024).toFixed(1)} KB). Export drawer active.`
      );
      return;
    }

    if (op === "diff") {
      setIsDiffPanelOpen(true);
      const summary = diffResult.summary;
      addLog(
        "success",
        `✔ Structural Diff against baseline ${baselineVersionTag}: ${summary.totalChanges} change(s) [${summary.addedCount} added, ${summary.removedCount} removed, ${summary.modifiedCount} modified].`
      );
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
      connectNodes(arg1.toUpperCase(), arg2.toUpperCase());
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
      disconnectNodes(arg1.toUpperCase(), arg2.toUpperCase());
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
      "export",
      "export json",
      "export yaml",
      "export odm",
      "diff",
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
    <div className="w-full flex flex-col gap-6 font-sans relative">
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
          <div className="flex flex-wrap justify-between items-center border-b border-zinc-900 pb-3 gap-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-brand-cyan font-bold bg-brand-cyan/5 px-2 py-0.5 rounded border border-brand-cyan/20">
                declarative svg layout // reactive compiler
              </span>
              <h3 className="text-sm font-extrabold text-white mt-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-cyan animate-pulse"></span>
                Proof Tactic Vector Canvas
              </h3>
            </div>

            {/* Action buttons: Export Schema, Baseline Diff, Rollback, Reset */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                data-testid="export-schema-btn"
                onClick={() => setIsExportDrawerOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan rounded-xl hover:bg-brand-cyan/20 transition-all cursor-pointer"
                title="Open Schema Export Drawer (JSON, YAML, CDISC ODM XML)"
                aria-label="Export Schema Drawer"
              >
                <IconFileCode className="w-3.5 h-3.5" />
                Export Schema
              </button>

              <button
                data-testid="baseline-diff-btn"
                onClick={() => setIsDiffPanelOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl hover:border-brand-cyan/40 transition-all cursor-pointer relative"
                title="Open Structural SDTM Baseline Diff Panel"
                aria-label="Baseline Diff Panel"
              >
                <IconGitCompare className="w-3.5 h-3.5 text-zinc-400" />
                Baseline Diff
                {diffResult.summary.totalChanges > 0 ? (
                  <span className="ml-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                    {diffResult.summary.totalChanges}
                  </span>
                ) : (
                  <span className="ml-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                    0
                  </span>
                )}
              </button>

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
                onClick={() => runCliCommand("export json")}
                className="px-2 py-0.5 text-[9px] font-mono bg-zinc-900 border border-zinc-850 text-brand-cyan hover:bg-brand-cyan/10 rounded-md cursor-pointer"
              >
                export json
              </button>
              <button
                onClick={() => runCliCommand("export yaml")}
                className="px-2 py-0.5 text-[9px] font-mono bg-zinc-900 border border-zinc-850 text-brand-cyan hover:bg-brand-cyan/10 rounded-md cursor-pointer"
              >
                export yaml
              </button>
              <button
                onClick={() => runCliCommand("export odm")}
                className="px-2 py-0.5 text-[9px] font-mono bg-zinc-900 border border-zinc-850 text-brand-cyan hover:bg-brand-cyan/10 rounded-md cursor-pointer"
              >
                export odm
              </button>
              <button
                onClick={() => runCliCommand("diff")}
                className="px-2 py-0.5 text-[9px] font-mono bg-zinc-900 border border-zinc-850 text-amber-400 hover:bg-amber-400/10 rounded-md cursor-pointer"
              >
                diff
              </button>
              <button
                onClick={() => setConsoleInput("connect B C")}
                className="px-2 py-0.5 text-[9px] font-mono bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-brand-cyan hover:border-brand-cyan/20 rounded-md cursor-pointer"
              >
                connect B C
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

      {/* Reactive Export Drawer Side Panel */}
      {isExportDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-label="Compiled Schema Export Drawer"
        >
          <div className="w-full max-w-2xl bg-zinc-950 border-l border-zinc-850 h-full flex flex-col p-6 shadow-2xl overflow-hidden font-mono">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30 rounded">
                    Client-Side Compiler
                  </span>
                  <span className="text-[10px] text-zinc-400 font-bold">
                    Zod Universal CRF Protocol
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-white mt-1 flex items-center gap-2">
                  <IconFileCode className="w-5 h-5 text-brand-cyan" />
                  Live Compiled Schema Export
                </h3>
              </div>
              <button
                onClick={() => setIsExportDrawerOpen(false)}
                className="p-1 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                aria-label="Close Export Drawer"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Format Switcher Tabs */}
            <div className="flex items-center justify-between py-4 border-b border-zinc-900 gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat("json")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    exportFormat === "json"
                      ? "bg-brand-cyan/20 border-brand-cyan text-brand-cyan shadow-sm"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  JSON Format
                </button>
                <button
                  onClick={() => setExportFormat("yaml")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    exportFormat === "yaml"
                      ? "bg-brand-cyan/20 border-brand-cyan text-brand-cyan shadow-sm"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  YAML Format
                </button>
                <button
                  onClick={() => setExportFormat("odm")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    exportFormat === "odm"
                      ? "bg-brand-cyan/20 border-brand-cyan text-brand-cyan shadow-sm"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  CDISC ODM XML
                </button>
              </div>

              {/* Action Buttons: Copy & Download */}
              <div className="flex gap-2">
                <button
                  onClick={handleCopyExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 rounded-xl transition-all cursor-pointer"
                  title="Copy formatted schema to clipboard"
                >
                  {copied ? (
                    <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <IconCopy className="w-3.5 h-3.5" />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={handleDownloadExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-brand-cyan hover:bg-brand-cyan/90 text-zinc-950 rounded-xl transition-all cursor-pointer font-sans"
                  title="Download schema file"
                >
                  <IconDownload className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>

            {/* Code Output Viewer with Syntax Highlighting */}
            <div className="flex-1 mt-4 bg-zinc-900/80 border border-zinc-850 rounded-2xl p-4 overflow-y-auto font-mono text-[11px] leading-relaxed text-zinc-200 select-text">
              <pre className="whitespace-pre-wrap break-all">
                {exportOutput}
              </pre>
            </div>

            {/* Drawer Footer Status */}
            <div className="pt-4 mt-2 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-400">
              <span>Sync Status: Reactive live compile (&lt; 16ms)</span>
              <span>Size: {(exportOutput.length / 1024).toFixed(2)} KB</span>
            </div>
          </div>
        </div>
      )}

      {/* Reactive SDTM Baseline Structural Diff Panel */}
      {isDiffPanelOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-label="Structural SDTM Baseline Diff Panel"
        >
          <div className="w-full max-w-2xl bg-zinc-950 border-l border-zinc-850 h-full flex flex-col p-6 shadow-2xl overflow-hidden font-sans">
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-900 font-mono">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                    Real-time SDTM Diff
                  </span>
                  <span className="text-[10px] text-zinc-400 font-bold">
                    Baseline: {baselineVersionTag}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-white mt-1 flex items-center gap-2">
                  <IconGitCompare className="w-5 h-5 text-amber-400" />
                  Baseline Structural SDTM Comparison
                </h3>
              </div>
              <button
                onClick={() => setIsDiffPanelOpen(false)}
                className="p-1 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                aria-label="Close Diff Panel"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Counters Grid */}
            <div className="grid grid-cols-4 gap-3 py-4 border-b border-zinc-900 font-mono text-center">
              <div className="bg-zinc-900/60 border border-zinc-850 rounded-xl p-2.5">
                <span className="text-[9px] text-zinc-400 uppercase tracking-wider block font-bold">
                  Total Changes
                </span>
                <span className="text-base font-black text-white mt-0.5 block">
                  {diffResult.summary.totalChanges}
                </span>
              </div>
              <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-2.5">
                <span className="text-[9px] text-emerald-400/80 uppercase tracking-wider block font-bold">
                  Added
                </span>
                <span className="text-base font-black text-emerald-400 mt-0.5 block">
                  +{diffResult.summary.addedCount}
                </span>
              </div>
              <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-2.5">
                <span className="text-[9px] text-red-400/80 uppercase tracking-wider block font-bold">
                  Removed
                </span>
                <span className="text-base font-black text-red-400 mt-0.5 block">
                  -{diffResult.summary.removedCount}
                </span>
              </div>
              <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-2.5">
                <span className="text-[9px] text-amber-400/80 uppercase tracking-wider block font-bold">
                  Modified
                </span>
                <span className="text-base font-black text-amber-400 mt-0.5 block">
                  ~{diffResult.summary.modifiedCount}
                </span>
              </div>
            </div>

            {/* Category Breakdown Badges */}
            <div className="flex flex-wrap gap-2 py-3 border-b border-zinc-900 font-mono text-[10px]">
              {Object.entries(diffResult.summary.byCategory).map(
                ([cat, counts]) => {
                  const totalCat =
                    counts.added + counts.removed + counts.modified;
                  if (totalCat === 0) return null;
                  return (
                    <span
                      key={cat}
                      className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 flex items-center gap-1.5 font-bold"
                    >
                      <span className="uppercase text-muted">
                        {cat.replace("_", " ")}:
                      </span>
                      <span className="text-brand-cyan">{totalCat}</span>
                    </span>
                  );
                }
              )}
            </div>

            {/* Diff Entries List */}
            <div className="flex-1 mt-4 overflow-y-auto space-y-3 font-mono text-[11px]">
              {diffResult.entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center p-6 bg-zinc-900/20 border border-zinc-900 rounded-2xl">
                  <IconCheck className="w-8 h-8 text-emerald-400 mb-2" />
                  <p className="text-xs font-bold text-zinc-300">
                    No Structural Diff Detected
                  </p>
                  <p className="text-[10px] text-muted mt-1 max-w-sm">
                    Current active graph canvas matches the snapshot protocol
                    baseline ({baselineVersionTag}) identically.
                  </p>
                </div>
              ) : (
                diffResult.entries.map((entry, idx) => {
                  const isAdded = entry.changeType === "added";
                  const isRemoved = entry.changeType === "removed";

                  return (
                    <div
                      key={`diff-entry-${idx}-${entry.id}`}
                      className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                        isAdded
                          ? "bg-emerald-950/10 border-emerald-900/40 text-emerald-200"
                          : isRemoved
                            ? "bg-red-950/10 border-red-900/40 text-red-200"
                            : "bg-amber-950/10 border-amber-900/40 text-amber-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded border ${
                              isAdded
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                                : isRemoved
                                  ? "bg-red-500/20 border-red-500/40 text-red-300"
                                  : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                            }`}
                          >
                            {entry.changeType.toUpperCase()}
                          </span>
                          <span className="font-bold text-white text-xs">
                            {entry.label}
                          </span>
                        </div>
                        <span className="text-[9px] text-zinc-400 uppercase font-bold">
                          {entry.category}
                        </span>
                      </div>

                      {/* Breadcrumb Path */}
                      {entry.breadcrumb && entry.breadcrumb.length > 0 && (
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                          <span>Breadcrumb:</span>
                          <span className="text-zinc-200">
                            {entry.breadcrumb.join(" > ")}
                          </span>
                        </div>
                      )}

                      {/* Changed fields info */}
                      {entry.changedFields &&
                        entry.changedFields.length > 0 && (
                          <div className="text-[10px] text-amber-300/80 font-mono">
                            Modified attributes:{" "}
                            {entry.changedFields.join(", ")}
                          </div>
                        )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Panel Footer & Update Baseline Snapshot Action */}
            <div className="pt-4 mt-2 border-t border-zinc-900 flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 font-mono">
                Real-time SDTM Structural Diff Engine
              </span>
              <button
                onClick={handleSnapshotBaseline}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl transition-all cursor-pointer font-mono"
                title="Save current protocol graph state as new baseline snapshot"
              >
                <IconGitCompare className="w-3.5 h-3.5" />
                Snapshot New Baseline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
