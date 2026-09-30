"use client";

import React from "react";
import { motion } from "framer-motion";
import { ASTNode } from "@/lib/quasi-perfect/types";
import { renderASTString } from "@/lib/quasi-perfect/engine";

interface ASTNodeViewProps {
  node: ASTNode;
  isRoot?: boolean;
  selectedTargetId: string | null;
  hoveredTargetId: string | null;
  onSelectTarget: (nodeId: string) => void;
  onHoverTarget: (nodeId: string | null) => void;
  isInteractive?: boolean;
  isTacticActive?: boolean;
}

export const ASTNodeView: React.FC<ASTNodeViewProps> = React.memo(
  ({
    node,
    isRoot = false,
    selectedTargetId,
    hoveredTargetId,
    onSelectTarget,
    onHoverTarget,
    isInteractive = true,
    isTacticActive = false,
  }) => {
    const isSelected = selectedTargetId === node.id;
    const isHovered = hoveredTargetId === node.id;
    const isTargetEligible = isTacticActive && isInteractive;

    const getNodeStyling = () => {
      switch (node.type) {
        case "Boolean":
          return node.value === true
            ? "border-emerald-500/60 bg-emerald-950/70 text-emerald-300 shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]"
            : "border-rose-500/60 bg-rose-950/70 text-rose-300 shadow-[0_0_15px_-3px_rgba(244,63,94,0.5)]";

        case "Equality":
        case "Inequality":
          return "border-cyan-500/40 bg-cyan-950/40 text-cyan-200 shadow-[0_0_15px_-5px_rgba(6,182,212,0.3)]";

        case "Implication":
        case "Conjunction":
        case "Disjunction":
        case "Negation":
          return "border-purple-500/50 bg-purple-950/40 text-purple-200 shadow-[0_0_15px_-5px_rgba(168,85,247,0.3)]";

        case "Operator":
          return "border-amber-500/40 bg-amber-950/40 text-amber-200";

        case "Variable":
          return "border-purple-400/40 bg-purple-950/30 text-purple-100 font-bold";

        case "Constant":
          return "border-blue-500/40 bg-blue-950/40 text-blue-200 font-mono";

        case "Function":
          return "border-emerald-500/40 bg-emerald-950/40 text-emerald-200 font-bold";

        default:
          return "border-zinc-700 bg-zinc-900 text-zinc-200";
      }
    };

    const getTypePill = () => {
      switch (node.type) {
        case "Equality":
          return "eq";
        case "Inequality":
          return "ineq";
        case "Implication":
          return "imp";
        case "Conjunction":
          return "and";
        case "Disjunction":
          return "or";
        case "Negation":
          return "not";
        case "Operator":
          return "op";
        case "Variable":
          return "var";
        case "Constant":
          return "const";
        case "Function":
          return "fn";
        default:
          return node.type.toLowerCase();
      }
    };

    const hasChildren = node.children && node.children.length > 0;

    return (
      <div
        className="flex flex-col items-center select-none"
        data-node-container-id={node.id}
      >
        <motion.button
          type="button"
          data-node-id={node.id}
          data-target-eligible={isTargetEligible ? "true" : undefined}
          layoutId={`ast-node-${node.id}`}
          onClick={(e) => {
            e.stopPropagation();
            if (isInteractive) onSelectTarget(node.id);
          }}
          onMouseEnter={() => {
            if (isInteractive) onHoverTarget(node.id);
          }}
          onMouseLeave={() => {
            if (isInteractive) onHoverTarget(null);
          }}
          aria-label={`${node.type} node with value ${node.value}. Expression: ${renderASTString(node)}`}
          className={`relative group inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-mono transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-cyan/70 ${getNodeStyling()} ${
            isSelected
              ? "ring-2 ring-brand-cyan scale-105 shadow-[0_0_20px_rgba(6,182,212,0.6)]"
              : isHovered
                ? "ring-1 ring-brand-cyan/70 scale-102"
                : isTargetEligible
                  ? "ring-2 ring-brand-cyan/80 border-brand-cyan bg-cyan-950/50 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.5)] animate-pulse cursor-pointer"
                  : "hover:border-zinc-500"
          }`}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          {/* Node Type Pill Indicator */}
          <span className="text-[9px] uppercase tracking-wider font-sans font-semibold">
            {getTypePill()}
          </span>

          {/* Node Value */}
          <span className="font-bold tracking-tight text-base px-0.5">
            {String(node.value)}
          </span>

          {/* Root Goal Target Indicator */}
          {isRoot && (
            <span className="absolute -top-2.5 -right-2 px-1.5 py-0.2 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-[9px] font-bold text-cyan-300 tracking-wider">
              GOAL
            </span>
          )}
        </motion.button>

        {/* Children Subtrees */}
        {hasChildren && (
          <div className="relative mt-4 flex items-start justify-center gap-6 pt-3 before:absolute before:top-0 before:left-1/2 before:h-3 before:w-px before:-translate-x-1/2 before:bg-zinc-700/60">
            {node.children!.map((child) => (
              <div
                key={child.id}
                className="relative flex flex-col items-center"
              >
                <ASTNodeView
                  node={child}
                  selectedTargetId={selectedTargetId}
                  hoveredTargetId={hoveredTargetId}
                  onSelectTarget={onSelectTarget}
                  onHoverTarget={onHoverTarget}
                  isInteractive={isInteractive}
                  isTacticActive={isTacticActive}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

ASTNodeView.displayName = "ASTNodeView";
