"use client";

import { useCallback, useMemo, useState } from "react";
import {
  applyRuleToAsts,
  areAstsEqual,
  canConnect,
  evaluateProofStatus,
  exportWorkspaceProof,
  getDeductionLedger,
  getFallacyDiagnosis,
  getNextTacticHint,
  parseFormula,
  pruneStepOrNode,
  scanApplicableRules,
  solveNextDeductionStep,
  type Edge,
  type FallacyDiagnosis,
  type ProofNode,
  type TheoremDefinition,
  type TheoremId,
} from "@/lib/proof";
import type { TerminalLog } from "@/components/proof/ProofTerminalConsole";
import {
  PROOF_HELP_TEXT,
  formatLedger,
  formatNodeList,
  parseProofCommand,
} from "./proof-commands";

type ToastType = "success" | "error" | "info";

/** How the session reports what happened: toasts, screen reader text and sound. */
interface ProofSessionFeedback {
  toast: (
    message: string,
    type?: ToastType,
    options?: { announce?: boolean }
  ) => void;
  announce: (text: string) => void;
  playSuccess: () => void;
  playAutocomplete: () => void;
  playHover: () => void;
}

/** The workspace-level actions a terminal command or a click can hand back to the page. */
export interface ProofSessionOptions {
  theorem: TheoremDefinition;
  feedback: ProofSessionFeedback;
  /** A rejected step was diagnosed; the page shows the fallacy panel. */
  onFallacy: () => void;
  onInspect: (nodeId: string) => void;
  onSwitchTheorem: (theoremId: TheoremId) => void;
  onSimulate: (mode: "normal" | "loop") => void;
  onOpenExport: () => void;
}

export const WELCOME_LOG: TerminalLog = {
  id: "welcome",
  type: "info",
  text: "Interactive Logic Proof Canvas v3.0.0 · Multi-Theorem Formal Verification Suite\nClick nodes to select premises, fire inference rules from the Rule Palette, or run CLI commands. Type 'help' for command syntax.",
};

let proofLogCounter = 0;

/** A terminal log id that stays unique within one millisecond. */
export function makeLogId(prefix: string): string {
  proofLogCounter += 1;
  return `${prefix}-${Date.now()}-${proofLogCounter}`;
}

/** Sound is a nicety; a failing audio context never interrupts a proof step. */
function play(sound: () => void) {
  try {
    sound();
  } catch {}
}

function edgeJoins(edge: Edge, a: string, b: string, caseInsensitive = false) {
  const norm = (id: string) => (caseInsensitive ? id.toUpperCase() : id);
  const [s, t, x, y] = [norm(edge.source), norm(edge.target), norm(a), norm(b)];
  return (s === x && t === y) || (s === y && t === x);
}

/**
 * The proof graph, selection, fallacy diagnosis and terminal log for one
 * theorem, with every operation the canvas, ledger and terminal can run on
 * them. The page owns the URL hash, the theorem choice and the worker, and
 * hears about them through the callbacks in `options`.
 */
export function useProofSession(options: ProofSessionOptions) {
  const {
    theorem,
    feedback,
    onFallacy,
    onInspect,
    onSwitchTheorem,
    onSimulate,
    onOpenExport,
  } = options;
  const { toast, announce, playSuccess, playAutocomplete, playHover } =
    feedback;

  const [edges, setEdges] = useState<Edge[]>(theorem.initialEdges);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [currentFallacy, setCurrentFallacy] = useState<FallacyDiagnosis | null>(
    null
  );
  const [consoleLogs, setConsoleLogs] = useState<TerminalLog[]>([WELCOME_LOG]);

  const ruleMatches = useMemo(
    () =>
      scanApplicableRules(theorem.nodes, selectedNodeIds, theorem.targetNodeId),
    [theorem.nodes, selectedNodeIds, theorem.targetNodeId]
  );
  const { isE_Proven } = useMemo(
    () => evaluateProofStatus(edges, theorem),
    [edges, theorem]
  );
  const activeTacticHint = useMemo(
    () => getNextTacticHint(edges, theorem),
    [edges, theorem]
  );
  const deductionLedger = useMemo(
    () => getDeductionLedger(edges, theorem),
    [edges, theorem]
  );

  const appendLogs = useCallback((...logs: TerminalLog[]) => {
    setConsoleLogs((prev) => [...prev, ...logs]);
  }, []);

  const appendLog = useCallback(
    (prefix: string, type: TerminalLog["type"], text: string) => {
      appendLogs({ id: makeLogId(prefix), type, text });
    },
    [appendLogs]
  );

  /** Puts the graph back to `initialEdges` and drops the selection and diagnosis. */
  const resetGraph = useCallback((initialEdges: Edge[]) => {
    setEdges(initialEdges);
    setSelectedNodeIds([]);
    setCurrentFallacy(null);
  }, []);

  const diagnose = (sourceId: string, targetId: string) => {
    const fallacy = getFallacyDiagnosis(sourceId, targetId, edges, theorem);
    setCurrentFallacy(fallacy);
    onFallacy();
    return fallacy;
  };

  const connectNodes = (sourceId: string, targetId: string) => {
    const validation = canConnect(sourceId, targetId, edges, theorem);
    if (!validation.allowed) {
      const fallacy = diagnose(sourceId, targetId);
      toast(`Invalid Connection: ${fallacy.fallacyName}`, "error", {
        announce: false,
      });
      announce(
        `Connection rejected: ${fallacy.fallacyName}. ${validation.reason}`
      );
      appendLog(
        "err",
        "error",
        `[FALLACY DETECTED] ${fallacy.fallacyName}: ${validation.reason}\nFormula: ${fallacy.formalFormula}\nAnalogy: ${fallacy.softwareAnalogy}`
      );
      setSelectedNodeIds([]);
      return;
    }

    setEdges((prev) => [...prev, { source: sourceId, target: targetId }]);
    setSelectedNodeIds([]);
    setCurrentFallacy(null);
    play(playSuccess);
    toast(`✔ Connected Node ${sourceId} → Node ${targetId}!`, "success", {
      announce: false,
    });
    announce(`Successfully connected Node ${sourceId} to Node ${targetId}.`);

    const sNode = theorem.nodes.find((n) => n.id === sourceId);
    const tNode = theorem.nodes.find((n) => n.id === targetId);
    appendLogs(
      {
        id: makeLogId("cmd"),
        type: "command",
        text: `connect ${sourceId} ${targetId}`,
      },
      {
        id: makeLogId("out"),
        type: "success",
        text: `✔ Established edge: Node ${sourceId} (${sNode?.label}) → Node ${targetId} (${tNode?.label})`,
      }
    );
  };

  /** A connection cord dropped on a target the drag already validated. */
  const connectByDrag = (
    sourceId: string,
    targetId: string,
    ruleBadge: string | undefined
  ) => {
    setEdges((prev) => [...prev, { source: sourceId, target: targetId }]);
    play(playSuccess);
    toast(
      `Connected Node ${sourceId} to Node ${targetId} (${ruleBadge || "Inference"})`,
      "success",
      { announce: false }
    );
    announce(
      `Connected Node ${sourceId} to Node ${targetId} via ${ruleBadge || "deductive rule"}.`
    );
    appendLog(
      "drag-conn",
      "success",
      `Connected Node ${sourceId} → Node ${targetId} via interactive drag cord. Rule: ${ruleBadge || "Inference"}`
    );
  };

  /** A connection cord dropped on a target that cannot follow from the source. */
  const rejectDrag = (sourceId: string, targetId: string) => {
    const fallacy = diagnose(sourceId, targetId);
    toast(`Invalid Connection: ${fallacy.fallacyName}`, "error", {
      announce: false,
    });
    announce(`Connection rejected: ${fallacy.fallacyName}`);
  };

  const handleNodeClick = (nodeId: string, addToSelection = false) => {
    play(playHover);
    onInspect(nodeId);

    if (addToSelection) {
      const wasSelected = selectedNodeIds.includes(nodeId);
      setSelectedNodeIds(
        wasSelected
          ? selectedNodeIds.filter((id) => id !== nodeId)
          : [...selectedNodeIds, nodeId]
      );
      const message = `${wasSelected ? "Deselected" : "Selected"} Node ${nodeId} for rule application.`;
      toast(message, "info", { announce: false });
      announce(message);
      return;
    }

    if (selectedNodeIds.length === 0) {
      setSelectedNodeIds([nodeId]);
      toast(
        `Selected Node ${nodeId}. Pick another node or choose an Inference Rule.`,
        "info",
        { announce: false }
      );
      announce(`Selected Node ${nodeId}.`);
      return;
    }

    if (selectedNodeIds.includes(nodeId)) {
      setSelectedNodeIds((prev) => prev.filter((id) => id !== nodeId));
      toast(`Deselected Node ${nodeId}.`, "info", { announce: false });
      announce(`Deselected Node ${nodeId}.`);
      return;
    }

    if (selectedNodeIds.length === 1) {
      connectNodes(selectedNodeIds[0], nodeId);
      return;
    }

    setSelectedNodeIds([nodeId]);
  };

  const handleApplyRule = (ruleId: string, nodeIds = selectedNodeIds) => {
    if (nodeIds.length === 0) {
      toast(
        "Select premise/lemma nodes before applying an inference rule.",
        "info"
      );
      return;
    }

    const asts = nodeIds
      .map((id) => theorem.nodes.find((n) => n.id === id))
      .filter((n): n is ProofNode => Boolean(n))
      .map((n) => n.ast || parseFormula(n.label))
      .filter((ast): ast is NonNullable<typeof ast> => Boolean(ast));

    const ruleResult = applyRuleToAsts(ruleId, asts);
    const resultAst = ruleResult.success ? ruleResult.resultAst : undefined;

    if (!resultAst) {
      const fallacy = diagnose(nodeIds[0], nodeIds[1] || nodeIds[0]);
      const reason = ruleResult.explanation || fallacy.fallacyName;
      toast(`Rule Application Failed: ${reason}`, "error", { announce: false });
      announce(`Rule failed: ${reason}`);
      appendLog(
        "err",
        "error",
        `[RULE ERROR] ${reason}\n${fallacy.plainEnglish}`
      );
      return;
    }

    play(playSuccess);

    const autoTarget = theorem.nodes.find((node) => {
      if (node.type === "premise") return false;
      const nodeAst = node.ast || parseFormula(node.label);
      return nodeAst ? areAstsEqual(nodeAst, resultAst) : false;
    });

    if (!autoTarget) {
      toast(
        "The derived formula does not match an available workspace step.",
        "info"
      );
      return;
    }

    const newEdges: Edge[] = nodeIds
      .filter(
        (source) =>
          !edges.some(
            (edge) => edge.source === source && edge.target === autoTarget.id
          )
      )
      .map((source) => ({
        source,
        target: autoTarget.id,
        ruleApplied: ruleId.toUpperCase(),
      }));

    setEdges((prev) => [...prev, ...newEdges]);
    setSelectedNodeIds([]);
    setCurrentFallacy(null);
    toast(`✔ ${ruleResult.explanation}`, "success", { announce: false });
    announce(`Applied rule ${ruleId.toUpperCase()}: ${ruleResult.explanation}`);
    appendLogs(
      {
        id: makeLogId("cmd"),
        type: "command",
        text: `apply ${ruleId} ${nodeIds.join(" ")}`,
      },
      {
        id: makeLogId("out"),
        type: "success",
        text: `✔ ${ruleResult.explanation}`,
      }
    );
  };

  const handleAutoStep = () => {
    const autoStep = solveNextDeductionStep(
      theorem.nodes,
      edges,
      theorem.targetNodeId
    );
    const newEdges = autoStep.success ? (autoStep.newEdges ?? []) : [];

    if (newEdges.length > 0) {
      setEdges((prev) => [...prev, ...newEdges]);
      toast(
        `Auto-Step: Connected premises to Node ${autoStep.targetNodeId} (${autoStep.explanation})`,
        "success"
      );
      play(playSuccess);
      appendLogs(
        { id: makeLogId("cmd"), type: "command", text: "autostep" },
        {
          id: makeLogId("out"),
          type: "success",
          text: `✔ ${autoStep.explanation}`,
        }
      );
    } else if (autoStep.message) {
      toast(autoStep.message, "info");
    } else {
      toast("Goal already fully discharged (Q.E.D.)!", "success");
    }
  };

  const handleDeleteStep = (stepOrNode: number | string) => {
    const result = pruneStepOrNode(stepOrNode, edges, theorem);
    if (!result.success) {
      toast(result.reason, "error", { announce: false });
      announce(result.reason);
      appendLog("err", "error", `[PRUNE ERROR] ${result.reason}`);
      return;
    }

    setEdges(result.newEdges);
    setCurrentFallacy(null);
    toast(`✔ ${result.reason}`, "info", { announce: false });
    announce(result.reason);
    play(playAutocomplete);
    appendLog("prune", "info", `✔ ${result.reason}`);
  };

  /** Undoes the step the current diagnosis is about, then clears the diagnosis. */
  const handleRollback = () => {
    if (!currentFallacy) return;

    const sId = currentFallacy.sourceId;
    const tId = currentFallacy.targetId;
    const withoutPair = (a: string, b: string) =>
      edges.filter((e) => !edgeJoins(e, a, b, true));

    let updatedEdges = [...edges];

    if (tId) {
      const targetNode = theorem.nodes.find(
        (n) => n.id.toUpperCase() === tId.toUpperCase()
      );
      const isPremise =
        targetNode?.type === "premise" ||
        ["A", "B", "D"].includes(tId.toUpperCase());

      if (!isPremise && targetNode) {
        const pruneRes = pruneStepOrNode(tId, edges, theorem);
        if (pruneRes.success) {
          updatedEdges = pruneRes.newEdges;
        } else if (sId) {
          updatedEdges = withoutPair(sId, tId);
        }
      } else if (sId) {
        updatedEdges = withoutPair(sId, tId);
      }
    } else if (updatedEdges.length > 0) {
      updatedEdges = updatedEdges.slice(0, -1);
    }

    setEdges(updatedEdges);
    setCurrentFallacy(null);

    const rollbackMsg =
      sId && tId
        ? `Rolled back step (${sId} → ${tId}) and cleared fallacy diagnosis.`
        : "Rolled back invalid step and cleared fallacy diagnosis.";

    toast(`✔ ${rollbackMsg}`, "info", { announce: false });
    announce(rollbackMsg);
    play(playAutocomplete);
    appendLog("rollback", "info", `✔ [ROLLBACK] ${rollbackMsg}`);
  };

  /** Runs one terminal line. The caller has already echoed it. */
  const runCommand = (rawInput: string) => {
    const command = parseProofCommand(rawInput);
    if (!command) return;

    switch (command.op) {
      case "help":
        appendLog("help", "info", PROOF_HELP_TEXT);
        announce("Printed help manual.");
        return;
      case "clear":
        setConsoleLogs([]);
        announce("Cleared terminal logs.");
        return;
      case "list":
        appendLog("list", "info", formatNodeList(theorem, edges, isE_Proven));
        announce("Listed active nodes and connections.");
        return;
      case "usage":
        appendLog("err", "error", command.message);
        return;
      case "connect":
        connectNodes(command.source, command.target);
        return;
      case "disconnect": {
        const { source, target } = command;
        setEdges((prev) => prev.filter((e) => !edgeJoins(e, source, target)));
        appendLog(
          "disc",
          "info",
          `Removed edge between Node ${source} and Node ${target}.`
        );
        announce(`Disconnected Node ${source} and Node ${target}.`);
        return;
      }
      case "prune":
        handleDeleteStep(command.target);
        return;
      case "apply":
        handleApplyRule(command.rule, command.nodeIds);
        return;
      case "autostep":
        handleAutoStep();
        return;
      case "inspect": {
        const node = theorem.nodes.find((n) => n.id === command.nodeId);
        if (!node) {
          appendLog("err", "error", `Node '${command.nodeId}' not found.`);
          return;
        }
        onInspect(node.id);
        appendLog(
          "insp",
          "info",
          `[Node ${node.id}] ${node.label}\nType: ${node.type.toUpperCase()}\nFormula: ${node.label}\nDescription: ${node.description}\nMeaning: ${node.meaning}`
        );
        announce(`Inspecting Node ${node.id}.`);
        return;
      }
      case "theorem":
        if (command.theoremId) {
          onSwitchTheorem(command.theoremId);
        } else {
          appendLog(
            "err",
            "error",
            `Unknown theorem ID '${command.requested}'. Available: mp, mt, hs, ds, res, 2pc, quorum, cache, synod, paxos2b, bft, custom.`
          );
        }
        return;
      case "ledger":
        appendLog(
          "ledger",
          "info",
          formatLedger(theorem.title, deductionLedger)
        );
        announce("Printed deduction ledger.");
        return;
      case "export":
        if (command.format) {
          appendLog(
            "exp",
            "info",
            exportWorkspaceProof(command.format, edges, theorem)
          );
        } else {
          onOpenExport();
        }
        return;
      case "simulate":
        onSimulate(command.mode);
        return;
      case "unknown":
        appendLog(
          "err",
          "error",
          `Unknown command '${command.name}'. Type 'help' for available commands.`
        );
        return;
    }
  };

  return {
    edges,
    selectedNodeIds,
    currentFallacy,
    setCurrentFallacy,
    consoleLogs,
    ruleMatches,
    isE_Proven,
    activeTacticHint,
    deductionLedger,
    appendLogs,
    appendLog,
    resetGraph,
    connectNodes,
    connectByDrag,
    rejectDrag,
    handleNodeClick,
    handleApplyRule,
    handleAutoStep,
    handleDeleteStep,
    handleRollback,
    runCommand,
  };
}
