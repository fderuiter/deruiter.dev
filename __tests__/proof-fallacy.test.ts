// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  getFallacyDiagnosis,
  evaluateAstWithTrace,
  generateTruthTable,
  PropAst,
} from "../lib/proof-utils";

describe("Formal Fallacy Diagnostic Engine & Truth Tables", () => {
  it("identifies Fallacy of Circular Reasoning when connecting a node to itself", () => {
    const diagnosis = getFallacyDiagnosis("C", "C", []);
    expect(diagnosis.fallacyName).toContain("Circular Reasoning");
    expect(diagnosis.formalFormula).toContain("P ⊢ P");
    expect(diagnosis.softwareAnalogy).toContain("Circular dependency");
    expect(diagnosis.truthTable.some((r) => r.isCounterexample)).toBe(true);
    expect(diagnosis.counterexampleValuation).toEqual({ P: false, Q: false });
    expect(diagnosis.premises).toHaveLength(2);
    expect(diagnosis.conclusion).toBeDefined();
  });

  it("identifies Fallacy of Affirming the Consequent when wiring C -> A", () => {
    const diagnosis = getFallacyDiagnosis("C", "A", []);
    expect(diagnosis.fallacyName).toContain("Affirming the Consequent");
    expect(diagnosis.formalFormula).toContain("((P → Q) ∧ Q) ⊬ P");
    expect(diagnosis.truthTable.length).toBeGreaterThan(2);

    const counterexample = diagnosis.truthTable.find((r) => r.isCounterexample);
    expect(counterexample).toBeDefined();
    expect(counterexample?.p).toBe(false);
    expect(counterexample?.q).toBe(true);
    expect(counterexample?.conclusion).toBe(false);
    expect(diagnosis.counterexampleValuation).toEqual({ P: false, Q: true });
  });

  it("identifies Fallacy of Denying the Antecedent when wiring A -> D", () => {
    const diagnosis = getFallacyDiagnosis("A", "D", []);
    expect(diagnosis.fallacyName).toContain("Denying the Antecedent");
    expect(diagnosis.formalFormula).toContain("((P → Q) ∧ ¬P) ⊬ ¬Q");
    expect(diagnosis.softwareAnalogy).toContain("¬P");
    expect(diagnosis.counterexampleValuation).toEqual({ P: false, Q: true });
  });

  it("identifies Non Sequitur / Incompatible Terms for unconnected pairs", () => {
    const diagnosis = getFallacyDiagnosis("B", "D", []);
    expect(diagnosis.fallacyName).toContain("Incompatible Terms");
    expect(diagnosis.softwareAnalogy).toContain("Type mismatch");
    expect(diagnosis.counterexampleValuation).toEqual({ P: true, Q: false });
  });

  describe("evaluateAstWithTrace", () => {
    it("traces propositional variables and negation", () => {
      const ast: PropAst = { type: "not", operand: { type: "var", name: "P" } };
      const traceTrue = evaluateAstWithTrace(ast, { P: false });
      expect(traceTrue.value).toBe(true);
      expect(traceTrue.operator).toBe("¬");
      expect(traceTrue.children?.[0].value).toBe(false);

      const traceFalse = evaluateAstWithTrace(ast, { P: true });
      expect(traceFalse.value).toBe(false);
    });

    it("traces implications with sub-expressions", () => {
      const ast: PropAst = {
        type: "implies",
        left: { type: "var", name: "P" },
        right: { type: "var", name: "Q" },
      };

      const traceT_F = evaluateAstWithTrace(ast, { P: true, Q: false });
      expect(traceT_F.value).toBe(false);
      expect(traceT_F.operator).toBe("→");
      expect(traceT_F.children?.[0].value).toBe(true);
      expect(traceT_F.children?.[1].value).toBe(false);

      const traceF_F = evaluateAstWithTrace(ast, { P: false, Q: false });
      expect(traceF_F.value).toBe(true);
    });

    it("traces conjunctions, disjunctions, and biconditionals", () => {
      const andAst: PropAst = {
        type: "and",
        left: { type: "var", name: "A" },
        right: { type: "var", name: "B" },
      };
      expect(evaluateAstWithTrace(andAst, { A: true, B: true }).value).toBe(
        true
      );
      expect(evaluateAstWithTrace(andAst, { A: true, B: false }).value).toBe(
        false
      );

      const orAst: PropAst = {
        type: "or",
        left: { type: "var", name: "A" },
        right: { type: "var", name: "B" },
      };
      expect(evaluateAstWithTrace(orAst, { A: false, B: true }).value).toBe(
        true
      );
      expect(evaluateAstWithTrace(orAst, { A: false, B: false }).value).toBe(
        false
      );

      const iffAst: PropAst = {
        type: "iff",
        left: { type: "var", name: "A" },
        right: { type: "var", name: "B" },
      };
      expect(evaluateAstWithTrace(iffAst, { A: true, B: true }).value).toBe(
        true
      );
      expect(evaluateAstWithTrace(iffAst, { A: true, B: false }).value).toBe(
        false
      );
    });
  });

  describe("generateTruthTable", () => {
    it("synthesizes all 2^N combinatorial truth values", () => {
      const premises = [
        {
          label: "P → Q",
          ast: {
            type: "implies" as const,
            left: { type: "var" as const, name: "P" },
            right: { type: "var" as const, name: "Q" },
          },
        },
        {
          label: "Q",
          ast: { type: "var" as const, name: "Q" },
        },
      ];
      const conclusion = {
        label: "P",
        ast: { type: "var" as const, name: "P" },
      };

      const result = generateTruthTable(premises, conclusion);
      expect(result.truthTable).toHaveLength(4);
      expect(result.variables).toEqual(["P", "Q"]);
      expect(result.counterexampleValuation).toEqual({ P: false, Q: true });

      const counterexampleRow = result.truthTable.find(
        (r) => r.isCounterexample
      );
      expect(counterexampleRow).toBeDefined();
      expect(counterexampleRow?.p).toBe(false);
      expect(counterexampleRow?.q).toBe(true);
      expect(counterexampleRow?.premise1).toBe(true);
      expect(counterexampleRow?.premise2).toBe(true);
      expect(counterexampleRow?.conclusion).toBe(false);
    });
  });
});
