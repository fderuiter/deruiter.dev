"use client";

import React, { useState } from "react";
import {
  IconChevronDown,
  IconChevronRight,
  IconGitCommit,
  IconCheck,
  IconCircleDot,
} from "@tabler/icons-react";

export interface ProofTreeNode {
  id: string;
  label: string;
  rule?: string;
  status?: "open" | "closed" | "pending" | "proved";
  isExpanded?: boolean;
  children?: ProofTreeNode[];
  metadata?: Record<string, unknown>;
}

interface ProofTreeProps {
  rootNode: ProofTreeNode;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  expandedNodeIds?: string[];
  onToggleExpand?: (nodeId: string, expanded: boolean) => void;
  isInteractive?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const ProofTree: React.FC<ProofTreeProps> = ({
  rootNode,
  selectedNodeId,
  onSelectNode,
  expandedNodeIds: controlledExpandedIds,
  onToggleExpand,
  isInteractive = true,
  className = "",
  ariaLabel = "Quasi-Perfect Proof Tree",
}) => {
  // Local state for uncontrolled expansion tracking
  const [internalExpandedMap, setInternalExpandedMap] = useState<
    Record<string, boolean>
  >(() => {
    const map: Record<string, boolean> = {};
    const traverse = (node: ProofTreeNode) => {
      map[node.id] = node.isExpanded !== undefined ? node.isExpanded : true;
      node.children?.forEach(traverse);
    };
    traverse(rootNode);
    return map;
  });

  const isNodeExpanded = (node: ProofTreeNode): boolean => {
    if (controlledExpandedIds !== undefined) {
      return controlledExpandedIds.includes(node.id);
    }
    return internalExpandedMap[node.id] ?? node.isExpanded ?? true;
  };

  const handleToggleNode = (node: ProofTreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInteractive) return;

    const currentExpanded = isNodeExpanded(node);
    const nextExpanded = !currentExpanded;

    if (controlledExpandedIds === undefined) {
      setInternalExpandedMap((prev) => ({
        ...prev,
        [node.id]: nextExpanded,
      }));
    }

    onToggleExpand?.(node.id, nextExpanded);
  };

  const handleNodeClick = (nodeId: string) => {
    if (!isInteractive) return;
    onSelectNode?.(nodeId);
  };

  const renderNode = (node: ProofTreeNode, depth = 0): React.ReactNode => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const expanded = isNodeExpanded(node);
    const isSelected = selectedNodeId === node.id;

    const getStatusStyle = () => {
      switch (node.status) {
        case "closed":
        case "proved":
          return "border-emerald-500/60 bg-emerald-950/40 text-emerald-300";
        case "pending":
          return "border-amber-500/60 bg-amber-950/40 text-amber-300";
        case "open":
        default:
          return "border-[color:var(--qp-accent-line)] bg-[color:var(--qp-accent-soft)] qp-text-accent-strong";
      }
    };

    return (
      <li
        key={node.id}
        data-node-id={node.id}
        data-expanded={expanded ? "true" : "false"}
        data-depth={depth}
        className="flex min-w-0 flex-col gap-2 font-mono"
      >
        <div className="flex min-w-0 items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              disabled={!isInteractive}
              data-testid="expand-toggle"
              aria-label={`Toggle expand for node ${node.label}`}
              aria-expanded={expanded}
              onClick={(e) => handleToggleNode(node, e)}
              className="shrink-0 p-1 rounded hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition-colors active:scale-[0.98] focus:outline-none focus:ring-1 focus:ring-[color:var(--qp-accent)] disabled:cursor-not-allowed"
            >
              {expanded ? (
                <IconChevronDown className="w-3.5 h-3.5" />
              ) : (
                <IconChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <IconGitCommit className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
          )}

          <button
            type="button"
            disabled={!isInteractive}
            aria-label={`Select proof tree node ${node.label}${
              node.rule ? ` by ${node.rule}` : ""
            }, status ${
              node.status === "closed" || node.status === "proved"
                ? "Q.E.D."
                : node.status || "open"
            }`}
            aria-pressed={isSelected}
            data-testid="proof-tree-node"
            onClick={() => handleNodeClick(node.id)}
            className={`group flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs transition-all cursor-pointer active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[color:var(--qp-accent)] disabled:cursor-not-allowed ${getStatusStyle()} ${
              isSelected
                ? "ring-2 ring-[color:var(--qp-accent)] bg-[color:var(--qp-accent-soft)]"
                : "hover:border-zinc-500"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 break-words font-bold text-sm tracking-wide">
                {node.label}
              </span>
              {node.rule && (
                <span className="min-w-0 break-words rounded bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-300 border border-zinc-700/60">
                  by {node.rule}
                </span>
              )}
            </span>

            <span className="flex shrink-0 items-center gap-1 text-[10px]">
              {node.status === "closed" || node.status === "proved" ? (
                <span className="flex items-center gap-1 font-bold text-emerald-400">
                  <IconCheck className="w-3 h-3" /> Q.E.D.
                </span>
              ) : (
                <span className="flex items-center gap-1 qp-text-accent-strong">
                  <IconCircleDot className="w-3 h-3 animate-pulse" />{" "}
                  {node.status || "open"}
                </span>
              )}
            </span>
          </button>
        </div>

        {hasChildren && expanded && (
          <ul className="ml-5 border-l border-zinc-800 pl-4 flex flex-col gap-2 pt-1 list-none">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section
      aria-label={ariaLabel}
      className={`w-full flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4 font-mono select-none ${className}`}
    >
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
          Proof Tree Inspector
        </span>
        <span className="text-[10px] text-zinc-400">
          Root: {rootNode.label}
        </span>
      </div>

      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        {renderNode(rootNode)}
      </ul>
    </section>
  );
};

ProofTree.displayName = "ProofTree";
