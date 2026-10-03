/**
 * Chip port contracts, lane geometry and graph validation ("Run Local Test").
 */
import { LANE_GEOMETRY } from "../presets";
import type {
  CanvasEdge,
  CanvasNode,
  CanvasPosition,
  ChipKind,
  ChipLane,
  ChipSpec,
  GraphValidationResult,
  PipelineGraph,
  PortType,
} from "../types";

function p(handle: string, type: PortType) {
  return { handle, type };
}

/** The chip library with every port contract. */
export const CHIP_SPECS: Readonly<Record<ChipKind, ChipSpec>> = {
  SourceIngest: {
    kind: "SourceIngest",
    lane: "TABULATION",
    inputs: [],
    outputs: [p("raw_entry", "submission"), p("mh_entry", "mh")],
    summary:
      "Emits eCRF visit submissions and baseline MH as sites submit them.",
  },
  AmendmentRouter: {
    kind: "AmendmentRouter",
    lane: "TABULATION",
    inputs: [p("in", "submission")],
    outputs: [
      p("v1", "submission"),
      p("v2", "submission"),
      p("review", "submission"),
    ],
    summary:
      "Routes by assessment date against site activation; wrong forms go to review.",
  },
  ExtractField: {
    kind: "ExtractField",
    lane: "TABULATION",
    inputs: [p("in", "submission")],
    outputs: [
      p("sbp", "field"),
      p("dbp", "field"),
      p("pulse", "field"),
      p("sbp_stand", "field"),
      p("dbp_stand", "field"),
      p("raw_bp", "text"),
      p("visit_date", "date"),
      p("pass", "submission"),
    ],
    summary: "Splits a visit payload into one token per collected field.",
  },
  RegexSplit: {
    kind: "RegexSplit",
    lane: "TABULATION",
    inputs: [p("text_in", "text")],
    outputs: [p("sbp", "field"), p("dbp", "field"), p("unmatched", "text")],
    summary:
      "Takes the leading SBP/DBP reading; any remaining text goes to unmatched.",
  },
  DateLocaleNormalizer: {
    kind: "DateLocaleNormalizer",
    lane: "TABULATION",
    inputs: [p("date_in", "date"), p("mh_in", "mh")],
    outputs: [p("iso_date", "date"), p("mh_out", "mh"), p("error", "date")],
    summary:
      "Resolves DD/MM vs MM/DD from the site profile; keeps partial dates partial.",
  },
  UnitStandardizer: {
    kind: "UnitStandardizer",
    lane: "TABULATION",
    inputs: [p("val_in", "field")],
    outputs: [p("std_val", "field"), p("orig_unit", "unit")],
    summary: "kPa x 7.50062 = mmHg; keeps the original value and unit.",
  },
  PivotToObservation: {
    kind: "PivotToObservation",
    lane: "TABULATION",
    inputs: [
      p("sbp", "field"),
      p("dbp", "field"),
      p("pulse", "field"),
      p("sbp_stand", "field"),
      p("dbp_stand", "field"),
      p("date", "date"),
    ],
    outputs: [p("obs_stream", "observation")],
    summary: "Unpivots a wide visit into tall rows keyed by test and position.",
  },
  CDISCSink: {
    kind: "CDISCSink",
    lane: "TABULATION",
    inputs: [p("obs_in", "observation"), p("mh_in", "mh")],
    outputs: [p("snapshot_out", "snapshot")],
    summary:
      "Validates and appends SDTM VS and MH rows; rejects key collisions.",
  },
  SnapshotHandoff: {
    kind: "SnapshotHandoff",
    lane: "WALL",
    inputs: [p("snapshot_in", "snapshot")],
    outputs: [p("clean_records", "records")],
    summary: "Deep-frozen read-only snapshot of current SDTM rows.",
  },
  PairAndDerive: {
    kind: "PairAndDerive",
    lane: "ANALYSIS",
    inputs: [p("records_in", "records")],
    outputs: [p("adam_rows", "adam"), p("unpaired", "adam")],
    summary:
      "Pairs sitting and standing within one visit; otherwise NOT EVALUABLE.",
  },
};

/** Vertical bounds for a chip's top-left corner in its lane. */
export function laneBounds(lane: ChipLane): { min: number; max: number } {
  const { tabulationTop, conservationWallY, analysisBottom, chipHeight } =
    LANE_GEOMETRY;
  if (lane === "TABULATION") {
    return { min: tabulationTop, max: conservationWallY - chipHeight };
  }
  if (lane === "ANALYSIS") {
    return { min: conservationWallY, max: analysisBottom - chipHeight };
  }
  return { min: conservationWallY - chipHeight, max: conservationWallY };
}

/** Clamps a chip position into its lane; Tabulation chips never cross y=416. */
export function clampNodePosition(
  kind: ChipKind,
  position: CanvasPosition
): CanvasPosition {
  const { min, max } = laneBounds(CHIP_SPECS[kind].lane);
  let y = position.y;
  if (y < min) y = min;
  if (y > max) y = max;
  return { x: position.x < 0 ? 0 : position.x, y };
}

/** True when a wire between these two ports is type-safe. */
export function isWireCompatible(
  sourceKind: ChipKind,
  sourceHandle: string,
  targetKind: ChipKind,
  targetHandle: string
): boolean {
  const out = CHIP_SPECS[sourceKind].outputs.find(
    (port) => port.handle === sourceHandle
  );
  const inp = CHIP_SPECS[targetKind].inputs.find(
    (port) => port.handle === targetHandle
  );
  if (!out || !inp || out.type !== inp.type) return false;
  const laneRank = (kind: ChipKind) => {
    const lane = CHIP_SPECS[kind].lane;
    return lane === "TABULATION" ? 0 : lane === "WALL" ? 1 : 2;
  };
  // Data only flows downward across the Conservation Wall.
  return laneRank(sourceKind) <= laneRank(targetKind);
}

/** A validated graph indexed for execution. */
export interface CompiledGraph {
  nodes: Map<string, CanvasNode>;
  order: string[];
  outgoing: Map<string, CanvasEdge[]>;
  incoming: Map<string, CanvasEdge[]>;
}

function key(nodeId: string, handle: string): string {
  return `${nodeId}::${handle}`;
}

/** Indexes a graph and returns a topological order (or null on a cycle). */
export function compileGraph(graph: PipelineGraph): CompiledGraph | null {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, CanvasEdge[]>();
  const incoming = new Map<string, CanvasEdge[]>();
  const indegree = new Map<string, number>();
  for (const n of graph.nodes) indegree.set(n.id, 0);
  for (const e of graph.edges) {
    if (!nodes.has(e.source) || !nodes.has(e.target)) continue;
    const ok = key(e.source, e.sourceHandle ?? "");
    outgoing.set(ok, [...(outgoing.get(ok) ?? []), e]);
    incoming.set(e.target, [...(incoming.get(e.target) ?? []), e]);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }
  const ready = graph.nodes
    .filter((n) => indegree.get(n.id) === 0)
    .map((n) => n.id);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as string;
    order.push(id);
    for (const e of graph.edges) {
      if (e.source !== id || !nodes.has(e.target)) continue;
      const d = (indegree.get(e.target) ?? 0) - 1;
      indegree.set(e.target, d);
      if (d === 0) ready.push(e.target);
    }
  }
  if (order.length !== graph.nodes.length) return null;
  return { nodes, order, outgoing, incoming };
}

/** Edges leaving one output handle. */
export function edgesFrom(
  graph: CompiledGraph,
  nodeId: string,
  handle: string
): CanvasEdge[] {
  return graph.outgoing.get(key(nodeId, handle)) ?? [];
}

function reachesKind(
  graph: CompiledGraph,
  start: string,
  kind: ChipKind,
  seen = new Set<string>()
): boolean {
  if (seen.has(start)) return false;
  seen.add(start);
  const n = graph.nodes.get(start);
  if (!n) return false;
  if (n.type === kind) return true;
  for (const spec of CHIP_SPECS[n.type].outputs) {
    for (const e of edgesFrom(graph, start, spec.handle)) {
      if (reachesKind(graph, e.target, kind, seen)) return true;
    }
  }
  return false;
}

function countKind(graph: PipelineGraph, kind: ChipKind): CanvasNode[] {
  return graph.nodes.filter((n) => n.type === kind);
}

/** Options that change which rules apply. */
export interface ValidationOptions {
  /** Amendment 01 announced: routing and standing branches become required. */
  amendmentAnnounced: boolean;
}

/**
 * Validates topology: one source and sink, an extractor and a pivot, type-safe
 * wires, every extracted observation handle mapped to a pivot, no cycles, and
 * chips inside their lanes (clamped, with a warning).
 */
export function validateGraph(
  graph: PipelineGraph,
  options: ValidationOptions = { amendmentAnnounced: false }
): GraphValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  const clampedNodes: CanvasNode[] = [];

  for (const n of graph.nodes) {
    if (!(n.type in CHIP_SPECS)) {
      errors.push(`Unknown chip type: ${String(n.type)}`);
      continue;
    }
    if (ids.has(n.id)) errors.push(`Duplicate node id: ${n.id}`);
    ids.add(n.id);
    const position = clampNodePosition(n.type, n.position);
    if (position.y !== n.position.y || position.x !== n.position.x) {
      warnings.push(`Clamped ${n.id} into the ${CHIP_SPECS[n.type].lane} lane`);
    }
    clampedNodes.push({ ...n, position });
  }

  for (const [kind, label] of [
    ["SourceIngest", "SourceIngest"],
    ["ExtractField", "ExtractField"],
    ["PivotToObservation", "PivotToObservation"],
    ["CDISCSink", "CDISCSink"],
  ] as const) {
    const found = countKind(graph, kind).length;
    if (found === 0) errors.push(`Missing ${label}`);
    if (found > 1 && (kind === "SourceIngest" || kind === "CDISCSink")) {
      errors.push(`Multiple ${label} nodes`);
    }
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const e of graph.edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) {
      errors.push(`Edge ${e.id} references a missing node`);
      continue;
    }
    if (!e.sourceHandle || !e.targetHandle) {
      errors.push(`Edge ${e.id} is missing a handle`);
      continue;
    }
    if (!(s.type in CHIP_SPECS) || !(t.type in CHIP_SPECS)) continue;
    if (!isWireCompatible(s.type, e.sourceHandle, t.type, e.targetHandle)) {
      errors.push(
        `Invalid wire: ${e.source}.${e.sourceHandle} -> ${e.target}.${e.targetHandle}`
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, clampedNodes };
  }

  const compiled = compileGraph(graph);
  if (!compiled) {
    return {
      valid: false,
      errors: ["Cycle detected: Level 1 pipelines must be acyclic"],
      warnings,
      clampedNodes,
    };
  }

  const routers = countKind(graph, "AmendmentRouter");
  for (const ex of countKind(graph, "ExtractField")) {
    const required = ["sbp", "dbp", "pulse"];
    if (options.amendmentAnnounced) required.push("sbp_stand", "dbp_stand");
    for (const handle of required) {
      const out = edgesFrom(compiled, ex.id, handle);
      const mapped = out.some((e) =>
        reachesKind(compiled, e.target, "PivotToObservation")
      );
      if (!mapped) errors.push(`Unmapped observation handle: ${handle}`);
    }
    if (edgesFrom(compiled, ex.id, "raw_bp").length === 0) {
      warnings.push(
        `${ex.id}.raw_bp is not wired: free-text blood pressure will be held`
      );
    }
  }

  for (const pivot of countKind(graph, "PivotToObservation")) {
    if (!reachesKind(compiled, pivot.id, "CDISCSink")) {
      errors.push(`${pivot.id}.obs_stream does not reach CDISCSink`);
    }
  }

  const source = countKind(graph, "SourceIngest")[0];
  if (edgesFrom(compiled, source.id, "raw_entry").length === 0) {
    errors.push("SourceIngest.raw_entry is not wired");
  }
  if (edgesFrom(compiled, source.id, "mh_entry").length === 0) {
    warnings.push("SourceIngest.mh_entry is not wired: MH will be held");
  }

  if (options.amendmentAnnounced) {
    const fed = routers.some((r) =>
      edgesFrom(compiled, source.id, "raw_entry").some((e) => e.target === r.id)
    );
    if (!fed) {
      errors.push(
        "Amendment 01 active: AmendmentRouter required downstream of SourceIngest"
      );
    }
    for (const r of routers) {
      for (const handle of ["v1", "v2"]) {
        if (edgesFrom(compiled, r.id, handle).length === 0) {
          errors.push(`AmendmentRouter ${r.id}.${handle} is not wired`);
        }
      }
    }
  }

  for (const d of countKind(graph, "DateLocaleNormalizer")) {
    if (d.data?.partialDates === "impute-day") {
      warnings.push(
        `${d.id} imputes missing days: partial dates will carry fabricated precision (FAB)`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings, clampedNodes };
}

/** True when the graph wires CDISCSink to SnapshotHandoff to PairAndDerive. */
export function analysisLaneWired(graph: CompiledGraph): {
  wired: boolean;
  pairNode: CanvasNode | null;
} {
  for (const sink of graph.nodes.values()) {
    if (sink.type !== "CDISCSink") continue;
    for (const e of edgesFrom(graph, sink.id, "snapshot_out")) {
      const handoff = graph.nodes.get(e.target);
      if (handoff?.type !== "SnapshotHandoff") continue;
      for (const e2 of edgesFrom(graph, handoff.id, "clean_records")) {
        const pair = graph.nodes.get(e2.target);
        if (pair?.type === "PairAndDerive") {
          return { wired: true, pairNode: pair };
        }
      }
    }
  }
  return { wired: false, pairNode: null };
}
