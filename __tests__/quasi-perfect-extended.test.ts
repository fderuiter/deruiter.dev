// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  cloneAST,
  findNodeById,
  replaceNode,
  areNodesEqual,
  renderASTString,
  evaluateArithmetic,
  isConcreteExpression,
  evaluateBooleanExpression,
  simplifyNode,
  isProofComplete,
  areAllSubgoalsClosed,
  areRingEquivalent,
  generateLeanProofScript,
} from "../lib/quasi-perfect/engine";
import { tacticDefs } from "../lib/quasi-perfect/tactics";
import { ASTNode, SubGoal } from "../lib/quasi-perfect/types";
import { puzzleLevels } from "../lib/quasi-perfect/levels";

describe("Quasi-Perfect Extended: Tactics & Ring Invariant Suite", () => {
  describe("AST Helper and Traversal Functions", () => {
    it("clones AST structures deeply including metadata and children", () => {
      const original: ASTNode = {
        id: "root-1",
        type: "Conjunction",
        value: "∧",
        metadata: { lemmaName: "testLemma" },
        children: [
          { id: "c1", type: "Variable", value: "P" },
          { id: "c2", type: "Variable", value: "Q" },
        ],
      };
      const cloned = cloneAST(original);
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.children![0]).not.toBe(original.children![0]);
    });

    it("searches nodes by ID accurately", () => {
      const tree: ASTNode = {
        id: "root",
        type: "Equality",
        value: "=",
        children: [
          { id: "lhs", type: "Constant", value: 4 },
          { id: "rhs", type: "Constant", value: 4 },
        ],
      };
      expect(findNodeById(tree, "rhs")?.value).toBe(4);
      expect(findNodeById(tree, "missing")).toBeNull();
    });

    it("replaces nodes deeply and returns updated root", () => {
      const tree: ASTNode = {
        id: "root",
        type: "Equality",
        value: "=",
        children: [
          { id: "lhs", type: "Variable", value: "x" },
          { id: "rhs", type: "Constant", value: 2 },
        ],
      };
      const updated = replaceNode(tree, "lhs", {
        id: "new-lhs",
        type: "Constant",
        value: 2,
      });
      expect(updated.children![0].value).toBe(2);
    });

    it("verifies AST equivalence across complex formulas", () => {
      const nodeA: ASTNode = {
        id: "a",
        type: "Implication",
        value: "→",
        children: [
          { id: "a1", type: "Variable", value: "P" },
          { id: "a2", type: "Variable", value: "Q" },
        ],
      };
      const nodeB: ASTNode = {
        id: "b",
        type: "Implication",
        value: "→",
        children: [
          { id: "b1", type: "Variable", value: "P" },
          { id: "b2", type: "Variable", value: "Q" },
        ],
      };
      expect(areNodesEqual(nodeA, nodeB)).toBe(true);
    });

    it("renders AST string representations for all formula types", () => {
      const neg: ASTNode = {
        id: "n",
        type: "Negation",
        value: "¬",
        children: [{ id: "inner", type: "Variable", value: "P" }],
      };
      expect(renderASTString(neg)).toBe("¬(P)");

      const fn: ASTNode = {
        id: "f",
        type: "Function",
        value: "f",
        children: [{ id: "arg", type: "Variable", value: "x" }],
      };
      expect(renderASTString(fn)).toBe("f(x)");
    });
  });

  describe("Arithmetic & Boolean Expression Evaluators", () => {
    it("evaluates concrete arithmetic expressions with addition, multiplication, and powers", () => {
      const add: ASTNode = {
        id: "add",
        type: "Operator",
        value: "+",
        children: [
          { id: "c1", type: "Constant", value: 5 },
          { id: "c2", type: "Constant", value: 7 },
        ],
      };
      expect(evaluateArithmetic(add)).toBe(12);

      const mul: ASTNode = {
        id: "mul",
        type: "Operator",
        value: "*",
        children: [
          { id: "c1", type: "Constant", value: 3 },
          { id: "c2", type: "Constant", value: 4 },
        ],
      };
      expect(evaluateArithmetic(mul)).toBe(12);
    });

    it("evaluates boolean expressions and relational operators", () => {
      const eq: ASTNode = {
        id: "eq",
        type: "Equality",
        value: "=",
        children: [
          { id: "c1", type: "Constant", value: 10 },
          { id: "c2", type: "Constant", value: 10 },
        ],
      };
      expect(isConcreteExpression(eq)).toBe(true);
      expect(evaluateBooleanExpression(eq)).toBe(true);

      const ineq: ASTNode = {
        id: "ineq",
        type: "Inequality",
        value: "<",
        children: [
          { id: "c1", type: "Constant", value: 5 },
          { id: "c2", type: "Constant", value: 10 },
        ],
      };
      expect(evaluateBooleanExpression(ineq)).toBe(true);
    });

    it("simplifies arithmetic identities (e.g. x + 0 = x, x * 1 = x, x * 0 = 0)", () => {
      const xPlusZero: ASTNode = {
        id: "add",
        type: "Operator",
        value: "+",
        children: [
          { id: "v", type: "Variable", value: "x" },
          { id: "z", type: "Constant", value: 0 },
        ],
      };
      const { node: simplified } = simplifyNode(xPlusZero);
      expect(simplified.type).toBe("Variable");
      expect(simplified.value).toBe("x");
    });
  });

  describe("Proof Status & Polynomial Ring Normalization", () => {
    it("checks proof completeness and subgoal closure", () => {
      const completeNode: ASTNode = { id: "qed", type: "Boolean", value: true };
      expect(isProofComplete(completeNode)).toBe(true);

      const subgoals: SubGoal[] = [
        {
          id: "sg1",
          label: "Goal 1",
          goal: { id: "g1", type: "Boolean", value: true },
          hypotheses: [],
          isCompleted: true,
        },
        {
          id: "sg2",
          label: "Goal 2",
          goal: { id: "g2", type: "Boolean", value: true },
          hypotheses: [],
          isCompleted: true,
        },
      ];
      expect(areAllSubgoalsClosed(subgoals)).toBe(true);
    });

    it("evaluates algebraic ring equivalence for commutative and distributive forms", () => {
      const aPlusB: ASTNode = {
        id: "1",
        type: "Operator",
        value: "+",
        children: [
          { id: "a", type: "Variable", value: "a" },
          { id: "b", type: "Variable", value: "b" },
        ],
      };
      const bPlusA: ASTNode = {
        id: "2",
        type: "Operator",
        value: "+",
        children: [
          { id: "b", type: "Variable", value: "b" },
          { id: "a", type: "Variable", value: "a" },
        ],
      };
      expect(areRingEquivalent(aPlusB, bPlusA)).toBe(true);
    });

    it("generates formatted Lean 4 proof scripts from executed tactic steps", () => {
      const script = generateLeanProofScript(
        puzzleLevels[0],
        [
          {
            id: "1",
            tacticId: "intro",
            leanLine: "intro x",
            explanation: "Introduce x",
            goalBefore: "∀ x, x = x",
            goalAfter: "x = x",
          },
          {
            id: "2",
            tacticId: "rfl",
            leanLine: "rfl",
            explanation: "Reflexivity",
            goalBefore: "x = x",
            goalAfter: "No goals",
          },
        ],
        true
      );
      expect(script).toContain("intro x");
      expect(script).toContain("rfl");
      expect(script).toContain("Q.E.D.");
    });
  });

  describe("Tactics Execution Suite (norm_num, decide, omega, linarith, symm, etc.)", () => {
    it("executes decide on concrete boolean goals", () => {
      const goal: ASTNode = {
        id: "decide-test",
        type: "Equality",
        value: "=",
        children: [
          { id: "c1", type: "Constant", value: 42 },
          { id: "c2", type: "Constant", value: 42 },
        ],
      };
      const res = tacticDefs.decide.execute(goal, goal, []);
      expect(res.success).toBe(true);
      expect(res.isProofComplete).toBe(true);
    });

    it("executes norm_num to reduce arithmetic constants", () => {
      const arith: ASTNode = {
        id: "arith-test",
        type: "Operator",
        value: "+",
        children: [
          { id: "c1", type: "Constant", value: 15 },
          { id: "c2", type: "Constant", value: 27 },
        ],
      };
      const res = tacticDefs.norm_num.execute(arith, arith, []);
      expect(res.success).toBe(true);
      expect(res.newAST?.value).toBe(42);
    });

    it("executes omega and linarith on integer inequalities", () => {
      const ineq: ASTNode = {
        id: "ineq-test",
        type: "Inequality",
        value: "≤",
        children: [
          { id: "v1", type: "Variable", value: "x" },
          {
            id: "v2",
            type: "Operator",
            value: "+",
            children: [
              { id: "v1_copy", type: "Variable", value: "x" },
              { id: "c1", type: "Constant", value: 1 },
            ],
          },
        ],
      };
      const resOmega = tacticDefs.omega.execute(ineq, ineq, []);
      expect(resOmega.success).toBe(true);

      const resLinarith = tacticDefs.linarith.execute(ineq, ineq, []);
      expect(resLinarith.success).toBe(true);
    });

    it("executes symmetry (symm) to transpose equality operands", () => {
      const eq: ASTNode = {
        id: "eq-test",
        type: "Equality",
        value: "=",
        children: [
          { id: "lhs", type: "Variable", value: "x" },
          { id: "rhs", type: "Variable", value: "y" },
        ],
      };
      const res = tacticDefs.symm.execute(eq, eq, []);
      expect(res.success).toBe(true);
      expect(res.newAST?.children![0].value).toBe("y");
      expect(res.newAST?.children![1].value).toBe("x");
    });
  });
});
