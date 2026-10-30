// @vitest-environment node
import { describe, expect, it } from "vitest";
import { THEOREMS, getDeductionLedger } from "@/lib/proof";
import {
  PROOF_HELP_TEXT,
  formatLedger,
  formatNodeList,
  parseProofCommand,
  resolveTheoremAlias,
} from "@/app/proof/proof-commands";

const MP = THEOREMS["modus-ponens"];

describe("parseProofCommand", () => {
  it("returns null for a blank line", () => {
    expect(parseProofCommand("")).toBeNull();
    expect(parseProofCommand("   \t ")).toBeNull();
  });

  it.each(["help", "clear", "list", "ledger"] as const)(
    "parses the bare %s command, ignoring case and padding",
    (op) => {
      expect(parseProofCommand(`  ${op.toUpperCase()}  `)).toEqual({ op });
    }
  );

  it("treats solve as an alias of autostep", () => {
    expect(parseProofCommand("autostep")).toEqual({ op: "autostep" });
    expect(parseProofCommand("solve")).toEqual({ op: "autostep" });
  });

  it("upper-cases connect and disconnect node ids", () => {
    expect(parseProofCommand("connect c  e")).toEqual({
      op: "connect",
      source: "C",
      target: "E",
    });
    expect(parseProofCommand("disconnect a c")).toEqual({
      op: "disconnect",
      source: "A",
      target: "C",
    });
  });

  it("reports usage when connect or disconnect lacks a node", () => {
    expect(parseProofCommand("connect C")).toEqual({
      op: "usage",
      message: "Usage: connect <sourceNode> <targetNode>",
    });
    expect(parseProofCommand("disconnect")).toEqual({
      op: "usage",
      message: "Usage: disconnect <sourceNode> <targetNode>",
    });
  });

  it("maps prune and delete-step to one prune command and keeps the argument as typed", () => {
    expect(parseProofCommand("prune c")).toEqual({ op: "prune", target: "c" });
    expect(parseProofCommand("delete-step 3")).toEqual({
      op: "prune",
      target: "3",
    });
    expect(parseProofCommand("prune")).toMatchObject({ op: "usage" });
  });

  it("parses apply with a lower-cased rule and upper-cased nodes", () => {
    expect(parseProofCommand("apply MP a b")).toEqual({
      op: "apply",
      rule: "mp",
      nodeIds: ["A", "B"],
    });
    expect(parseProofCommand("apply mp")).toEqual({
      op: "usage",
      message: "Usage: apply <rule> <node1> [node2...]",
    });
  });

  it("parses inspect with or without a node id", () => {
    expect(parseProofCommand("inspect c")).toEqual({
      op: "inspect",
      nodeId: "C",
    });
    expect(parseProofCommand("inspect")).toEqual({
      op: "inspect",
      nodeId: undefined,
    });
  });

  it("resolves theorem and switch through the alias table", () => {
    expect(parseProofCommand("theorem MT")).toEqual({
      op: "theorem",
      theoremId: "modus-tollens",
      requested: "mt",
    });
    expect(parseProofCommand("switch quorum-overlap")).toEqual({
      op: "theorem",
      theoremId: "quorum-overlap",
      requested: "quorum-overlap",
    });
    expect(parseProofCommand("theorem nope")).toEqual({
      op: "theorem",
      theoremId: null,
      requested: "nope",
    });
  });

  it("prints known export formats inline and opens the dialog for anything else", () => {
    for (const format of ["lean", "latex", "markdown", "mermaid"]) {
      expect(parseProofCommand(`export ${format.toUpperCase()}`)).toEqual({
        op: "export",
        format,
      });
    }
    expect(parseProofCommand("export")).toEqual({ op: "export", format: null });
    expect(parseProofCommand("export pdf")).toEqual({
      op: "export",
      format: null,
    });
  });

  it("defaults simulate to normal mode", () => {
    expect(parseProofCommand("simulate")).toEqual({
      op: "simulate",
      mode: "normal",
    });
    expect(parseProofCommand("simulate LOOP")).toEqual({
      op: "simulate",
      mode: "loop",
    });
    expect(parseProofCommand("simulate fast")).toEqual({
      op: "simulate",
      mode: "normal",
    });
  });

  it("names an unknown command in lower case", () => {
    expect(parseProofCommand("Frobnicate now")).toEqual({
      op: "unknown",
      name: "frobnicate",
    });
  });
});

describe("resolveTheoremAlias", () => {
  it.each([
    ["mp", "modus-ponens"],
    ["hs", "hypothetical-syllogism"],
    ["ds", "disjunctive-syllogism"],
    ["res", "resolution"],
    ["2pc", "two-phase-commit"],
    ["cache", "cache-consistency"],
    ["paxos", "paxos-synod"],
    ["2b", "paxos-phase2b"],
    ["pbft", "bft-quorum"],
    ["custom", "custom"],
    ["resolution", "resolution"],
  ])("maps %s to %s", (alias, id) => {
    expect(resolveTheoremAlias(alias)).toBe(id);
  });

  it("rejects missing input, unknown ids and inherited object keys", () => {
    expect(resolveTheoremAlias(undefined)).toBeNull();
    expect(resolveTheoremAlias("")).toBeNull();
    expect(resolveTheoremAlias("pythagoras")).toBeNull();
    expect(resolveTheoremAlias("toString")).toBeNull();
    expect(resolveTheoremAlias("__proto__")).toBeNull();
  });
});

describe("terminal report formatting", () => {
  it("documents every command the parser accepts", () => {
    for (const op of [
      "connect",
      "disconnect",
      "prune",
      "delete-step",
      "apply",
      "autostep",
      "list",
      "inspect",
      "theorem",
      "ledger",
      "export",
      "simulate",
      "clear",
      "help",
    ]) {
      expect(PROOF_HELP_TEXT).toContain(`  ${op} `);
    }
  });

  it("lists nodes, edges with their rule and the open status", () => {
    const text = formatNodeList(MP, MP.initialEdges, false);
    expect(text).toContain(`Active Theorem: ${MP.title} (${MP.category})`);
    expect(text).toContain("[Node A] P (premise)");
    expect(text).toContain("  A -> C [MP]");
    expect(text).toContain("Status: ⏳ INCOMPLETE");
  });

  it("marks an empty graph and a proven one", () => {
    expect(formatNodeList(MP, [], false)).toContain("Edges:\n  (None)\n");
    const proven = formatNodeList(
      MP,
      [...MP.initialEdges, { source: "C", target: "E" }],
      true
    );
    expect(proven).toContain("  C -> E\n");
    expect(proven).toContain("Status: ✔ Q.E.D.");
  });

  it("prints one ledger row per step with its proof state", () => {
    const ledger = getDeductionLedger(MP.initialEdges, MP);
    const text = formatLedger(MP.title, ledger);
    expect(text.split("\n")[0]).toBe(`--- Deduction Ledger: ${MP.title} ---`);
    expect(text.split("\n")).toHaveLength(ledger.length + 1);
    expect(text).toContain("✔ PROVEN");
    expect(text).toContain("⏳ PENDING");
  });
});
