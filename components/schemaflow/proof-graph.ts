import { clamp } from "@/lib/game-utils";

/**
 * The SchemaFlow proof tree: its fixed nodes, the rules that decide which
 * nodes are proven, and the pure parts of its command line.
 */

interface ProofNode {
  id: string;
  label: string;
  type: "premise" | "intermediate" | "conclusion";
  formula: string;
  description: string;
  x: number;
  y: number;
}

interface ProofEdge {
  source: string;
  target: string;
}

export const PROOF_NODES: ProofNode[] = [
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

export const INITIAL_EDGES: ProofEdge[] = [{ source: "A", target: "C" }];

const hasEdge = (edges: ProofEdge[], source: string, target: string) =>
  edges.some((e) => e.source === source && e.target === target);

/**
 * Q (node C) is proven once both A and B lead to it; the goal R (node E) once
 * Q is proven and both C and D lead to it.
 */
export function proofStatus(edges: ProofEdge[]) {
  const isC_Proven = hasEdge(edges, "A", "C") && hasEdge(edges, "B", "C");
  const isE_Proven =
    isC_Proven && hasEdge(edges, "C", "E") && hasEdge(edges, "D", "E");
  return { isC_Proven, isE_Proven };
}

/** Premises are proven by definition; C and E follow the proof status. */
export function isNodeProven(
  nodeId: string,
  status: ReturnType<typeof proofStatus>
): boolean {
  if (nodeId === "C") return status.isC_Proven;
  if (nodeId === "E") return status.isE_Proven;
  return true;
}

/** Edges touching a proven Q, or every edge once R is proven, glow brighter. */
export function edgeColor(
  edge: ProofEdge,
  status: ReturnType<typeof proofStatus>
): string {
  const touchesProvenC =
    status.isC_Proven && (edge.source === "C" || edge.target === "C");
  return touchesProvenC || status.isE_Proven ? "#06b6d4" : "#0891b2";
}

/** Why a new edge from `source` to `target` is refused, or null if it is not. */
export function connectionError(
  edges: ProofEdge[],
  source: string,
  target: string
): string | null {
  const ids = PROOF_NODES.map((n) => n.id);
  if (!ids.includes(source) || !ids.includes(target)) {
    return `Invalid node IDs: [${source}, ${target}]. Use A, B, C, D, E.`;
  }
  if (source === target) return "Self-connections are forbidden.";
  if (hasEdge(edges, source, target)) {
    return `Pathway from Node ${source} to Node ${target} is already active.`;
  }
  return null;
}

/** Where a node's specification tooltip sits: above it, or below near the top. */
export function tooltipPosition(node: ProofNode): { x: number; y: number } {
  return {
    x: clamp(node.x - 20, 10, 520),
    y: node.y > 100 ? node.y - 52 : node.y + 88,
  };
}

const COMMANDS = [
  "connect",
  "disconnect",
  "rollback",
  "simulate",
  "clear",
  "help",
];

/** The first command the typed text is a prefix of, or "" when none is. */
export function suggestCommand(input: string): string {
  const value = input.trim().toLowerCase();
  if (!value) return "";
  return COMMANDS.find((c) => c.startsWith(value)) ?? "";
}

/** Split a command line into its lower-cased verb and upper-cased node ids. */
export function parseCommand(text: string) {
  const tokens = text.trim().split(/\s+/);
  return {
    verb: tokens[0],
    op: tokens[0].toLowerCase(),
    source: tokens[1]?.toUpperCase(),
    target: tokens[2]?.toUpperCase(),
  };
}

export const HELP_TEXT =
  "Command Reference Checklist:\n" +
  "  Hover or tap nodes to inspect specifications and formulas.\n" +
  "  connect <S> <T>    - Establish pathway from Node S to Node T (e.g. connect A C)\n" +
  "  disconnect <S> <T> - Sever pathway from Node S to Node T\n" +
  "  rollback           - Roll back to previous connection structure\n" +
  "  simulate           - Toggle simulated mathematical solver loops (RAM updates)\n" +
  "  clear              - Clear terminal workspace\n" +
  "  help               - View commands";

/** The simulated solver's RAM use, in percent, on a given tick of its loop. */
export function solverRamPercent(tick: number): number {
  const noise = Math.sin(tick * 0.4) * 8 + Math.cos(tick * 0.15) * 4;
  return clamp(
    42.5 + noise + (tick % 7 === 0 ? 10 : 0) - (tick % 11 === 0 ? 8 : 0),
    30.2,
    98.4
  );
}
