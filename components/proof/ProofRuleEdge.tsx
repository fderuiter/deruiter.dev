"use client";

import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";

type ProofFlowEdgeData = {
  ruleLabel?: string;
  isProven?: boolean;
};

export type ProofFlowEdge = Edge<ProofFlowEdgeData, "proofRule">;

export function ProofRuleEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<ProofFlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const isProven = Boolean(data?.isProven);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: isProven ? "#10b981" : "#06b6d4",
          strokeWidth: 2.5,
          strokeDasharray: isProven ? undefined : "5 3",
        }}
      />
      {data?.ruleLabel ? (
        <EdgeLabelRenderer>
          <span
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className={`pointer-events-none absolute px-1.5 py-0.5 rounded-full font-mono text-[9px] font-bold border shadow-sm whitespace-nowrap ${
              isProven
                ? "bg-emerald-950/95 border-emerald-500/60 text-emerald-300"
                : "bg-slate-950/95 border-cyan-500/60 text-cyan-300"
            }`}
          >
            {data.ruleLabel}
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
