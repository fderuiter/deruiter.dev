// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createCustomTheorem } from "@/lib/proof-custom";
import {
  evaluateProofStatus,
  exportWorkspaceProof,
  getDeductionLedger,
} from "@/lib/proof-utils";

describe("Custom Proof formulas", () => {
  it("loads submitted premises and goal through the proof ledger and faithful exports", () => {
    const theorem = createCustomTheorem(["A", "A -> B", "B -> C"], "C");
    expect(theorem.nodes.map((node) => node.label)).toEqual([
      "A",
      "A -> B",
      "B",
      "B -> C",
      "C",
    ]);
    expect(getDeductionLedger([], theorem).map((step) => step.formula)).toEqual(
      ["A", "A -> B", "B", "B -> C", "C"]
    );
    const edges = theorem.validPairs.map(([source, target]) => ({
      source,
      target,
    }));
    expect(evaluateProofStatus(edges, theorem).isE_Proven).toBe(true);
    expect(exportWorkspaceProof("markdown", edges, theorem)).toContain(
      "`B -> C`"
    );
    expect(exportWorkspaceProof("lean", edges, theorem)).toContain(
      "(h1 : «A»)"
    );
    expect(exportWorkspaceProof("latex", edges, theorem)).toContain("C");
    expect(exportWorkspaceProof("mermaid", edges, theorem)).not.toContain(
      "P → Q"
    );
  });
  it("escapes proposition identifiers in Lean templates without shadowing them", () => {
    const theorem = createCustomTheorem(
      ["by", "by -> h1", "h1 -> Prop"],
      "Prop"
    );
    const edges = theorem.validPairs.map(([source, target]) => ({
      source,
      target,
    }));
    const lean = exportWorkspaceProof("lean", edges, theorem);
    expect(lean).toContain("«by» «h1» «Prop» : Prop");
    expect(lean).toContain("(h1_ : «by»)");
  });
  it("rejects malformed or unsupported input without modifying other sessions", () => {
    expect(() => createCustomTheorem(["A", "A ->", "B -> C"], "C")).toThrow(
      /Premise 2/
    );
    expect(() =>
      createCustomTheorem(["A ? B", "A -> B", "B -> C"], "C")
    ).toThrow(/Premise 1/);
    expect(() => createCustomTheorem(["A", "B", "C"], "D")).toThrow(
      /two binary inference/
    );
    const first = createCustomTheorem(["A", "A -> B", "B -> C"], "C");
    createCustomTheorem(["X", "X -> Y", "Y -> Z"], "Z");
    expect(first.nodes[4].label).toBe("C");
  });
});
