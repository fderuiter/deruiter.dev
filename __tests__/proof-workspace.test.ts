import { describe, it, expect } from "vitest";
import {
  isValidNode,
  getSuggestion,
  evaluateProofStatus,
  canConnect,
  getNextTacticHint,
  getDeductionLedger,
  pruneStepOrNode,
  getFallacyDiagnosis,
  type Edge,
} from "../lib/proof-utils";

describe("Logic Proof Workspace Utilities", () => {
  describe("isValidNode", () => {
    it("recognizes valid uppercase and lowercase node IDs", () => {
      expect(isValidNode("A")).toBe(true);
      expect(isValidNode("b")).toBe(true);
      expect(isValidNode("E")).toBe(true);
    });

    it("rejects invalid node IDs", () => {
      expect(isValidNode("X")).toBe(false);
      expect(isValidNode("1")).toBe(false);
      expect(isValidNode("")).toBe(false);
    });
  });

  describe("getSuggestion (Autocomplete)", () => {
    it("suggests valid command names from prefixes", () => {
      expect(getSuggestion("c")).toBe("connect");
      expect(getSuggestion("co")).toBe("connect");
      expect(getSuggestion("di")).toBe("disconnect");
      expect(getSuggestion("l")).toBe("list");
      expect(getSuggestion("he")).toBe("help");
      expect(getSuggestion("si")).toBe("simulate");
      expect(getSuggestion("sim")).toBe("simulate");
    });

    it("does not suggest anything if command is already complete", () => {
      expect(getSuggestion("help")).toBe("");
      expect(getSuggestion("list")).toBe("");
    });

    it("suggests subcommands for simulate", () => {
      expect(getSuggestion("simulate ")).toBe("simulate normal");
      expect(getSuggestion("simulate n")).toBe("simulate normal");
      expect(getSuggestion("simulate l")).toBe("simulate loop");
    });

    it("suggests node IDs inside connect parameters", () => {
      expect(getSuggestion("connect a")).toBe("connect A ");
      expect(getSuggestion("connect A b")).toBe("connect A B");
    });

    it("returns empty string if no valid prediction can be made", () => {
      expect(getSuggestion("invalid")).toBe("");
      expect(getSuggestion("connect A B C")).toBe("");
    });
  });

  describe("evaluateProofStatus", () => {
    it("correctly evaluates incomplete proof state", () => {
      const edges: Edge[] = [];
      const status = evaluateProofStatus(edges);
      expect(status.isC_Proven).toBe(false);
      expect(status.isE_Proven).toBe(false);
    });

    it("correctly evaluates proven intermediate step C but incomplete E", () => {
      const edges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
      ];
      const status = evaluateProofStatus(edges);
      expect(status.isC_Proven).toBe(true);
      expect(status.isE_Proven).toBe(false);
    });

    it("correctly evaluates completed proof when all connections exist", () => {
      const edges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];
      const status = evaluateProofStatus(edges);
      expect(status.isC_Proven).toBe(true);
      expect(status.isE_Proven).toBe(true);
    });
  });

  describe("canConnect", () => {
    it("prevents connecting a node to itself", () => {
      const result = canConnect("C", "C", []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("itself");
    });

    it("prevents duplicate edges", () => {
      const edges: Edge[] = [{ source: "A", target: "C" }];
      const result = canConnect("A", "C", edges);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("already connected");
    });

    it("allows valid deductive pairs (e.g. C -> E, D -> E)", () => {
      const edges: Edge[] = [];
      expect(canConnect("C", "E", edges).allowed).toBe(true);
      expect(canConnect("D", "E", edges).allowed).toBe(true);
      expect(canConnect("A", "C", edges).allowed).toBe(true);
      expect(canConnect("B", "C", edges).allowed).toBe(true);
    });

    it("rejects invalid inference pairs (e.g. A -> D or A -> E)", () => {
      const result = canConnect("A", "E", []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("No valid deductive inference rule");
    });
  });

  describe("getNextTacticHint", () => {
    it("returns Step 1 hint when initial premises are missing", () => {
      const hint = getNextTacticHint([]);
      expect(hint.stepNumber).toBe(1);
      expect(hint.isCompleted).toBe(false);
      expect(hint.suggestedSource).toBe("A");
      expect(hint.suggestedTarget).toBe("C");
    });

    it("returns Step 2 hint when C is proven but C -> E is missing", () => {
      const edges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
      ];
      const hint = getNextTacticHint(edges);
      expect(hint.stepNumber).toBe(2);
      expect(hint.isCompleted).toBe(false);
      expect(hint.suggestedSource).toBe("C");
      expect(hint.suggestedTarget).toBe("E");
    });

    it("returns completed Q.E.D. hint when all connections exist", () => {
      const edges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];
      const hint = getNextTacticHint(edges);
      expect(hint.stepNumber).toBe(3);
      expect(hint.isCompleted).toBe(true);
      expect(hint.title).toContain("Q.E.D.");
    });
  });

  describe("pruneStepOrNode (Essential Focus Step Deletion)", () => {
    it("prunes intermediate lemma step 3 and cascades to remove both incoming and downstream edges", () => {
      const fullEdges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];

      // Prune Step 3 (Node C)
      const res = pruneStepOrNode(3, fullEdges, "modus-ponens");
      expect(res.success).toBe(true);
      expect(res.prunedCount).toBe(3); // A->C, B->C, C->E
      expect(res.prunedNodeId).toBe("C");
      expect(res.newEdges).toEqual([{ source: "D", target: "E" }]);

      // Verify that after pruning C, intermediate status is false and proof status is incomplete
      const newStatus = evaluateProofStatus(res.newEdges, "modus-ponens");
      expect(newStatus.isC_Proven).toBe(false);
      expect(newStatus.isE_Proven).toBe(false);
    });

    it("prunes conclusion step 5 while preserving intermediate lemma edges", () => {
      const fullEdges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];

      // Prune Step 5 (Node E)
      const res = pruneStepOrNode(5, fullEdges, "modus-ponens");
      expect(res.success).toBe(true);
      expect(res.prunedCount).toBe(2); // C->E, D->E
      expect(res.prunedNodeId).toBe("E");
      expect(res.newEdges).toEqual([
        { source: "A", target: "C" },
        { source: "B", target: "C" },
      ]);

      // Intermediate is still proven, but goal conclusion is no longer proven
      const newStatus = evaluateProofStatus(res.newEdges, "modus-ponens");
      expect(newStatus.isC_Proven).toBe(true);
      expect(newStatus.isE_Proven).toBe(false);
    });

    it("accepts node IDs as strings (case-insensitive) for pruning", () => {
      const fullEdges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
      ];

      const res = pruneStepOrNode("c", fullEdges, "modus-ponens");
      expect(res.success).toBe(true);
      expect(res.prunedCount).toBe(2);
      expect(res.newEdges).toEqual([]);
    });

    it("protects foundational premises from deletion as immutable axioms", () => {
      const edges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
      ];

      // Premise 1 (Step 1 / Node A)
      const res1 = pruneStepOrNode(1, edges, "modus-ponens");
      expect(res1.success).toBe(false);
      expect(res1.reason).toContain("immutable axiom");

      // Premise 2 (Step 2 / Node B)
      const res2 = pruneStepOrNode("B", edges, "modus-ponens");
      expect(res2.success).toBe(false);
      expect(res2.reason).toContain("immutable axiom");

      // Premise 3 (Step 4 / Node D)
      const res4 = pruneStepOrNode(4, edges, "modus-ponens");
      expect(res4.success).toBe(false);
      expect(res4.reason).toContain("immutable axiom");
    });

    it("handles out of bounds step numbers and invalid node IDs", () => {
      const edges: Edge[] = [];
      const resOOB = pruneStepOrNode(99, edges, "modus-ponens");
      expect(resOOB.success).toBe(false);
      expect(resOOB.reason).toContain("out of bounds");

      const resInvalid = pruneStepOrNode("Z", edges, "modus-ponens");
      expect(resInvalid.success).toBe(false);
      expect(resInvalid.reason).toContain("not found");
    });
  });

  describe("getDeductionLedger Deletability Flags", () => {
    it("marks only proven derived steps as deletable and foundational premises as undeletable", () => {
      // Incomplete proof (no edges)
      const ledgerEmpty = getDeductionLedger([], "modus-ponens");
      expect(ledgerEmpty[0].isDeletable).toBe(false); // Premise 1
      expect(ledgerEmpty[1].isDeletable).toBe(false); // Premise 2
      expect(ledgerEmpty[2].isDeletable).toBe(false); // Pending Lemma (Step 3)
      expect(ledgerEmpty[3].isDeletable).toBe(false); // Premise 3
      expect(ledgerEmpty[4].isDeletable).toBe(false); // Pending Conclusion (Step 5)

      // Completed proof
      const fullEdges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];
      const ledgerFull = getDeductionLedger(fullEdges, "modus-ponens");
      expect(ledgerFull[0].isDeletable).toBe(false); // Premise 1
      expect(ledgerFull[1].isDeletable).toBe(false); // Premise 2
      expect(ledgerFull[2].isDeletable).toBe(true); // Proven Lemma (Step 3)
      expect(ledgerFull[3].isDeletable).toBe(false); // Premise 3
      expect(ledgerFull[4].isDeletable).toBe(true); // Proven Conclusion (Step 5)
    });
  });

  describe("Fallacy Diagnostics and Rollback Integration", () => {
    it("attaches sourceId and targetId to FallacyDiagnosis for 1-click rollback controls", () => {
      const diagnosis = getFallacyDiagnosis("C", "A", []);
      expect(diagnosis.sourceId).toBe("C");
      expect(diagnosis.targetId).toBe("A");
      expect(diagnosis.fallacyName).toBe("Fallacy of Affirming the Consequent");
    });

    it("correctly identifies non-sequitur connections with source and target binding", () => {
      const diagnosis = getFallacyDiagnosis("A", "E", []);
      expect(diagnosis.sourceId).toBe("A");
      expect(diagnosis.targetId).toBe("E");
      expect(diagnosis.fallacyName).toContain("Non Sequitur");
    });

    it("prunes invalid derived steps without deleting foundational premise axioms", () => {
      const edges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
      ];

      // Pruning step target 'C' removes edges connected to C
      const pruneRes = pruneStepOrNode("C", edges, "modus-ponens");
      expect(pruneRes.success).toBe(true);
      expect(pruneRes.newEdges).toEqual([]);

      // Premise 'A' cannot be pruned
      const premiseRes = pruneStepOrNode("A", edges, "modus-ponens");
      expect(premiseRes.success).toBe(false);
      expect(premiseRes.reason).toContain("immutable axiom");
    });
  });
});
