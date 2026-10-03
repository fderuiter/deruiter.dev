"use client";

import React from "react";
import { motion } from "framer-motion";
import { renderASTString } from "@/lib/quasi-perfect/engine";
import type { ProofLayoutNode } from "./boardArt";
import { isMathVariable, nodeGlyph } from "./boardArt";

interface ASTNodeViewProps {
  /** The node and where the board layout put it. */
  item: ProofLayoutNode;
  /** Where a newly split node grows from: its parent's centre. */
  origin: { x: number; y: number };
  selectedTargetId: string | null;
  hoveredTargetId: string | null;
  onSelectTarget: (nodeId: string) => void;
  onHoverTarget: (nodeId: string | null) => void;
  isInteractive?: boolean;
  isTacticActive?: boolean;
  /** The goal is closed: the tree settles back and dims. */
  isSettled?: boolean;
  /** Skip motion (reduced motion or a narrow viewport). */
  calm?: boolean;
}

function nodeFamily(item: ProofLayoutNode): string {
  switch (item.node.type) {
    case "Equality":
    case "Inequality":
    case "Implication":
    case "Conjunction":
    case "Disjunction":
    case "Negation":
      return "logic";
    case "Operator":
    case "Function":
      return "arith";
    case "Boolean":
      return item.node.value === true || item.node.value === "true"
        ? "true"
        : "false";
    default:
      return "term";
  }
}

/**
 * One AST node on the proof board, drawn as a math token at the position
 * the board layout gave it. A node that appears after a split grows out of
 * its parent; when the goal closes the whole tree settles and dims. The
 * motion is transform and opacity only and is skipped when `calm` is set.
 */
export const ASTNodeView: React.FC<ASTNodeViewProps> = React.memo(
  function ASTNodeView({
    item,
    origin,
    selectedTargetId,
    hoveredTargetId,
    onSelectTarget,
    onHoverTarget,
    isInteractive = true,
    isTacticActive = false,
    isSettled = false,
    calm = false,
  }) {
    const { node } = item;
    const isSelected = selectedTargetId === node.id;
    const isHovered = hoveredTargetId === node.id;
    const isTargetEligible = isTacticActive && isInteractive;
    const glyph = nodeGlyph(node);
    const glyphClass = isMathVariable(node)
      ? "qp-math-var"
      : node.type === "Constant"
        ? "qp-math tabular-nums"
        : "qp-math";

    return (
      <motion.button
        type="button"
        data-node-id={node.id}
        data-target-eligible={isTargetEligible ? "true" : undefined}
        data-family={nodeFamily(item)}
        data-goal={item.isRoot ? "true" : undefined}
        data-eligible={isTargetEligible && !isSelected ? "true" : undefined}
        data-active={isSelected || isHovered ? "true" : undefined}
        data-closed={isSettled ? "true" : undefined}
        title={node.type}
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
        className={`qp-node qp-focus absolute left-0 top-0 inline-flex items-center justify-center rounded-xl select-none ${
          isInteractive ? "cursor-pointer" : "cursor-default"
        } ${isTargetEligible ? "cursor-crosshair" : ""}`}
        style={{
          width: item.width,
          height: item.height,
          marginLeft: -item.width / 2,
          marginTop: -item.height / 2,
        }}
        initial={
          calm ? false : { x: origin.x, y: origin.y, opacity: 0, scale: 0.6 }
        }
        animate={{
          x: item.x,
          y: item.y,
          opacity: isSettled ? 0.55 : 1,
          scale: isSettled ? 0.94 : 1,
        }}
        transition={
          calm
            ? { duration: 0 }
            : { type: "spring", stiffness: 420, damping: 32, mass: 0.7 }
        }
        whileHover={calm || !isInteractive ? undefined : { scale: 1.06 }}
        whileTap={calm || !isInteractive ? undefined : { scale: 0.96 }}
      >
        <span
          className={`${glyphClass} leading-none ${
            item.isRoot ? "text-[28px] font-semibold" : "text-[22px]"
          }`}
        >
          {glyph}
        </span>
        {item.isRoot && (
          <span className="qp-chip-accent absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border px-1.5 text-[9px] font-bold font-mono tracking-wider">
            GOAL
          </span>
        )}
      </motion.button>
    );
  }
);

ASTNodeView.displayName = "ASTNodeView";
