"use client";

import { useCallback, useMemo, useState } from "react";
import { useHistory } from "@/hooks/useHistory";
import { clamp } from "@/lib/utils";
import {
  applyRuleToAsts,
  areAstsEqual,
  canConnect,
  cascadePruneSandboxGraph,
  computeSandboxProvenNodeIds,
  evaluateProofStatus,
  exportWorkspaceProof,
  formatFormula,
  getDeductionLedger,
  getFallacyDiagnosis,
  getNextTacticHint,
  INFERENCE_RULES,
  parseFormula,
  pruneStepOrNode,
  scanApplicableRules,
  solveNextDeductionStep,
  type Edge,
  type FallacyDiagnosis,
  type ProofNode,
  type PropAst,
  type TheoremDefinition,
  type TheoremId,
} from "@/lib/proof";
import {
  buildSandboxNode,
  createSandboxTheorem,
  createStarterSandboxNodes,
  evaluateSandboxCountermodel,
  MAX_SANDBOX_NODES,
  parseCustomFormula,
} from "@/lib/proof-custom";
import type { TerminalLog } from "@/components/proof/ProofTerminalConsole";
import {
  PROOF_HELP_TEXT,
  formatLedger,
  formatNodeList,
  parseProofCommand,
} from "./proof-commands";

type ToastType = "success" | "error" | "info";

/** Composite graph snapshot stored in undo/redo history. */
interface ProofGraphSnapshot {
  nodes: ProofNode[];
  edges: Edge[];
}

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
  /** A rejected step or countermodel was diagnosed; the page shows the fallacy panel. */
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

function nextNodeId(
  prefix: string,
  existingNodes: readonly ProofNode[]
): string {
  const taken = new Set(existingNodes.map((n) => n.id.toUpperCase()));
  let idx = 1;
  while (taken.has(`${prefix}${idx}`.toUpperCase())) {
    idx += 1;
  }
  return `${prefix}${idx}`;
}

function findNonOverlappingSlot(
  preferredX: number,
  preferredY: number,
  existingNodes: readonly ProofNode[]
): { x: number; y: number } {
  const clampX = (v: number) => clamp(Math.round(v / 20) * 20, 40, 580);
  const clampY = (v: number) => clamp(Math.round(v / 20) * 20, 20, 330);

  const yOffsets = [0, 90, -90, 180, -180, 260, -260];
  const xOffsets = [0, 180, -180];

  for (const dx of xOffsets) {
    const cx = clampX(preferredX + dx);
    for (const dy of yOffsets) {
      const cy = clampY(preferredY + dy);
      const collides = existingNodes.some(
        (n) => Math.abs(n.x - cx) < 150 && Math.abs(n.y - cy) < 76
      );
      if (!collides) {
        return { x: cx, y: cy };
      }
    }
  }

  return {
    x: clampX(preferredX + (existingNodes.length % 3) * 40),
    y: clampY(preferredY + (existingNodes.length % 4) * 30),
  };
}

const MAX_HISTORY = 50;

/**
 * The proof graph, selection, fallacy diagnosis and terminal log for one
 * theorem or sandbox session, with every operation the canvas, ledger and
 * terminal can run on them.
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

  const history = useHistory<ProofGraphSnapshot>(
    {
      nodes: theorem.nodes,
      edges: theorem.initialEdges,
    },
    { capacity: MAX_HISTORY }
  );
  const nodes = theorem.isSandbox ? history.state.nodes : theorem.nodes;
  const edges = history.state.edges;
  const past = history.past;
  const future = history.future;
  const canUndo = history.canUndo;
  const canRedo = history.canRedo;

  const activeTheorem = useMemo(
    () => (theorem.isSandbox ? createSandboxTheorem(nodes, edges) : theorem),
    [theorem, nodes, edges]
  );

  const [rawSelectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const selectedNodeIds = useMemo(
    () =>
      rawSelectedNodeIds.filter((id) =>
        activeTheorem.nodes.some((n) => n.id === id)
      ),
    [rawSelectedNodeIds, activeTheorem.nodes]
  );

  const [currentFallacy, setCurrentFallacy] = useState<FallacyDiagnosis | null>(
    null
  );
  const [consoleLogs, setConsoleLogs] = useState<TerminalLog[]>([WELCOME_LOG]);

  const ruleMatches = useMemo(
    () =>
      scanApplicableRules(
        activeTheorem.nodes,
        selectedNodeIds,
        activeTheorem.targetNodeId
      ),
    [activeTheorem.nodes, selectedNodeIds, activeTheorem.targetNodeId]
  );
  const { isE_Proven } = useMemo(
    () => evaluateProofStatus(edges, activeTheorem),
    [edges, activeTheorem]
  );
  const activeTacticHint = useMemo(
    () => getNextTacticHint(edges, activeTheorem),
    [edges, activeTheorem]
  );
  const deductionLedger = useMemo(
    () => getDeductionLedger(edges, activeTheorem),
    [edges, activeTheorem]
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

  /** Puts the graph back to `initialEdges` (and optional `initialNodes`) and clears selection, diagnosis, and history stacks. */
  const resetGraph = useCallback(
    (initialEdges: Edge[], initialNodes?: ProofNode[]) => {
      history.reset({
        nodes: initialNodes ?? theorem.nodes,
        edges: initialEdges,
      });
      setSelectedNodeIds([]);
      setCurrentFallacy(null);
    },
    [history, theorem.nodes]
  );

  const applyGraphMutation = useCallback(
    (
      updater:
        ProofGraphSnapshot | ((prev: ProofGraphSnapshot) => ProofGraphSnapshot)
    ) => {
      history.set(updater);
    },
    [history]
  );

  const applyEdgeMutation = useCallback(
    (updater: Edge[] | ((prev: Edge[]) => Edge[])) => {
      history.set((prev) => {
        const nextEdges =
          typeof updater === "function" ? updater(prev.edges) : updater;
        if (nextEdges === prev.edges) return prev;
        return { nodes: prev.nodes, edges: nextEdges };
      });
    },
    [history]
  );

  const handleUndo = useCallback(() => {
    if (!history.canUndo) return;
    history.undo();
    setCurrentFallacy(null);
    play(playAutocomplete);
    toast("Undid last proof modification.", "info", { announce: false });
    announce("Undid last proof modification.");
    appendLog("undo", "info", "✔ Undid last proof step.");
  }, [history, playAutocomplete, toast, announce, appendLog]);

  const handleRedo = useCallback(() => {
    if (!history.canRedo) return;
    history.redo();
    setCurrentFallacy(null);
    play(playAutocomplete);
    toast("Redid proof step.", "info", { announce: false });
    announce("Redid proof step.");
    appendLog("redo", "info", "✔ Redid proof step.");
  }, [history, playAutocomplete, toast, announce, appendLog]);

  const diagnose = (sourceId: string, targetId: string) => {
    const fallacy = getFallacyDiagnosis(
      sourceId,
      targetId,
      edges,
      activeTheorem
    );
    setCurrentFallacy(fallacy);
    onFallacy();
    return fallacy;
  };

  const connectNodes = (sourceId: string, targetId: string) => {
    const validation = canConnect(sourceId, targetId, edges, activeTheorem);
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

    const sNode = activeTheorem.nodes.find(
      (n) => n.id.toUpperCase() === sourceId.toUpperCase()
    );
    const tNode = activeTheorem.nodes.find(
      (n) => n.id.toUpperCase() === targetId.toUpperCase()
    );
    const resolvedSource = sNode?.id ?? sourceId;
    const resolvedTarget = tNode?.id ?? targetId;

    applyEdgeMutation((prev) => [
      ...prev,
      { source: resolvedSource, target: resolvedTarget },
    ]);
    setSelectedNodeIds([]);
    setCurrentFallacy(null);
    play(playSuccess);
    toast(
      `✔ Connected Node ${resolvedSource} → Node ${resolvedTarget}!`,
      "success",
      { announce: false }
    );
    announce(
      `Successfully connected Node ${resolvedSource} to Node ${resolvedTarget}.`
    );

    appendLogs(
      {
        id: makeLogId("cmd"),
        type: "command",
        text: `connect ${resolvedSource} ${resolvedTarget}`,
      },
      {
        id: makeLogId("out"),
        type: "success",
        text: `✔ Established edge: Node ${resolvedSource} (${sNode?.label}) → Node ${resolvedTarget} (${tNode?.label})`,
      }
    );
  };

  /** A connection cord dropped on a target the drag already validated. */
  const connectByDrag = (
    sourceId: string,
    targetId: string,
    ruleBadge: string | undefined
  ) => {
    applyEdgeMutation((prev) => [
      ...prev,
      { source: sourceId, target: targetId },
    ]);
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
      if (activeTheorem.isSandbox) {
        const clickedNode = activeTheorem.nodes.find((n) => n.id === nodeId);
        const provenIds = computeSandboxProvenNodeIds(edges, activeTheorem);
        // In Sandbox Mode, clicking a second premise or already-proven step
        // adds it to the selection so binary rules fire without requiring Shift.
        if (
          clickedNode &&
          (clickedNode.type === "premise" || provenIds.has(clickedNode.id)) &&
          !canConnect(selectedNodeIds[0], nodeId, edges, activeTheorem).allowed
        ) {
          const nextSelection = [selectedNodeIds[0], nodeId];
          setSelectedNodeIds(nextSelection);
          const msg = `Selected Nodes ${nextSelection.join(" & ")} for rule application.`;
          toast(msg, "info", { announce: false });
          announce(msg);
          return;
        }
      }
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

    const matchedNodes = nodeIds
      .map((id) =>
        activeTheorem.nodes.find((n) => n.id.toUpperCase() === id.toUpperCase())
      )
      .filter((n): n is ProofNode => Boolean(n));

    if (activeTheorem.isSandbox && matchedNodes.length !== nodeIds.length) {
      toast("One or more selected nodes do not exist on the canvas.", "error");
      return;
    }

    if (activeTheorem.isSandbox) {
      const provenIds = computeSandboxProvenNodeIds(edges, activeTheorem);
      const unprovenSelected = matchedNodes.find((n) => !provenIds.has(n.id));
      if (unprovenSelected) {
        toast(
          `Node ${unprovenSelected.id} (${unprovenSelected.label}) is not yet proven. Select given premises or proven steps.`,
          "error"
        );
        return;
      }
    }

    const canonicalIds =
      matchedNodes.length > 0 ? matchedNodes.map((n) => n.id) : nodeIds;
    const asts = matchedNodes
      .map((n) => n.ast || parseFormula(n.label))
      .filter((ast): ast is NonNullable<typeof ast> => Boolean(ast));

    let ruleResult = applyRuleToAsts(ruleId, asts);
    // For Conjunction Intro, if a goal node explicitly expects the commuted conjunction, match it
    if (
      ruleResult.success &&
      ruleResult.resultAst &&
      ruleId.toLowerCase() === "and_intro" &&
      asts.length === 2
    ) {
      const hasDirectGoal = activeTheorem.nodes.some((node) => {
        if (node.type === "premise") return false;
        const nAst = node.ast || parseFormula(node.label);
        return nAst ? areAstsEqual(nAst, ruleResult.resultAst!) : false;
      });
      if (!hasDirectGoal) {
        const commuted = applyRuleToAsts(ruleId, [asts[1], asts[0]]);
        if (commuted.success && commuted.resultAst) {
          const matchesCommutedGoal = activeTheorem.nodes.some((node) => {
            if (node.type === "premise") return false;
            const nAst = node.ast || parseFormula(node.label);
            return nAst ? areAstsEqual(nAst, commuted.resultAst!) : false;
          });
          if (matchesCommutedGoal) {
            ruleResult = commuted;
          }
        }
      }
    }

    const resultAst = ruleResult.success ? ruleResult.resultAst : undefined;

    if (!resultAst) {
      const fallacy = diagnose(
        canonicalIds[0],
        canonicalIds[1] || canonicalIds[0]
      );
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

    const ruleDef = INFERENCE_RULES.find(
      (r) => r.id.toLowerCase() === ruleId.toLowerCase()
    );
    const ruleSymbol = ruleDef?.symbol ?? ruleId.toUpperCase();
    const ruleDisplayName = ruleDef?.name ?? ruleId.toUpperCase();

    // Prioritize conclusion nodes first so deriving the goal formula discharges the goal directly
    const autoTarget =
      activeTheorem.nodes.find((node) => {
        if (node.type !== "conclusion") return false;
        const nodeAst = node.ast || parseFormula(node.label);
        return nodeAst ? areAstsEqual(nodeAst, resultAst) : false;
      }) ??
      activeTheorem.nodes.find((node) => {
        if (node.type !== "intermediate") return false;
        const nodeAst = node.ast || parseFormula(node.label);
        return nodeAst ? areAstsEqual(nodeAst, resultAst) : false;
      });

    if (!autoTarget) {
      if (!activeTheorem.isSandbox) {
        play(playSuccess);
        toast(
          "The derived formula does not match an available workspace step.",
          "info"
        );
        return;
      }

      if (activeTheorem.nodes.length >= MAX_SANDBOX_NODES) {
        toast(
          `Sandbox canvas is capped at ${MAX_SANDBOX_NODES} nodes. Delete unused nodes before deriving additional steps.`,
          "error"
        );
        return;
      }

      const newId = nextNodeId("S", activeTheorem.nodes);
      const maxX = Math.max(...matchedNodes.map((n) => n.x));
      const avgY =
        matchedNodes.reduce((sum, n) => sum + n.y, 0) / matchedNodes.length;
      const pos = findNonOverlappingSlot(maxX + 210, avgY, activeTheorem.nodes);
      const formattedResult = formatFormula(resultAst);
      const spawnedNode: ProofNode = {
        id: newId,
        label: formattedResult,
        ast: resultAst,
        type: "intermediate",
        ruleUsed: ruleDisplayName,
        derivedFrom: canonicalIds,
        description: `Derived via ${ruleDisplayName}: ${formattedResult}`,
        meaning: `Derived from ${canonicalIds.join(", ")} via ${ruleDisplayName}`,
        x: pos.x,
        y: pos.y,
      };
      const spawnedEdges: Edge[] = canonicalIds.map((source) => ({
        source,
        target: newId,
        ruleApplied: ruleSymbol,
      }));

      applyGraphMutation((prev) => ({
        nodes: [...prev.nodes, spawnedNode],
        edges: [...prev.edges, ...spawnedEdges],
      }));
      play(playSuccess);
      setSelectedNodeIds([]);
      setCurrentFallacy(null);
      toast(
        `✔ Spawned Node ${newId} (${formattedResult}) via ${ruleDisplayName}`,
        "success",
        { announce: false }
      );
      announce(
        `Spawned intermediate Node ${newId}, ${formattedResult}, via ${ruleDisplayName}.`
      );
      appendLogs(
        {
          id: makeLogId("cmd"),
          type: "command",
          text: `apply ${ruleId} ${canonicalIds.join(" ")}`,
        },
        {
          id: makeLogId("out"),
          type: "success",
          text: `✔ Spawned Node ${newId} (${formattedResult}): ${ruleResult.explanation}`,
        }
      );
      return;
    }

    play(playSuccess);
    applyGraphMutation((prev) => {
      const newEdges: Edge[] = canonicalIds
        .filter(
          (source) =>
            !prev.edges.some(
              (edge) => edge.source === source && edge.target === autoTarget.id
            )
        )
        .map((source) => ({
          source,
          target: autoTarget.id,
          ruleApplied: ruleSymbol,
        }));
      if (newEdges.length === 0) return prev;
      const nextNodes = activeTheorem.isSandbox
        ? prev.nodes.map((n) =>
            n.id === autoTarget.id && !n.ruleUsed
              ? { ...n, ruleUsed: ruleDisplayName }
              : n
          )
        : prev.nodes;
      return {
        nodes: nextNodes,
        edges: [...prev.edges, ...newEdges],
      };
    });
    setSelectedNodeIds([]);
    setCurrentFallacy(null);
    toast(`✔ ${ruleResult.explanation}`, "success", { announce: false });
    announce(`Applied rule ${ruleId.toUpperCase()}: ${ruleResult.explanation}`);
    appendLogs(
      {
        id: makeLogId("cmd"),
        type: "command",
        text: `apply ${ruleId} ${canonicalIds.join(" ")}`,
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
      activeTheorem.nodes,
      edges,
      activeTheorem.targetNodeId
    );
    const newEdges = autoStep.success ? (autoStep.newEdges ?? []) : [];

    if (newEdges.length > 0) {
      applyEdgeMutation((prev) => [...prev, ...newEdges]);
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
      return;
    }

    // In Sandbox Mode, Auto-Step can also spawn the next unseen forward consequence
    if (
      activeTheorem.isSandbox &&
      !isE_Proven &&
      activeTheorem.nodes.length < MAX_SANDBOX_NODES
    ) {
      const provenIds = computeSandboxProvenNodeIds(edges, activeTheorem);
      const provenNodes = activeTheorem.nodes.filter((n) =>
        provenIds.has(n.id)
      );
      const existingAsts = activeTheorem.nodes
        .map((n) => n.ast || parseFormula(n.label))
        .filter((a): a is PropAst => Boolean(a));

      for (const pNode of provenNodes) {
        const pAst = pNode.ast || parseFormula(pNode.label);
        if (!pAst) continue;
        for (const rule of INFERENCE_RULES.filter((r) => r.arity === 1)) {
          const res = applyRuleToAsts(rule.id, [pAst]);
          if (
            res.success &&
            res.resultAst &&
            !existingAsts.some((a) => areAstsEqual(a, res.resultAst!))
          ) {
            handleApplyRule(rule.id, [pNode.id]);
            return;
          }
        }
      }

      for (let i = 0; i < provenNodes.length; i++) {
        for (let j = 0; j < provenNodes.length; j++) {
          if (i === j) continue;
          const ast1 = provenNodes[i].ast || parseFormula(provenNodes[i].label);
          const ast2 = provenNodes[j].ast || parseFormula(provenNodes[j].label);
          if (!ast1 || !ast2) continue;
          for (const rule of INFERENCE_RULES.filter(
            (r) => r.arity === 2 && r.id !== "and_intro"
          )) {
            const res = applyRuleToAsts(rule.id, [ast1, ast2]);
            if (
              res.success &&
              res.resultAst &&
              !existingAsts.some((a) => areAstsEqual(a, res.resultAst!))
            ) {
              handleApplyRule(rule.id, [provenNodes[i].id, provenNodes[j].id]);
              return;
            }
          }
        }
      }
    }

    if (autoStep.message) {
      toast(autoStep.message, "info");
    } else {
      toast("Goal already fully discharged (Q.E.D.)!", "success");
    }
  };

  const handleDeleteStep = (stepOrNode: number | string) => {
    const result = pruneStepOrNode(stepOrNode, edges, activeTheorem);
    if (!result.success) {
      toast(result.reason, "error", { announce: false });
      announce(result.reason);
      appendLog("err", "error", `[PRUNE ERROR] ${result.reason}`);
      return;
    }

    applyGraphMutation((prev) => {
      const liveTheorem = theorem.isSandbox
        ? createSandboxTheorem(prev.nodes, prev.edges)
        : theorem;
      const liveResult = pruneStepOrNode(stepOrNode, prev.edges, liveTheorem);
      if (!liveResult.success) return prev;
      return {
        nodes: liveResult.newNodes ?? prev.nodes,
        edges: liveResult.newEdges,
      };
    });
    setCurrentFallacy(null);
    toast(`✔ ${result.reason}`, "info", { announce: false });
    announce(result.reason);
    play(playAutocomplete);
    appendLog("prune", "info", `✔ ${result.reason}`);
  };

  /** Adds a new premise or goal node onto the Sandbox canvas. */
  const handleAddSandboxNode = useCallback(
    (
      role: "premise" | "conclusion",
      formulaInput: string
    ): { ok: boolean; error?: string; nodeId?: string } => {
      if (!activeTheorem.isSandbox) {
        return { ok: false, error: "Switch to Sandbox Mode to add nodes." };
      }
      if (activeTheorem.nodes.length >= MAX_SANDBOX_NODES) {
        const msg = `Sandbox canvas is capped at ${MAX_SANDBOX_NODES} nodes.`;
        toast(msg, "error");
        return { ok: false, error: msg };
      }

      let ast: PropAst;
      try {
        ast = parseCustomFormula(formulaInput);
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Invalid formula syntax.";
        return { ok: false, error: msg };
      }

      const prefix = role === "premise" ? "P" : "G";
      const id = nextNodeId(prefix, activeTheorem.nodes);
      const preferredX = role === "premise" ? 80 : 560;
      const rolePeerCount = activeTheorem.nodes.filter(
        (n) => n.type === role
      ).length;
      const preferredY = 85 + (rolePeerCount % 4) * 90;
      const pos = findNonOverlappingSlot(
        preferredX,
        preferredY,
        activeTheorem.nodes
      );

      const newNode = buildSandboxNode({
        id,
        label: formatFormula(ast),
        type: role,
        x: pos.x,
        y: pos.y,
      });

      // If adding a Goal node whose formula is already proven on the canvas, connect it automatically
      const provenIds = computeSandboxProvenNodeIds(edges, activeTheorem);
      const matchingProvenSource =
        role === "conclusion"
          ? activeTheorem.nodes.find((n) => {
              if (!provenIds.has(n.id)) return false;
              const nAst = n.ast || parseFormula(n.label);
              return nAst ? areAstsEqual(nAst, ast) : false;
            })
          : undefined;

      applyGraphMutation((prev) => ({
        nodes: [...prev.nodes, newNode],
        edges: matchingProvenSource
          ? [
              ...prev.edges,
              {
                source: matchingProvenSource.id,
                target: newNode.id,
                ruleApplied: "Reit",
              },
            ]
          : prev.edges,
      }));

      setCurrentFallacy(null);
      play(playSuccess);
      const roleTitle = role === "premise" ? "Premise" : "Goal";
      toast(`Added ${roleTitle} Node ${id} (${newNode.label}).`, "success", {
        announce: false,
      });
      announce(`Added ${roleTitle} Node ${id}, ${newNode.label}.`);
      appendLog(
        "sandbox-add",
        "success",
        `✔ Added ${roleTitle} Node ${id}: ${newNode.label}`
      );
      return { ok: true, nodeId: id };
    },
    [
      activeTheorem,
      edges,
      applyGraphMutation,
      playSuccess,
      toast,
      announce,
      appendLog,
    ]
  );

  /** Updates the formula of an existing Sandbox node and prunes invalidated downstream steps. */
  const handleUpdateSandboxNode = useCallback(
    (nodeId: string, formulaInput: string): { ok: boolean; error?: string } => {
      if (!activeTheorem.isSandbox) {
        return { ok: false, error: "Switch to Sandbox Mode to edit nodes." };
      }
      const existing = activeTheorem.nodes.find((n) => n.id === nodeId);
      if (!existing) {
        return { ok: false, error: `Node ${nodeId} not found.` };
      }

      let ast: PropAst;
      try {
        ast = parseCustomFormula(formulaInput);
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error ? error.message : "Invalid formula syntax.",
        };
      }

      const formatted = formatFormula(ast);
      if (existing.ast && areAstsEqual(existing.ast, ast)) {
        return { ok: true };
      }

      applyGraphMutation((prev) => {
        const updatedNodes = prev.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                label: formatted,
                ast,
                description: `${n.type === "premise" ? "Sandbox premise" : n.type === "conclusion" ? "Sandbox target goal" : "Derived step"}: ${formatted}`,
              }
            : n
        );
        // Cascade-remove any intermediate nodes whose derivations no longer hold
        const validProven = computeSandboxProvenNodeIds(prev.edges, {
          nodes: updatedNodes,
        });
        const removedInterIds = new Set(
          updatedNodes
            .filter((n) => n.type === "intermediate" && !validProven.has(n.id))
            .map((n) => n.id)
        );
        const survivingNodes = updatedNodes.filter(
          (n) => !removedInterIds.has(n.id)
        );
        const filteredEdges = prev.edges.filter(
          (e) =>
            !removedInterIds.has(e.source) && !removedInterIds.has(e.target)
        );
        const finalProven = computeSandboxProvenNodeIds(filteredEdges, {
          nodes: survivingNodes,
        });
        let finalEdges = filteredEdges.filter((e) => {
          const tgt = survivingNodes.find((n) => n.id === e.target);
          if (tgt?.type === "conclusion" && !finalProven.has(tgt.id)) {
            return false;
          }
          return true;
        });

        // If an edited Goal node now matches an already-proven node, auto-link it
        const editedAfter = survivingNodes.find((n) => n.id === nodeId);
        if (editedAfter?.type === "conclusion" && !finalProven.has(nodeId)) {
          const matchingProven = survivingNodes.find(
            (n) =>
              n.id !== nodeId &&
              finalProven.has(n.id) &&
              n.ast &&
              areAstsEqual(n.ast, ast)
          );
          if (matchingProven) {
            finalEdges = [
              ...finalEdges,
              {
                source: matchingProven.id,
                target: nodeId,
                ruleApplied: "Reit",
              },
            ];
          }
        }

        return { nodes: survivingNodes, edges: finalEdges };
      });

      setCurrentFallacy(null);
      play(playAutocomplete);
      toast(`Updated Node ${nodeId} to ${formatted}.`, "info", {
        announce: false,
      });
      announce(`Updated Node ${nodeId} formula to ${formatted}.`);
      appendLog(
        "sandbox-edit",
        "info",
        `✔ Updated Node ${nodeId}: ${formatted}`
      );
      return { ok: true };
    },
    [
      activeTheorem,
      applyGraphMutation,
      playAutocomplete,
      toast,
      announce,
      appendLog,
    ]
  );

  /** Records a completed node drag position in Sandbox history. */
  const handleMoveSandboxNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      if (!activeTheorem.isSandbox) return;
      const existing = activeTheorem.nodes.find((n) => n.id === nodeId);
      const rx = Math.round(x);
      const ry = Math.round(y);
      if (!existing || (existing.x === rx && existing.y === ry)) return;

      applyGraphMutation((prev) => ({
        nodes: prev.nodes.map((n) =>
          n.id === nodeId ? { ...n, x: rx, y: ry } : n
        ),
        edges: prev.edges,
      }));
    },
    [activeTheorem, applyGraphMutation]
  );

  /** Deletes a node on the Sandbox canvas and cascade-prunes dependent derived steps and edges. */
  const handleDeleteSandboxNode = useCallback(
    (nodeId: string) => {
      if (!activeTheorem.isSandbox) return;
      const pruneRes = cascadePruneSandboxGraph(
        nodeId,
        activeTheorem.nodes,
        edges,
        { deletePremiseNode: true, deleteGoalNode: true }
      );
      if (!pruneRes.success) {
        toast(pruneRes.reason, "error");
        return;
      }

      applyGraphMutation((prev) => {
        const liveRes = cascadePruneSandboxGraph(
          nodeId,
          prev.nodes,
          prev.edges,
          {
            deletePremiseNode: true,
            deleteGoalNode: true,
          }
        );
        if (!liveRes.success) return prev;
        return {
          nodes: liveRes.newNodes ?? prev.nodes,
          edges: liveRes.newEdges,
        };
      });

      setSelectedNodeIds((prev) => prev.filter((id) => id !== nodeId));
      setCurrentFallacy(null);
      play(playAutocomplete);
      toast(`✔ ${pruneRes.reason}`, "info", { announce: false });
      announce(pruneRes.reason);
      appendLog("sandbox-del", "info", `✔ ${pruneRes.reason}`);
    },
    [
      activeTheorem,
      edges,
      applyGraphMutation,
      playAutocomplete,
      toast,
      announce,
      appendLog,
    ]
  );

  /** Clears all nodes and edges on the Sandbox canvas as an undoable action. */
  const handleClearSandbox = useCallback(() => {
    if (!activeTheorem.isSandbox) return;
    if (activeTheorem.nodes.length === 0 && edges.length === 0) return;
    applyGraphMutation({ nodes: [], edges: [] });
    setSelectedNodeIds([]);
    setCurrentFallacy(null);
    play(playAutocomplete);
    toast("Cleared sandbox canvas.", "info", { announce: false });
    announce("Cleared sandbox canvas.");
    appendLog(
      "sandbox-clear",
      "info",
      "✔ Cleared all sandbox nodes and edges."
    );
  }, [
    activeTheorem,
    edges.length,
    applyGraphMutation,
    playAutocomplete,
    toast,
    announce,
    appendLog,
  ]);

  /** Populates an empty Sandbox canvas with a multi-step starter conjecture. */
  const handleLoadSandboxStarter = useCallback(() => {
    if (!activeTheorem.isSandbox) return;
    const starter = createStarterSandboxNodes();
    applyGraphMutation({ nodes: starter, edges: [] });
    setSelectedNodeIds([]);
    setCurrentFallacy(null);
    play(playSuccess);
    toast("Loaded starter premises and goal onto sandbox canvas.", "info", {
      announce: false,
    });
    announce("Loaded starter premises and goal onto sandbox canvas.");
    appendLog(
      "sandbox-starter",
      "info",
      "✔ Loaded starter sandbox conjecture: P, P → Q, Q → R ⊢ R"
    );
  }, [
    activeTheorem,
    applyGraphMutation,
    playSuccess,
    toast,
    announce,
    appendLog,
  ]);

  /** Evaluates active Sandbox premises and goals for a falsifying truth-table valuation. */
  const handleCheckCountermodel = useCallback(() => {
    const outcome = evaluateSandboxCountermodel(activeTheorem.nodes);
    if (outcome.status === "error") {
      toast(outcome.message, "info");
      appendLog("cm-err", "error", `[COUNTERMODEL CHECK] ${outcome.message}`);
      return outcome;
    }
    if (outcome.status === "countermodel") {
      setCurrentFallacy(outcome.diagnosis);
      onFallacy();
      toast(`Countermodel found: ${outcome.diagnosis.formalFormula}`, "error", {
        announce: false,
      });
      announce(
        `Countermodel found: ${outcome.diagnosis.formalFormula}. Opened Fallacy truth table.`
      );
      appendLog(
        "cm-found",
        "error",
        `[COUNTERMODEL FOUND] ${outcome.diagnosis.formalFormula}\n${outcome.diagnosis.plainEnglish}`
      );
      return outcome;
    }

    setCurrentFallacy(null);
    play(playSuccess);
    const validMsg = `Semantically valid (${outcome.formalFormula}) across all ${outcome.valuationCount} truth-table valuations.`;
    toast(validMsg, "success", { announce: false });
    announce(validMsg);
    appendLog("cm-valid", "success", `✔ ${validMsg}`);
    return outcome;
  }, [activeTheorem.nodes, onFallacy, playSuccess, toast, announce, appendLog]);

  /**
   * Undoes the step the current diagnosis is about as an undoable mutation,
   * then clears the diagnosis. The rollback itself is recorded in history,
   * so 'undo' can reverse it.
   */
  const handleRollback = () => {
    if (!currentFallacy) return;

    const sId = currentFallacy.sourceId;
    const tId = currentFallacy.targetId;
    const withoutPair = (edgeList: Edge[], a: string, b: string) =>
      edgeList.filter((e) => !edgeJoins(e, a, b, true));

    applyGraphMutation((prev) => {
      const liveTheorem = theorem.isSandbox
        ? createSandboxTheorem(prev.nodes, prev.edges)
        : theorem;
      let updatedEdges = [...prev.edges];
      let updatedNodes = prev.nodes;

      if (tId) {
        const targetNode = liveTheorem.nodes.find(
          (n) => n.id.toUpperCase() === tId.toUpperCase()
        );
        const isPremise =
          targetNode?.type === "premise" ||
          (!liveTheorem.isSandbox &&
            ["A", "B", "D"].includes(tId.toUpperCase()));

        if (!isPremise && targetNode) {
          const pruneRes = pruneStepOrNode(tId, prev.edges, liveTheorem);
          if (pruneRes.success) {
            updatedEdges = pruneRes.newEdges;
            updatedNodes = pruneRes.newNodes ?? prev.nodes;
          } else if (sId) {
            updatedEdges = withoutPair(prev.edges, sId, tId);
          }
        } else if (sId) {
          updatedEdges = withoutPair(prev.edges, sId, tId);
        }
      } else if (updatedEdges.length > 0) {
        updatedEdges = updatedEdges.slice(0, -1);
      }

      return { nodes: updatedNodes, edges: updatedEdges };
    });

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
        appendLog(
          "list",
          "info",
          formatNodeList(activeTheorem, edges, isE_Proven)
        );
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
        applyEdgeMutation((prev) =>
          prev.filter((e) => !edgeJoins(e, source, target, true))
        );
        appendLog(
          "disc",
          "info",
          `Removed edge between Node ${source} and Node ${target}.`
        );
        announce(`Disconnected Node ${source} and Node ${target}.`);
        return;
      }
      case "undo":
        if (past.length === 0) {
          appendLog("undo", "info", "Nothing to undo: history stack is empty.");
          announce("Nothing to undo.");
          return;
        }
        handleUndo();
        return;
      case "redo":
        if (future.length === 0) {
          appendLog("redo", "info", "Nothing to redo: future stack is empty.");
          announce("Nothing to redo.");
          return;
        }
        handleRedo();
        return;
      case "rollback":
        if (!currentFallacy) {
          appendLog(
            "rollback",
            "info",
            "No active fallacy diagnosis to roll back. Use 'undo' to reverse the last proof step."
          );
          announce("No active fallacy diagnosis to roll back.");
          return;
        }
        handleRollback();
        return;
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
        const node = activeTheorem.nodes.find(
          (n) => n.id.toUpperCase() === (command.nodeId ?? "").toUpperCase()
        );
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
          formatLedger(activeTheorem.title, deductionLedger)
        );
        announce("Printed deduction ledger.");
        return;
      case "export":
        if (command.format) {
          appendLog(
            "exp",
            "info",
            exportWorkspaceProof(command.format, edges, activeTheorem)
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
    nodes,
    edges,
    activeTheorem,
    past,
    future,
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
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
    handleAddSandboxNode,
    handleUpdateSandboxNode,
    handleMoveSandboxNode,
    handleDeleteSandboxNode,
    handleClearSandbox,
    handleLoadSandboxStarter,
    handleCheckCountermodel,
    handleRollback,
    runCommand,
  };
}
