import React, { useState } from "react";
import {
  connectionError,
  INITIAL_EDGES,
  PROOF_NODES,
  proofStatus,
} from "./proof-graph";
import type { AddLog } from "./useConsoleLog";

type ProofEdge = (typeof INITIAL_EDGES)[number];

/**
 * The proof tree's edges with an undo stack, plus which node is selected and
 * which is hovered. Clicking one node and then another connects them.
 */
export function useProofGraph(addLog: AddLog) {
  const nodes = PROOF_NODES;
  const [edges, setEdges] = useState<ProofEdge[]>(INITIAL_EDGES);
  const [history, setHistory] = useState<ProofEdge[][]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const hoveredNode = hoveredNodeId
    ? nodes.find((n) => n.id === hoveredNodeId)
    : undefined;
  const inspectorNode =
    hoveredNode ??
    (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined);

  const status = React.useMemo(() => proofStatus(edges), [edges]);
  const { isC_Proven, isE_Proven } = status;

  const commitEdges = (next: ProofEdge[]) => {
    setHistory((prev) => [...prev, edges]);
    setEdges(next);
  };

  const connectNodes = (source: string, target: string) => {
    const error = connectionError(edges, source, target);
    if (error) {
      addLog("error", error);
      return;
    }
    commitEdges([...edges, { source, target }]);
    addLog(
      "success",
      `Established directed path: Node ${source} → Node ${target}`
    );
  };

  const disconnectNodes = (source: string, target: string) => {
    const index = edges.findIndex(
      (e) => e.source === source && e.target === target
    );
    if (index === -1) {
      addLog(
        "error",
        `No active pathway from Node ${source} to Node ${target} exists.`
      );
      return;
    }
    commitEdges(edges.filter((_, i) => i !== index));
    addLog("success", `Severed path: Node ${source} ↛ Node ${target}`);
  };

  const executeRollback = () => {
    if (history.length === 0) {
      addLog("error", "Rollback failed: No historical step state recorded.");
      return;
    }
    setEdges(history[history.length - 1]);
    setHistory((prev) => prev.slice(0, -1));
    addLog(
      "success",
      "Successfully rolled back proof connection configuration to previous state."
    );
  };

  const resetCanvas = () => {
    commitEdges([]);
    addLog("info", "All pathways cleared.");
  };

  const handleNodeClick = (nodeId: string) => {
    if (selectedNodeId === null) {
      setSelectedNodeId(nodeId);
      addLog(
        "info",
        `Selected Node ${nodeId}. Click another node to establish a directed pathway.`
      );
    } else if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      addLog("info", `Deselected Node ${nodeId}.`);
    } else {
      connectNodes(selectedNodeId, nodeId);
      setSelectedNodeId(null);
    }
  };

  return {
    nodes,
    edges,
    history,
    status,
    isC_Proven,
    isE_Proven,
    selectedNodeId,
    hoveredNodeId,
    hoveredNode,
    inspectorNode,
    setHoveredNodeId,
    connectNodes,
    disconnectNodes,
    executeRollback,
    resetCanvas,
    handleNodeClick,
  };
}
