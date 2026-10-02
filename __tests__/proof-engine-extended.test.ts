// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  parseFormula,
  formatFormula,
  areAstsEqual,
  evaluateAst,
  applyRuleToAsts,
  getFallacyDiagnosis,
  getNextTacticHint,
  getDeductionLedger,
  exportProofToLean4,
  exportProofToLatex,
  exportProofToMarkdown,
  exportProofToMermaid,
  THEOREMS,
  type PropAst,
  type TheoremId,
} from "../lib/proof-utils";

describe("Proof Engine: Extended AST Inference & Propositional Logic Suite", () => {
  describe("AST Parsing & Formatting Invariants", () => {
    it("parses bottom / contradiction symbol properly", () => {
      expect(parseFormula("⊥")).toEqual({ type: "bottom" });
      expect(parseFormula("false")).toEqual({ type: "bottom" });
      expect(parseFormula("bot")).toEqual({ type: "bottom" });
    });

    it("parses biconditional propositions (<-> and ↔)", () => {
      const ast = parseFormula("P <-> Q");
      expect(ast).toEqual({
        type: "iff",
        left: { type: "var", name: "P" },
        right: { type: "var", name: "Q" },
      });
      expect(formatFormula(ast!)).toBe("P ↔ Q");
    });

    it("parses complex nested formulas with conjunctions and negations", () => {
      const ast = parseFormula("¬(P ∧ Q) -> (¬P ∨ ¬Q)");
      expect(ast).toBeDefined();
      expect(ast?.type).toBe("implies");
      expect(formatFormula(ast!)).toContain("→");
    });

    it("returns null for empty strings or invalid parentheses", () => {
      expect(parseFormula("")).toBeNull();
      expect(parseFormula("   ")).toBeNull();
    });

    it("evaluates areAstsEqual accurately across commutative / structural equivalence", () => {
      const a1: PropAst = { type: "var", name: "A" };
      const a2: PropAst = { type: "var", name: "A" };
      const b: PropAst = { type: "var", name: "B" };
      expect(areAstsEqual(a1, a2)).toBe(true);
      expect(areAstsEqual(a1, b)).toBe(false);

      const notA1: PropAst = { type: "not", operand: a1 };
      const notA2: PropAst = { type: "not", operand: a2 };
      expect(areAstsEqual(notA1, notA2)).toBe(true);

      const bot1: PropAst = { type: "bottom" };
      const bot2: PropAst = { type: "bottom" };
      expect(areAstsEqual(bot1, bot2)).toBe(true);
      expect(areAstsEqual(bot1, a1)).toBe(false);
    });

    it("evaluates propositional truth values across valuation assignments", () => {
      const pAndQ: PropAst = {
        type: "and",
        left: { type: "var", name: "P" },
        right: { type: "var", name: "Q" },
      };
      expect(evaluateAst(pAndQ, { P: true, Q: true })).toBe(true);
      expect(evaluateAst(pAndQ, { P: true, Q: false })).toBe(false);

      const pOrQ: PropAst = {
        type: "or",
        left: { type: "var", name: "P" },
        right: { type: "var", name: "Q" },
      };
      expect(evaluateAst(pOrQ, { P: false, Q: true })).toBe(true);
      expect(evaluateAst(pOrQ, { P: false, Q: false })).toBe(false);

      const bot: PropAst = { type: "bottom" };
      expect(evaluateAst(bot, {})).toBe(false);
    });
  });

  describe("Inference Rule Execution: applyRuleToAsts", () => {
    const P: PropAst = { type: "var", name: "P" };
    const Q: PropAst = { type: "var", name: "Q" };
    const R: PropAst = { type: "var", name: "R" };
    const S: PropAst = { type: "var", name: "S" };
    const notP: PropAst = { type: "not", operand: P };
    const notQ: PropAst = { type: "not", operand: Q };
    const P_implies_Q: PropAst = { type: "implies", left: P, right: Q };
    const Q_implies_R: PropAst = { type: "implies", left: Q, right: R };
    const P_or_Q: PropAst = { type: "or", left: P, right: Q };

    describe("Modus Ponens (MP)", () => {
      it("derives consequent Q from P and P → Q in both input orders", () => {
        const res1 = applyRuleToAsts("mp", [P, P_implies_Q]);
        expect(res1.success).toBe(true);
        expect(res1.resultAst).toEqual(Q);

        const res2 = applyRuleToAsts("modus-ponens", [P_implies_Q, P]);
        expect(res2.success).toBe(true);
        expect(res2.resultAst).toEqual(Q);
      });

      it("fails if inputs are invalid or non-matching", () => {
        expect(applyRuleToAsts("mp", [P]).success).toBe(false);
        expect(applyRuleToAsts("mp", [Q, P_implies_Q]).success).toBe(false);
      });
    });

    describe("Modus Tollens (MT)", () => {
      it("derives ¬P from P → Q and ¬Q in both input orders", () => {
        const res1 = applyRuleToAsts("mt", [P_implies_Q, notQ]);
        expect(res1.success).toBe(true);
        expect(res1.resultAst).toEqual(notP);

        const res2 = applyRuleToAsts("modus-tollens", [notQ, P_implies_Q]);
        expect(res2.success).toBe(true);
        expect(res2.resultAst).toEqual(notP);
      });

      it("fails when premises do not match modus tollens form", () => {
        expect(applyRuleToAsts("mt", [P_implies_Q, notP]).success).toBe(false);
      });
    });

    describe("Hypothetical Syllogism (HS)", () => {
      it("derives P → R from P → Q and Q → R in both input orders", () => {
        const res1 = applyRuleToAsts("hs", [P_implies_Q, Q_implies_R]);
        expect(res1.success).toBe(true);
        expect(res1.resultAst).toEqual({ type: "implies", left: P, right: R });

        const res2 = applyRuleToAsts("hypothetical-syllogism", [
          Q_implies_R,
          P_implies_Q,
        ]);
        expect(res2.success).toBe(true);
        expect(res2.resultAst).toEqual({ type: "implies", left: P, right: R });
      });

      it("fails when premises cannot chain transitively", () => {
        const nonChaining: PropAst = { type: "implies", left: R, right: S };
        expect(applyRuleToAsts("hs", [P_implies_Q, nonChaining]).success).toBe(
          false
        );
      });
    });

    describe("Disjunctive Syllogism (DS)", () => {
      it("derives Q from P ∨ Q and ¬P", () => {
        const res = applyRuleToAsts("ds", [P_or_Q, notP]);
        expect(res.success).toBe(true);
        expect(res.resultAst).toEqual(Q);
      });

      it("derives P from P ∨ Q and ¬Q", () => {
        const res = applyRuleToAsts("disjunctive-syllogism", [notQ, P_or_Q]);
        expect(res.success).toBe(true);
        expect(res.resultAst).toEqual(P);
      });

      it("fails if premises do not match disjunctive syllogism form", () => {
        expect(applyRuleToAsts("ds", [P, notP]).success).toBe(false);
      });
    });

    describe("Conjunction Introduction (∧-Intro)", () => {
      it("combines two verified propositions into a conjunction", () => {
        const res = applyRuleToAsts("and_intro", [P, Q]);
        expect(res.success).toBe(true);
        expect(res.resultAst).toEqual({ type: "and", left: P, right: Q });
      });
    });

    describe("Clausal Resolution (Res)", () => {
      it("derives unit resolvent and binary resolvents from complementary literals", () => {
        const A: PropAst = { type: "var", name: "A" };
        const B: PropAst = { type: "var", name: "B" };
        const C: PropAst = { type: "var", name: "C" };
        const notA: PropAst = { type: "not", operand: A };

        const clause1: PropAst = { type: "or", left: A, right: B };
        const clause2: PropAst = { type: "or", left: notA, right: C };

        const res = applyRuleToAsts("res", [clause1, clause2]);
        expect(res.success).toBe(true);
        expect(res.resultAst).toBeDefined();

        const resBot = applyRuleToAsts("resolution", [A, notA]);
        expect(resBot.success).toBe(true);
        expect(resBot.resultAst).toEqual({ type: "bottom" });
        expect(resBot.explanation).toContain("Empty Clause");
      });

      it("fails if clauses have no complementary literals", () => {
        const A: PropAst = { type: "var", name: "A" };
        const B: PropAst = { type: "var", name: "B" };
        expect(applyRuleToAsts("res", [A, B]).success).toBe(false);
      });
    });

    it("handles unknown rules gracefully", () => {
      const res = applyRuleToAsts("non-existent-rule", [P, Q]);
      expect(res.success).toBe(false);
      expect(res.explanation).toContain("Unknown rule");
    });
  });

  describe("Tactic Hints & Progress State", () => {
    it("generates progressive hints across all theorem categories", () => {
      const theoremIds = Object.keys(THEOREMS) as TheoremId[];
      for (const thId of theoremIds) {
        const initialHint = getNextTacticHint([], thId);
        expect(initialHint.stepNumber).toBeGreaterThanOrEqual(1);
        expect(initialHint.isCompleted).toBe(false);

        const th = THEOREMS[thId];
        const fullEdges = [
          { source: th.intermediateRequires[0], target: th.intermediateNodeId },
          { source: th.intermediateRequires[1], target: th.intermediateNodeId },
          { source: th.conclusionRequires[0], target: th.targetNodeId },
          { source: th.conclusionRequires[1], target: th.targetNodeId },
        ];
        const completedHint = getNextTacticHint(fullEdges, thId);
        expect(completedHint.isCompleted).toBe(true);
        expect(completedHint.title).toContain("Discharged");
      }
    });

    it("evaluates deduction ledger structure and proven status flags", () => {
      const ledger = getDeductionLedger([], "modus-ponens");
      expect(ledger.length).toBe(5);
      expect(ledger[0].isProven).toBe(true);
      expect(ledger[1].isProven).toBe(true);
      expect(ledger[2].isProven).toBe(false);
      expect(ledger[4].isProven).toBe(false);
    });
  });

  describe("Fallacy Diagnostics Engine", () => {
    it("generates fallacy diagnosis and truth table for invalid deductions", () => {
      const diag1 = getFallacyDiagnosis("C", "A", []);
      expect(diag1).toBeDefined();
      expect(diag1.truthTable.length).toBeGreaterThan(0);
      expect(diag1.truthTable.some((row) => row.isCounterexample)).toBe(true);

      const diagCircular = getFallacyDiagnosis("A", "A", []);
      expect(diagCircular).toBeDefined();
      expect(diagCircular.truthTable.some((row) => row.isCounterexample)).toBe(
        true
      );
    });
  });

  describe("Exporters: Lean 4, LaTeX, Markdown, Mermaid", () => {
    const thId: TheoremId = "modus-ponens";
    const edges = [
      { source: "A", target: "C" },
      { source: "B", target: "C" },
      { source: "C", target: "E" },
      { source: "D", target: "E" },
    ];

    it("exports valid Lean 4 code with theorem header and proof steps", () => {
      const lean = exportProofToLean4(thId);
      expect(lean).toContain("theorem");
      expect(lean).toContain("by");
    });

    it("exports LaTeX natural deduction derivation tree", () => {
      const latex = exportProofToLatex(thId);
      expect(latex).toContain("\\begin{prooftree}");
      expect(latex).toContain("AxiomC");
    });

    it("exports a markdown workspace snapshot with deduction ledger table", () => {
      const md = exportProofToMarkdown(edges, thId);
      expect(md).toContain("# Proof Workspace Export");
      expect(md).toContain(
        "GRAPH COMPLETE (local simulation; not Lean-verified)"
      );
      expect(md).toContain("| Step | Proposition |");
    });

    it("exports Mermaid flowchart with styling classes", () => {
      const mermaid = exportProofToMermaid(edges, thId);
      expect(mermaid).toContain("graph LR");
      expect(mermaid).toContain("classDef proven");
      expect(mermaid).toContain("Node_A");
    });
  });
});
