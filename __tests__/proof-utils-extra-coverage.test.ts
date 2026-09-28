import { describe, it, expect } from "vitest";
import {
  getSuggestion,
  getFallacyDiagnosis,
  canConnect,
  evaluateProofStatus,
  getNextTacticHint,
  getDeductionLedger,
  pruneStepOrNode,
  applyRuleToAsts,
  exportWorkspaceProof,
  exportProofToLean4,
  exportProofToLatex,
  exportProofToMarkdown,
  exportProofToMermaid,
  getCompatibleTargets,
  computeMagneticSnap,
  parseFormula,
  formatFormula,
  areAstsEqual,
  extractVariables,
  evaluateAst,
  evaluateAstWithTrace,
  generateTruthTable,
  THEOREMS,
  TheoremId,
  Edge,
  PropAst,
} from "../lib/proof-utils";

describe("proof-utils extra coverage suite", () => {
  describe("AST parsing and formatting edge cases", () => {
    it("handles formula formatting for iff, bottom, and invalid ASTs", () => {
      expect(formatFormula({ type: "bottom" })).toBe("⊥");
      expect(formatFormula(null)).toBe("");
      expect(formatFormula({ type: "var", name: "P" })).toBe("P");

      const iffAst: PropAst = {
        type: "iff",
        left: { type: "var", name: "P" },
        right: { type: "var", name: "Q" },
      };
      expect(formatFormula(iffAst)).toBe("P ↔ Q");

      const notAst: PropAst = {
        type: "not",
        operand: iffAst,
      };
      expect(formatFormula(notAst)).toBe("¬(P ↔ Q)");

      // @ts-expect-error testing invalid type
      expect(formatFormula({ type: "invalid_type" })).toBe("");
    });

    it("compares AST equivalence accurately", () => {
      expect(areAstsEqual(null, null)).toBe(false);
      expect(areAstsEqual({ type: "bottom" }, { type: "bottom" })).toBe(true);
      expect(
        areAstsEqual({ type: "var", name: "P" }, { type: "var", name: "Q" })
      ).toBe(false);

      const iff1: PropAst = {
        type: "iff",
        left: { type: "var", name: "P" },
        right: { type: "var", name: "Q" },
      };
      const iff2: PropAst = {
        type: "iff",
        left: { type: "var", name: "P" },
        right: { type: "var", name: "Q" },
      };
      expect(areAstsEqual(iff1, iff2)).toBe(true);

      // @ts-expect-error testing unknown AST type comparison
      expect(areAstsEqual({ type: "foo" }, { type: "foo" })).toBe(false);
    });

    it("extracts variables from complex and undefined ASTs", () => {
      expect(extractVariables(null)).toEqual([]);
      const complexAst: PropAst = {
        type: "iff",
        left: {
          type: "and",
          left: { type: "var", name: "A" },
          right: { type: "var", name: "B" },
        },
        right: { type: "not", operand: { type: "var", name: "C" } },
      };
      expect(extractVariables(complexAst).sort()).toEqual(["A", "B", "C"]);
    });

    it("evaluates iff ASTs correctly", () => {
      const iffAst: PropAst = {
        type: "iff",
        left: { type: "var", name: "P" },
        right: { type: "var", name: "Q" },
      };
      expect(evaluateAst(iffAst, { P: true, Q: true })).toBe(true);
      expect(evaluateAst(iffAst, { P: true, Q: false })).toBe(false);

      const trace = evaluateAstWithTrace(iffAst, { P: true, Q: true });
      expect(trace.value).toBe(true);
    });

    it("parses parenthesized formulas correctly", () => {
      const ast = parseFormula("(P && Q) || R");
      expect(ast?.type).toBe("or");

      const wrapped = parseFormula("((P))");
      expect(wrapped?.type).toBe("var");

      const unclosed = parseFormula("(P && Q");
      expect(unclosed).toBeDefined();

      const iff = parseFormula("P <-> Q");
      expect(iff?.type).toBe("iff");
    });

    it("generates truth table for 0, 1, and 2 variable sets", () => {
      const emptyTt = generateTruthTable([], {
        label: "C",
        ast: { type: "bottom" },
      });
      expect(emptyTt.variables).toEqual(["P", "Q"]);

      const singleXTt = generateTruthTable(
        [{ label: "P1", ast: { type: "var", name: "X" } }],
        { label: "C", ast: { type: "var", name: "X" } }
      );
      expect(singleXTt.variables).toContain("P");
      expect(singleXTt.variables).toContain("X");

      const singlePTt = generateTruthTable(
        [{ label: "P1", ast: { type: "var", name: "P" } }],
        { label: "C", ast: { type: "var", name: "P" } }
      );
      expect(singlePTt.variables).toContain("P");
      expect(singlePTt.variables).toContain("Q");
    });
  });

  describe("all theorems coverage", () => {
    const theoremKeys = Object.keys(THEOREMS) as TheoremId[];

    it("evaluates tactics, ledgers, and exports for all theorem IDs", () => {
      theoremKeys.forEach((thId) => {
        expect(evaluateProofStatus([], thId)).toBeDefined();
        expect(getNextTacticHint([], thId)).toBeDefined();
        expect(getDeductionLedger([], thId)).toBeDefined();
        expect(exportProofToLean4(thId)).toBeDefined();
        expect(exportProofToLatex(thId)).toBeDefined();
        expect(exportProofToMarkdown([], thId)).toBeDefined();
        expect(exportProofToMermaid([], thId)).toBeDefined();
      });
    });
  });

  describe("getSuggestion (autocomplete)", () => {
    it("handles connect/disconnect autocompletion", () => {
      expect(getSuggestion("connect A")).toBe("connect A ");
      expect(getSuggestion("connect A ")).toBe("");
      expect(getSuggestion("connect A B")).toBe("");
      expect(getSuggestion("connect a")).toBe("connect A ");
      expect(getSuggestion("disconnect A")).toBe("disconnect A ");
      expect(getSuggestion("disconnect a")).toBe("disconnect A ");
    });

    it("handles apply autocompletion", () => {
      expect(getSuggestion("apply de")).toBe("apply demorgan");
      expect(getSuggestion("apply mp")).toBe("");
    });

    it("handles theorem/switch autocompletion", () => {
      expect(getSuggestion("theorem mo")).toBe("theorem modus-ponens");
      expect(getSuggestion("switch pa")).toBe("switch paxos");
      expect(getSuggestion("switch custom")).toBe("");
    });

    it("handles inspect autocompletion", () => {
      expect(getSuggestion("inspect a")).toBe("");
      expect(getSuggestion("inspect A")).toBe("");
    });

    it("handles export autocompletion", () => {
      expect(getSuggestion("export le")).toBe("export lean");
      expect(getSuggestion("export markdown")).toBe("");
    });

    it("handles simulate autocompletion", () => {
      expect(getSuggestion("simulate n")).toBe("simulate normal");
      expect(getSuggestion("simulate ")).toBe("simulate normal");
    });

    it("handles prune and delete-step autocompletion", () => {
      expect(getSuggestion("prune c")).toBe("");
      expect(getSuggestion("delete-step 5")).toBe("");
    });

    it("returns empty string for non-matching input", () => {
      expect(getSuggestion("unknown command")).toBe("");
      expect(getSuggestion("")).toBe("");
    });
  });

  describe("canConnect", () => {
    it("disallows self-connection", () => {
      const res = canConnect("A", "A", []);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("itself");
    });

    it("disallows already connected nodes", () => {
      const edges: Edge[] = [{ source: "A", target: "C" }];
      const res = canConnect("A", "C", edges);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("already connected");
    });

    it("disallows invalid pairs", () => {
      const res = canConnect("A", "E", []);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("No valid deductive inference rule");
    });

    it("allows valid unconnected pair", () => {
      const res = canConnect("A", "C", []);
      expect(res.allowed).toBe(true);
    });
  });

  describe("getFallacyDiagnosis", () => {
    it("diagnoses circular reasoning", () => {
      const diag = getFallacyDiagnosis("A", "A", []);
      expect(diag.fallacyName).toContain("Circular Reasoning");
    });

    it("diagnoses affirming the consequent (C -> A)", () => {
      const diag = getFallacyDiagnosis("C", "A", []);
      expect(diag.fallacyName).toContain("Affirming the Consequent");
    });

    it("diagnoses denying the antecedent (A -> D)", () => {
      const diag = getFallacyDiagnosis("A", "D", []);
      expect(diag.fallacyName).toContain("Denying the Antecedent");
    });

    it("diagnoses non sequitur", () => {
      const diag = getFallacyDiagnosis("A", "E", []);
      expect(diag.fallacyName).toContain("Incompatible Terms");
    });
  });

  describe("getNextTacticHint", () => {
    it("returns Q.E.D hint when proof is completed", () => {
      const edges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];
      const hint = getNextTacticHint(edges, "modus-ponens");
      expect(hint.isCompleted).toBe(true);
      expect(hint.suggestedRule).toBe("Q.E.D.");
    });

    it("returns step 1 hint when req1 is missing", () => {
      const edges: Edge[] = [{ source: "B", target: "C" }];
      const hint = getNextTacticHint(edges, "modus-ponens");
      expect(hint.isCompleted).toBe(false);
      expect(hint.suggestedSource).toBe("A");
    });

    it("returns step 1 hint when req2 is missing", () => {
      const edges: Edge[] = [{ source: "A", target: "C" }];
      const hint = getNextTacticHint(edges, "modus-ponens");
      expect(hint.isCompleted).toBe(false);
      expect(hint.suggestedSource).toBe("B");
    });

    it("returns step 2 hint when cReq1 is missing", () => {
      const edges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "D", target: "E" },
      ];
      const hint = getNextTacticHint(edges, "modus-ponens");
      expect(hint.isCompleted).toBe(false);
      expect(hint.suggestedSource).toBe("C");
    });

    it("returns step 2 hint when cReq2 is missing", () => {
      const edges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
      ];
      const hint = getNextTacticHint(edges, "modus-ponens");
      expect(hint.isCompleted).toBe(false);
      expect(hint.suggestedSource).toBe("D");
    });
  });

  describe("getDeductionLedger", () => {
    it("generates ledger steps for modus-ponens", () => {
      const ledger = getDeductionLedger([], "modus-ponens");
      expect(ledger.length).toBe(5);
      expect(ledger[0].formula).toBe("P");
      expect(ledger[0].isDeletable).toBe(false);
    });
  });

  describe("pruneStepOrNode", () => {
    it("tests pruning all numbered steps 1 through 5", () => {
      [1, 2, 3, 4, 5].forEach((num) => {
        const res = pruneStepOrNode(num, []);
        if ([1, 2, 4].includes(num)) {
          expect(res.success).toBe(false);
        } else {
          expect(res.success).toBe(true);
        }
      });
    });

    it("tests pruning all named nodes A through E", () => {
      ["A", "B", "C", "D", "E"].forEach((nodeId) => {
        const res = pruneStepOrNode(nodeId, []);
        if (["A", "B", "D"].includes(nodeId)) {
          expect(res.success).toBe(false);
        } else {
          expect(res.success).toBe(true);
        }
      });
    });

    it("fails when step is out of bounds", () => {
      const res = pruneStepOrNode(9, []);
      expect(res.success).toBe(false);
      expect(res.reason).toContain("out of bounds");
    });

    it("fails when node ID is unknown", () => {
      const res = pruneStepOrNode("UNKNOWN", []);
      expect(res.success).toBe(false);
      expect(res.reason).toContain("not found");
    });

    it("successfully prunes derived node C and dependent edges", () => {
      const edges: Edge[] = [
        { source: "A", target: "C" },
        { source: "C", target: "E" },
      ];
      const res = pruneStepOrNode("C", edges);
      expect(res.success).toBe(true);
      expect(res.prunedCount).toBe(2);
      expect(res.newEdges.length).toBe(0);
    });
  });

  describe("applyRuleToAsts", () => {
    it("handles Modus Ponens", () => {
      const p = parseFormula("P")!;
      const imp = parseFormula("P -> Q")!;
      const res = applyRuleToAsts("mp", [p, imp]);
      expect(res.success).toBe(true);
      expect(res.resultAst?.type).toBe("var");

      const fail = applyRuleToAsts("mp", [p]);
      expect(fail.success).toBe(false);

      const mismatch = applyRuleToAsts("mp", [p, parseFormula("R -> Q")!]);
      expect(mismatch.success).toBe(false);
    });

    it("handles Modus Tollens", () => {
      const imp = parseFormula("P -> Q")!;
      const notQ = parseFormula("~Q")!;
      const res = applyRuleToAsts("mt", [imp, notQ]);
      expect(res.success).toBe(true);
      expect(res.resultAst?.type).toBe("not");

      const fail = applyRuleToAsts("mt", [imp]);
      expect(fail.success).toBe(false);
    });

    it("handles Hypothetical Syllogism", () => {
      const imp1 = parseFormula("P -> Q")!;
      const imp2 = parseFormula("Q -> R")!;
      const res = applyRuleToAsts("hs", [imp1, imp2]);
      expect(res.success).toBe(true);
      expect(res.resultAst?.type).toBe("implies");

      const fail = applyRuleToAsts("hs", [imp1]);
      expect(fail.success).toBe(false);
    });

    it("handles Disjunctive Syllogism", () => {
      const or = parseFormula("P || Q")!;
      const notP = parseFormula("~P")!;
      const res = applyRuleToAsts("ds", [or, notP]);
      expect(res.success).toBe(true);

      const fail = applyRuleToAsts("ds", [or]);
      expect(fail.success).toBe(false);
    });

    it("handles Conjunction Introduction", () => {
      const p = parseFormula("P")!;
      const q = parseFormula("Q")!;
      const res = applyRuleToAsts("and_intro", [p, q]);
      expect(res.success).toBe(true);
      expect(res.resultAst?.type).toBe("and");

      const fail = applyRuleToAsts("and_intro", [p]);
      expect(fail.success).toBe(false);
    });

    it("handles Resolution", () => {
      const p = parseFormula("P")!;
      const notP = parseFormula("~P")!;
      const res = applyRuleToAsts("res", [p, notP]);
      expect(res.success).toBe(true);
      expect(res.resultAst?.type).toBe("bottom");

      const pOrQ = parseFormula("P || Q")!;
      const res2 = applyRuleToAsts("res", [pOrQ, notP]);
      expect(res2.success).toBe(true);
      expect(res2.resultAst?.type).toBe("var");

      const fail = applyRuleToAsts("res", [p]);
      expect(fail.success).toBe(false);
    });

    it("returns error for unknown rule", () => {
      const res = applyRuleToAsts("unknown", []);
      expect(res.success).toBe(false);
    });
  });

  describe("exportWorkspaceProof & formats", () => {
    it("handles custom theorem export", () => {
      const exp = exportWorkspaceProof("lean", [], "custom");
      expect(exp).toContain("CUSTOM WORKSPACE UNAVAILABLE");
    });

    it("exports incomplete and complete proofs", () => {
      const incLean = exportWorkspaceProof("lean", [], "modus-ponens");
      expect(incLean).toContain("INCOMPLETE");

      const incLatex = exportWorkspaceProof("latex", [], "modus-ponens");
      expect(incLatex).toContain("INCOMPLETE");

      const edges: Edge[] = [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
        { source: "D", target: "E" },
      ];

      const compLean = exportWorkspaceProof("lean", edges, "modus-ponens");
      expect(compLean).not.toContain("INCOMPLETE");

      const compLatex = exportWorkspaceProof("latex", edges, "modus-ponens");
      expect(compLatex).not.toContain("INCOMPLETE");

      const md = exportWorkspaceProof("markdown", edges, "modus-ponens");
      expect(md).toContain("Proof Workspace Export");

      const mermaid = exportWorkspaceProof("mermaid", edges, "modus-ponens");
      expect(mermaid).toContain("graph LR");
    });

    it("exports lean, latex, markdown, mermaid directly", () => {
      expect(exportProofToLean4("modus-ponens")).toBeTruthy();
      expect(exportProofToLatex("modus-ponens")).toBeTruthy();
      expect(exportProofToMarkdown([])).toContain("Proof Workspace Export");
      expect(exportProofToMermaid([])).toContain("graph LR");
    });
  });

  describe("getCompatibleTargets", () => {
    it("returns compatible target info for source node A", () => {
      const targets = getCompatibleTargets("A", "modus-ponens", []);
      expect(targets.length).toBeGreaterThan(0);
      expect(targets[0].targetId).toBe("C");
    });

    it("returns empty list for unknown source node", () => {
      const targets = getCompatibleTargets("UNKNOWN");
      expect(targets.length).toBe(0);
    });
  });

  describe("computeMagneticSnap", () => {
    it("computes snapping position with grid and alignment", () => {
      const peers = [{ id: "A", x: 100, y: 100, width: 50, height: 50 }];
      const snap = computeMagneticSnap(102, 98, 50, 50, peers);
      expect(snap.snappedX).toBe(true);
      expect(snap.snappedY).toBe(true);
      expect(snap.guides.length).toBeGreaterThan(0);
    });
  });
});
