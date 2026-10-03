/**
 * Conversions between the React Flow canvas model and the engine's graph
 * contract, plus the visual size of a chip.
 */
import type { Edge, Node } from "@xyflow/react";
import {
  CHIP_SPECS,
  LANE_GEOMETRY,
  clampNodePosition,
  type CanvasEdge,
  type CanvasNode,
  type ChipConfig,
  type ChipKind,
  type PipelineGraph,
} from "@/lib/protocol-drift";

/** Payload carried by every canvas node. */
type ChipNodeData = {
  kind: ChipKind;
  config?: ChipConfig;
};

/** A chip on the React Flow canvas. */
export type ChipNode = Node<ChipNodeData, "chip">;

/** A wire on the React Flow canvas. */
export type WireEdge = Edge<Record<string, unknown>, "packet">;

const PIN_ROW_PX = 18;
const CHIP_HEADER_PX = 26;
const CHIP_PADDING_PX = 8;

/** Chip width in canvas pixels. */
export const CHIP_WIDTH = LANE_GEOMETRY.chipWidth;

/** Visual height of a chip: tall enough for one row per pin. */
export function chipHeight(kind: ChipKind): number {
  const spec = CHIP_SPECS[kind];
  const rows = Math.max(spec.inputs.length, spec.outputs.length);
  return Math.max(
    LANE_GEOMETRY.chipHeight,
    CHIP_HEADER_PX + rows * PIN_ROW_PX + CHIP_PADDING_PX
  );
}

/** Row geometry shared by the chip renderer. */
export const PIN_LAYOUT = {
  rowPx: PIN_ROW_PX,
  headerPx: CHIP_HEADER_PX,
} as const;

/**
 * Clamps a chip so its whole body stays in its own lane: a Tabulation chip's
 * bottom edge never crosses the Conservation Wall.
 */
export function clampChip(
  kind: ChipKind,
  position: { x: number; y: number }
): { x: number; y: number } {
  const base = clampNodePosition(kind, position);
  const lane = CHIP_SPECS[kind].lane;
  if (lane !== "TABULATION") return base;
  const maxY = LANE_GEOMETRY.conservationWallY - chipHeight(kind);
  return { x: base.x, y: Math.min(base.y, maxY) };
}

/** Engine nodes to canvas nodes. */
export function toFlowNodes(nodes: CanvasNode[]): ChipNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "chip",
    position: { x: n.position.x, y: n.position.y },
    data: n.data ? { kind: n.type, config: n.data } : { kind: n.type },
  }));
}

/** Engine edges to canvas edges. */
export function toFlowEdges(edges: CanvasEdge[]): WireEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    type: "packet",
  }));
}

/** Canvas to engine graph. */
export function toPipelineGraph(
  nodes: ChipNode[],
  edges: WireEdge[]
): PipelineGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.kind,
      position: { x: n.position.x, y: n.position.y },
      ...(n.data.config ? { data: n.data.config } : {}),
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
    })),
  };
}

/** A fresh node id for a chip kind that is unique on the canvas. */
export function nextNodeId(kind: ChipKind, nodes: ChipNode[]): string {
  const base = kind
    .replace(/[A-Z]/g, (c, i) => (i ? `-${c}` : c))
    .toLowerCase();
  let n = 1;
  while (nodes.some((node) => node.id === `${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
