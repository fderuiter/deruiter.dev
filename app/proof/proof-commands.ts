import type {
  Edge,
  LedgerStep,
  TheoremDefinition,
  TheoremId,
} from "@/lib/proof";
import { THEOREMS } from "@/lib/proof";

/** Export formats the terminal prints inline; anything else opens the export dialog. */
type InlineExportFormat = "lean" | "latex" | "markdown" | "mermaid";

/** One parsed line of the Proof Studio terminal. */
type ProofCommand =
  | { op: "help" }
  | { op: "clear" }
  | { op: "list" }
  | { op: "ledger" }
  | { op: "autostep" }
  | { op: "connect"; source: string; target: string }
  | { op: "disconnect"; source: string; target: string }
  | { op: "prune"; target: string }
  | { op: "apply"; rule: string; nodeIds: string[] }
  | { op: "inspect"; nodeId: string | undefined }
  | {
      op: "theorem";
      theoremId: TheoremId | null;
      requested: string | undefined;
    }
  | { op: "export"; format: InlineExportFormat | null }
  | { op: "simulate"; mode: "normal" | "loop" }
  | { op: "usage"; message: string }
  | { op: "unknown"; name: string };

const THEOREM_ALIASES: Readonly<Record<string, TheoremId>> = {
  mp: "modus-ponens",
  mt: "modus-tollens",
  hs: "hypothetical-syllogism",
  ds: "disjunctive-syllogism",
  res: "resolution",
  "2pc": "two-phase-commit",
  quorum: "quorum-overlap",
  cache: "cache-consistency",
  synod: "paxos-synod",
  paxos: "paxos-synod",
  "paxos-synod": "paxos-synod",
  "paxos-phase2b": "paxos-phase2b",
  paxos2b: "paxos-phase2b",
  phase2b: "paxos-phase2b",
  "2b": "paxos-phase2b",
  bft: "bft-quorum",
  "bft-quorum": "bft-quorum",
  pbft: "bft-quorum",
  "pbft-quorum": "bft-quorum",
  custom: "custom",
};

const INLINE_EXPORT_FORMATS: readonly string[] = [
  "lean",
  "latex",
  "markdown",
  "mermaid",
];

/** Resolves a short alias (mp, 2pc, bft) or a full theorem id; null when it names no theorem. */
export function resolveTheoremAlias(raw: string | undefined): TheoremId | null {
  if (!raw) return null;
  const id = Object.hasOwn(THEOREM_ALIASES, raw) ? THEOREM_ALIASES[raw] : raw;
  return Object.hasOwn(THEOREMS, id) ? (id as TheoremId) : null;
}

/** Parses one terminal line, or returns null for a blank line. */
export function parseProofCommand(rawInput: string): ProofCommand | null {
  const input = rawInput.trim();
  if (!input) return null;

  const tokens = input.split(/\s+/);
  const op = tokens[0].toLowerCase();

  switch (op) {
    case "help":
    case "clear":
    case "list":
    case "ledger":
      return { op };
    case "autostep":
    case "solve":
      return { op: "autostep" };
    case "connect":
    case "disconnect": {
      const source = tokens[1]?.toUpperCase();
      const target = tokens[2]?.toUpperCase();
      if (!source || !target) {
        return {
          op: "usage",
          message: `Usage: ${op} <sourceNode> <targetNode>`,
        };
      }
      return { op, source, target };
    }
    case "prune":
    case "delete-step": {
      const target = tokens[1];
      if (!target) {
        return {
          op: "usage",
          message:
            "Usage: prune <stepNumber|nodeId> or delete-step <stepNumber>",
        };
      }
      return { op: "prune", target };
    }
    case "apply": {
      const rule = tokens[1]?.toLowerCase();
      const nodeIds = tokens.slice(2).map((n) => n.toUpperCase());
      if (!rule || nodeIds.length === 0) {
        return {
          op: "usage",
          message: "Usage: apply <rule> <node1> [node2...]",
        };
      }
      return { op: "apply", rule, nodeIds };
    }
    case "inspect":
      return { op: "inspect", nodeId: tokens[1]?.toUpperCase() };
    case "theorem":
    case "switch": {
      const requested = tokens[1]?.toLowerCase();
      return {
        op: "theorem",
        theoremId: resolveTheoremAlias(requested),
        requested,
      };
    }
    case "export": {
      const format = tokens[1]?.toLowerCase();
      return {
        op: "export",
        format:
          format && INLINE_EXPORT_FORMATS.includes(format)
            ? (format as InlineExportFormat)
            : null,
      };
    }
    case "simulate":
      return {
        op: "simulate",
        mode: tokens[1]?.toLowerCase() === "loop" ? "loop" : "normal",
      };
    default:
      return { op: "unknown", name: op };
  }
}

export const PROOF_HELP_TEXT = `Interactive Proof Workspace CLI v3.0 Commands:
  connect <src> <tgt>    Connect two nodes with deductive edge
  disconnect <src> <tgt> Remove an edge between nodes
  prune <step|node>      Prune a derived step (Step 3/5 or C/E) and dependent edges
  delete-step <n>        Delete a derived deduction step by line number
  apply <rule> <nodes..> Apply an inference rule (mp, mt, hs, ds, res, and_intro)
  autostep               Automatically advance the next valid inference step
  list                   List all nodes and active edges in graph
  inspect <nodeId>       Inspect details of a specific node
  theorem <id>           Switch theorem scenario (mp, mt, hs, ds, res, 2pc, quorum, cache)
  ledger                 Print deduction ledger table
  export <format>        Export proof (lean, latex, markdown, mermaid)
  simulate normal|loop   Run verification engine in background Web Worker
  clear                  Clear terminal buffer
  help                   Print this command reference`;

/** The `list` command's report of the theorem's nodes, edges and proof status. */
export function formatNodeList(
  theorem: TheoremDefinition,
  edges: readonly Edge[],
  isProven: boolean
): string {
  const nodeList = theorem.nodes
    .map((n) => `  [Node ${n.id}] ${n.label} (${n.type}) - ${n.description}`)
    .join("\n");
  const edgeList =
    edges.length > 0
      ? edges
          .map(
            (e) =>
              `  ${e.source} -> ${e.target}${e.ruleApplied ? ` [${e.ruleApplied}]` : ""}`
          )
          .join("\n")
      : "  (None)";
  return `Active Theorem: ${theorem.title} (${theorem.category})\nNodes:\n${nodeList}\nEdges:\n${edgeList}\nStatus: ${isProven ? "✔ Q.E.D." : "⏳ INCOMPLETE"}`;
}

/** The `ledger` command's table of deduction steps. */
export function formatLedger(
  title: string,
  ledger: readonly LedgerStep[]
): string {
  const rows = ledger
    .map(
      (s) =>
        `[Step ${s.stepNumber}] ${s.formula.padEnd(14)} | ${s.rule.padEnd(16)} | ${s.isProven ? "✔ PROVEN" : "⏳ PENDING"} | ${s.plainEnglish}`
    )
    .join("\n");
  return `--- Deduction Ledger: ${title} ---\n${rows}`;
}
