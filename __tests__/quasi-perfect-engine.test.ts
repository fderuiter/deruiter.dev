import { describe, it, expect } from "vitest";
import {
  cloneAST,
  findNodeById,
  replaceNode,
  areNodesEqual,
  renderASTString,
  evaluateArithmetic,
  evaluateBooleanExpression,
  astToPolynomial,
  areRingEquivalent,
  areAllSubgoalsClosed,
  generateLeanProofScript,
} from "../lib/quasi-perfect/engine";
import { tacticDefs } from "../lib/quasi-perfect/tactics";
import { puzzleLevels } from "../lib/quasi-perfect/levels";
import { ASTNode, SubGoal } from "../lib/quasi-perfect/types";

describe("Quasi-Perfect Puzzler Engine Core", () => {
  it("clones AST deeply without sharing references", () => {
    const original: ASTNode = {
      id: "root",
      type: "Operator",
      value: "+",
      children: [
        { id: "left", type: "Variable", value: "x" },
        { id: "right", type: "Constant", value: 0 },
      ],
    };
    const cloned = cloneAST(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.children![0]).not.toBe(original.children![0]);
  });

  it("finds nodes by id and replaces nodes accurately", () => {
    const tree: ASTNode = {
      id: "eq-root",
      type: "Equality",
      value: "=",
      children: [
        { id: "var-a", type: "Variable", value: "a" },
        { id: "var-c", type: "Variable", value: "c" },
      ],
    };

    const found = findNodeById(tree, "var-a");
    expect(found).not.toBeNull();
    expect(found?.value).toBe("a");

    const replacement: ASTNode = { id: "var-b", type: "Variable", value: "b" };
    const updated = replaceNode(tree, "var-a", replacement);
    expect(updated.children![0].value).toBe("b");
    expect(renderASTString(updated)).toBe("b = c");
  });

  it("checks deep structural equality between two subtrees", () => {
    const nodeA: ASTNode = {
      id: "1",
      type: "Operator",
      value: "+",
      children: [
        { id: "2", type: "Variable", value: "x" },
        { id: "3", type: "Constant", value: 5 },
      ],
    };
    const nodeB: ASTNode = {
      id: "99",
      type: "Operator",
      value: "+",
      children: [
        { id: "100", type: "Variable", value: "x" },
        { id: "101", type: "Constant", value: 5 },
      ],
    };
    const nodeC: ASTNode = {
      id: "102",
      type: "Operator",
      value: "+",
      children: [
        { id: "103", type: "Variable", value: "y" },
        { id: "104", type: "Constant", value: 5 },
      ],
    };

    expect(areNodesEqual(nodeA, nodeB)).toBe(true);
    expect(areNodesEqual(nodeA, nodeC)).toBe(false);
  });

  it("evaluates arithmetic constants and boolean expressions accurately", () => {
    const addExpr: ASTNode = {
      id: "add",
      type: "Operator",
      value: "+",
      children: [
        { id: "2", type: "Constant", value: 2 },
        { id: "3", type: "Constant", value: 3 },
      ],
    };
    expect(evaluateArithmetic(addExpr)).toBe(5);

    const multExpr: ASTNode = {
      id: "mult",
      type: "Operator",
      value: "*",
      children: [
        { id: "4", type: "Constant", value: 4 },
        { id: "5", type: "Constant", value: 5 },
      ],
    };
    expect(evaluateArithmetic(multExpr)).toBe(20);

    const conjExpr: ASTNode = {
      id: "conj",
      type: "Conjunction",
      value: "∧",
      children: [
        {
          id: "eq1",
          type: "Equality",
          value: "=",
          children: [
            { id: "c4", type: "Constant", value: 4 },
            { id: "c4b", type: "Constant", value: 4 },
          ],
        },
        {
          id: "ineq1",
          type: "Inequality",
          value: ">",
          children: [
            { id: "c10", type: "Constant", value: 10 },
            { id: "c2", type: "Constant", value: 2 },
          ],
        },
      ],
    };
    expect(evaluateBooleanExpression(conjExpr)).toBe(true);
  });

  it("proves polynomial ring equivalence via areRingEquivalent", () => {
    // (a + b)^2
    const polyLHS: ASTNode = {
      id: "lhs",
      type: "Operator",
      value: "^",
      children: [
        {
          id: "add",
          type: "Operator",
          value: "+",
          children: [
            { id: "a", type: "Variable", value: "a" },
            { id: "b", type: "Variable", value: "b" },
          ],
        },
        { id: "2", type: "Constant", value: 2 },
      ],
    };

    // a^2 + 2*a*b + b^2
    const polyRHS: ASTNode = {
      id: "rhs",
      type: "Operator",
      value: "+",
      children: [
        {
          id: "a2",
          type: "Operator",
          value: "^",
          children: [
            { id: "a_r", type: "Variable", value: "a" },
            { id: "2_r", type: "Constant", value: 2 },
          ],
        },
        {
          id: "mid",
          type: "Operator",
          value: "+",
          children: [
            {
              id: "2ab",
              type: "Operator",
              value: "*",
              children: [
                {
                  id: "2a",
                  type: "Operator",
                  value: "*",
                  children: [
                    { id: "c2", type: "Constant", value: 2 },
                    { id: "a_m", type: "Variable", value: "a" },
                  ],
                },
                { id: "b_m", type: "Variable", value: "b" },
              ],
            },
            {
              id: "b2",
              type: "Operator",
              value: "^",
              children: [
                { id: "b_r", type: "Variable", value: "b" },
                { id: "2_r2", type: "Constant", value: 2 },
              ],
            },
          ],
        },
      ],
    };

    expect(areRingEquivalent(polyLHS, polyRHS)).toBe(true);
  });

  it("checks areAllSubgoalsClosed accurately", () => {
    const sg1: SubGoal = {
      id: "1",
      label: "Goal 1",
      goal: { id: "b1", type: "Boolean", value: true },
      hypotheses: [],
      isCompleted: true,
    };
    const sg2: SubGoal = {
      id: "2",
      label: "Goal 2",
      goal: { id: "b2", type: "Boolean", value: true },
      hypotheses: [],
      isCompleted: true,
    };
    const sg3: SubGoal = {
      id: "3",
      label: "Goal 3",
      goal: { id: "b3", type: "Variable", value: "P" },
      hypotheses: [],
      isCompleted: false,
    };

    expect(areAllSubgoalsClosed([sg1, sg2])).toBe(true);
    expect(areAllSubgoalsClosed([sg1, sg3])).toBe(false);
  });
});

describe("Quasi-Perfect Puzzler Expanded Tactics", () => {
  it("executes intro tactic on implication", () => {
    const impGoal: ASTNode = {
      id: "imp",
      type: "Implication",
      value: "→",
      children: [
        { id: "P", type: "Variable", value: "P" },
        { id: "Q", type: "Variable", value: "Q" },
      ],
    };

    const res = tacticDefs.intro.execute(impGoal, impGoal, [], "h1");
    expect(res.success).toBe(true);
    expect(res.ramConsumed).toBe(2);
    expect(res.newHypotheses?.length).toBe(1);
    expect(res.newHypotheses![0].metadata?.name).toBe("h1");
    expect(res.newAST?.value).toBe("Q");
    expect(res.leanProofStep).toBe("intro h1");
  });

  it("executes apply tactic for modus ponens backwards reasoning", () => {
    const hypImp: ASTNode = {
      id: "h_imp",
      type: "Implication",
      value: "→",
      metadata: { name: "h_imp" },
      children: [
        { id: "P", type: "Variable", value: "P" },
        { id: "Q", type: "Variable", value: "Q" },
      ],
    };
    const goalQ: ASTNode = { id: "goal-q", type: "Variable", value: "Q" };

    const res = tacticDefs.apply.execute(goalQ, goalQ, [hypImp], "h_imp");
    expect(res.success).toBe(true);
    expect(res.ramConsumed).toBe(3);
    expect(res.newAST?.value).toBe("P");
    expect(res.leanProofStep).toBe("apply h_imp");
  });

  it("executes exact tactic to close goal from hypothesis", () => {
    const hypP: ASTNode = {
      id: "h_p",
      type: "Variable",
      value: "P",
      metadata: { name: "h_p" },
    };
    const goalP: ASTNode = { id: "goal-p", type: "Variable", value: "P" };

    const res = tacticDefs.exact.execute(goalP, goalP, [hypP], "h_p");
    expect(res.success).toBe(true);
    expect(res.ramConsumed).toBe(1);
    expect(res.isProofComplete).toBe(true);
    expect(res.leanProofStep).toBe("exact h_p");
  });

  it("executes cases tactic splitting disjunction into 2 subgoals", () => {
    const hypOr: ASTNode = {
      id: "h_or",
      type: "Disjunction",
      value: "∨",
      metadata: { name: "h_or" },
      children: [
        { id: "P", type: "Variable", value: "P" },
        { id: "Q", type: "Variable", value: "Q" },
      ],
    };
    const goalRoot: ASTNode = { id: "goal-root", type: "Variable", value: "R" };

    const res = tacticDefs.cases.execute(goalRoot, goalRoot, [hypOr], "h_or");
    expect(res.success).toBe(true);
    expect(res.ramConsumed).toBe(4);
    expect(res.newSubGoals?.length).toBe(2);
    expect(res.newSubGoals![0].label).toContain("Case 1: P");
    expect(res.newSubGoals![1].label).toContain("Case 2: Q");
    expect(res.leanProofStep).toBe("cases h_or with h_left h_right");
  });

  it("executes left and right disjunction constructor tactics", () => {
    const disjGoal: ASTNode = {
      id: "disj-test",
      type: "Disjunction",
      value: "∨",
      children: [
        { id: "A", type: "Variable", value: "A" },
        { id: "B", type: "Variable", value: "B" },
      ],
    };

    // Test left: A ∨ B ⟹ A
    const resLeft = tacticDefs.left.execute(disjGoal, disjGoal, []);
    expect(resLeft.success).toBe(true);
    expect(resLeft.ramConsumed).toBe(1);
    expect(resLeft.newAST?.value).toBe("A");
    expect(resLeft.leanProofStep).toBe("left");

    // Test right: A ∨ B ⟹ B
    const resRight = tacticDefs.right.execute(disjGoal, disjGoal, []);
    expect(resRight.success).toBe(true);
    expect(resRight.ramConsumed).toBe(1);
    expect(resRight.newAST?.value).toBe("B");
    expect(resRight.leanProofStep).toBe("right");

    // Error handling on non-disjunction
    const nonDisj: ASTNode = { id: "var-x", type: "Variable", value: "X" };
    expect(tacticDefs.left.execute(nonDisj, nonDisj, []).success).toBe(false);
    expect(tacticDefs.right.execute(nonDisj, nonDisj, []).success).toBe(false);
  });

  it("executes symm tactic to swap LHS and RHS of equality", () => {
    const eqNode: ASTNode = {
      id: "eq-test",
      type: "Equality",
      value: "=",
      children: [
        { id: "var-b", type: "Variable", value: "b" },
        { id: "var-a", type: "Variable", value: "a" },
      ],
    };
    const res = tacticDefs.symm.execute(eqNode, eqNode, []);
    expect(res.success).toBe(true);
    expect(res.ramConsumed).toBe(1);
    expect(res.newAST?.children![0].value).toBe("a");
    expect(res.newAST?.children![1].value).toBe("b");
    expect(res.leanProofStep).toBe("symm");
  });

  it("executes split tactic on conjunction goal into 2 subgoals", () => {
    const conjGoal: ASTNode = {
      id: "conj-test",
      type: "Conjunction",
      value: "∧",
      children: [
        { id: "p-sub", type: "Variable", value: "P" },
        { id: "q-sub", type: "Variable", value: "Q" },
      ],
    };
    const res = tacticDefs.split.execute(conjGoal, conjGoal, []);
    expect(res.success).toBe(true);
    expect(res.ramConsumed).toBe(2);
    expect(res.newSubGoals?.length).toBe(2);
    expect(res.newSubGoals![0].label).toContain("Left Branch: P");
    expect(res.newSubGoals![1].label).toContain("Right Branch: Q");
    expect(res.leanProofStep).toBe("constructor");
  });
});

describe("Quasi-Perfect Puzzler Granular 18-Level Step-by-Step Solvability", () => {
  // =========================================================================
  // CHAPTER 1: Equational Reasoning & Term Rewriting (Levels 1 - 6)
  // =========================================================================

  it("Level 1: The Identity Crisis (x = x via rfl)", () => {
    const lvl = puzzleLevels[0];
    expect(lvl.id).toBe(1);
    expect(lvl.chapter).toBe(1);
    expect(renderASTString(lvl.goal)).toBe("x = x");

    const step1 = tacticDefs.rfl.execute(lvl.goal, lvl.goal, lvl.hypotheses);
    expect(step1.success).toBe(true);
    expect(step1.isProofComplete).toBe(true);
    expect(step1.leanProofStep).toBe("rfl");
  });

  it("Level 2: The Mirror Law (a = b ⊢ b = a via symm + rw [h] + rfl)", () => {
    const lvl = puzzleLevels[1];
    expect(lvl.id).toBe(2);
    expect(renderASTString(lvl.goal)).toBe("b = a");

    // Step 1: symm -> a = b
    const step1 = tacticDefs.symm.execute(lvl.goal, lvl.goal, lvl.hypotheses);
    expect(step1.success).toBe(true);
    expect(renderASTString(step1.newAST!)).toBe("a = b");
    expect(step1.leanProofStep).toBe("symm");

    // Step 2: rw [h] on LHS 'a' -> b = b
    const targetA = step1.newAST!.children![0];
    const step2 = tacticDefs.rw.execute(
      targetA,
      step1.newAST!,
      lvl.hypotheses,
      "h"
    );
    expect(step2.success).toBe(true);
    expect(renderASTString(step2.newAST!)).toBe("b = b");

    // Step 3: rfl -> QED
    const step3 = tacticDefs.rfl.execute(
      step2.newAST!,
      step2.newAST!,
      lvl.hypotheses
    );
    expect(step3.success).toBe(true);
    expect(step3.isProofComplete).toBe(true);
  });

  it("Level 2: wrong-target rw names the selection, the expected sub-terms and a next action (#1232)", () => {
    const lvl = puzzleLevels[1];
    const flipped = tacticDefs.symm.execute(lvl.goal, lvl.goal, lvl.hypotheses);
    const root = flipped.newAST!;
    const res = tacticDefs.rw.execute(root, root, lvl.hypotheses, "h");
    expect(res.success).toBe(false);
    expect(res.ramConsumed).toBe(1);
    // Not the old tautology "Sub-expression 'a = b' does not match 'a = b'".
    expect(res.message).not.toMatch(/does not match 'a = b'/);
    expect(res.message).toContain("selected 'a = b'");
    expect(res.message).toContain("'a' or 'b'");
    expect(res.message).toMatch(/Tap one of those sub-terms/);
  });

  it("Level 2: briefing and hints match the auto-closing rewrite (#1232)", () => {
    const lvl = puzzleLevels[1];
    const copy = [...lvl.hints, lvl.educationalConcept.tacticalObjective].join(
      " "
    );
    expect(copy).toMatch(/sub-term 'a'/);
    expect(copy).toMatch(/closes automatically/);
    expect(lvl.hints.join(" ")).not.toMatch(/'rw \[h\]' and 'rfl'/);
  });

  it("Level 3: The Transitivity Chain (a = b, b = c ⊢ a = c via rw [h1] + rw [h2] + rfl)", () => {
    const lvl = puzzleLevels[2];
    expect(lvl.id).toBe(3);
    expect(renderASTString(lvl.goal)).toBe("a = c");

    // Step 1: rw [h1] on 'a' -> b = c
    const step1 = tacticDefs.rw.execute(
      lvl.goal.children![0],
      lvl.goal,
      lvl.hypotheses,
      "h1"
    );
    expect(step1.success).toBe(true);
    expect(renderASTString(step1.newAST!)).toBe("b = c");

    // Step 2: rw [h2] on 'b' -> c = c
    const step2 = tacticDefs.rw.execute(
      step1.newAST!.children![0],
      step1.newAST!,
      lvl.hypotheses,
      "h2"
    );
    expect(step2.success).toBe(true);
    expect(renderASTString(step2.newAST!)).toBe("c = c");

    // Step 3: rfl -> QED
    const step3 = tacticDefs.rfl.execute(
      step2.newAST!,
      step2.newAST!,
      lvl.hypotheses
    );
    expect(step3.success).toBe(true);
    expect(step3.isProofComplete).toBe(true);
  });

  it("Level 4: Associative Grouping ((a + b) + c = a + (b + c) via rw [add_assoc] + rfl)", () => {
    const lvl = puzzleLevels[3];
    expect(lvl.id).toBe(4);

    const step1 = tacticDefs.rw.execute(
      lvl.goal.children![0],
      lvl.goal,
      lvl.hypotheses,
      "add_assoc"
    );
    expect(step1.success).toBe(true);
    expect(renderASTString(step1.newAST!)).toBe("a + (b + c) = a + (b + c)");

    const step2 = tacticDefs.rfl.execute(
      step1.newAST!,
      step1.newAST!,
      lvl.hypotheses
    );
    expect(step2.success).toBe(true);
    expect(step2.isProofComplete).toBe(true);
  });

  it("Level 5: Memory Economics (x + 0 = x via rw [add_zero] + rfl)", () => {
    const lvl = puzzleLevels[4];
    expect(lvl.id).toBe(5);

    const step1 = tacticDefs.rw.execute(
      lvl.goal.children![0],
      lvl.goal,
      lvl.hypotheses,
      "add_zero"
    );
    expect(step1.success).toBe(true);
    expect(renderASTString(step1.newAST!)).toBe("x = x");

    const step2 = tacticDefs.rfl.execute(
      step1.newAST!,
      step1.newAST!,
      lvl.hypotheses
    );
    expect(step2.success).toBe(true);
    expect(step2.isProofComplete).toBe(true);
  });

  it("Level 6: Ring Axioms & Expansion ((a + b)^2 = a^2 + 2ab + b^2 via ring)", () => {
    const lvl = puzzleLevels[5];
    expect(lvl.id).toBe(6);

    const step1 = tacticDefs.ring.execute(lvl.goal, lvl.goal, lvl.hypotheses);
    expect(step1.success).toBe(true);
    expect(step1.isProofComplete).toBe(true);
    expect(step1.leanProofStep).toBe("ring");
  });

  // =========================================================================
  // CHAPTER 2: Propositional Logic & Natural Deduction (Levels 7 - 12)
  // =========================================================================

  it("Level 7: The Deduction Theorem (P → P via intro h + exact h)", () => {
    const lvl = puzzleLevels[6];
    expect(lvl.id).toBe(7);

    // Step 1: intro h -> hypothesis [h : P], goal: P
    const step1 = tacticDefs.intro.execute(
      lvl.goal,
      lvl.goal,
      lvl.hypotheses,
      "h"
    );
    expect(step1.success).toBe(true);
    expect(step1.newHypotheses?.length).toBe(1);
    expect(step1.newAST?.value).toBe("P");

    // Step 2: exact h -> QED
    const step2 = tacticDefs.exact.execute(
      step1.newAST!,
      step1.newAST!,
      step1.newHypotheses!,
      "h"
    );
    expect(step2.success).toBe(true);
    expect(step2.isProofComplete).toBe(true);
  });

  it("Level 8: Modus Ponens in Action (P → Q, P ⊢ Q via apply h_imp + exact h_p)", () => {
    const lvl = puzzleLevels[7];
    expect(lvl.id).toBe(8);

    // Step 1: apply h_imp -> goal becomes P
    const step1 = tacticDefs.apply.execute(
      lvl.goal,
      lvl.goal,
      lvl.hypotheses,
      "h_imp"
    );
    expect(step1.success).toBe(true);
    expect(step1.newAST?.value).toBe("P");

    // Step 2: exact h_p -> QED
    const step2 = tacticDefs.exact.execute(
      step1.newAST!,
      step1.newAST!,
      lvl.hypotheses,
      "h_p"
    );
    expect(step2.success).toBe(true);
    expect(step2.isProofComplete).toBe(true);
  });

  it("Level 9: Conjunction Synthesis (P, Q ⊢ P ∧ Q via split + exact h_p + exact h_q)", () => {
    const lvl = puzzleLevels[8];
    expect(lvl.id).toBe(9);

    // Step 1: split -> Subgoal 1 (P), Subgoal 2 (Q)
    const step1 = tacticDefs.split.execute(lvl.goal, lvl.goal, lvl.hypotheses);
    expect(step1.success).toBe(true);
    expect(step1.newSubGoals?.length).toBe(2);

    // Subgoal 1: exact h_p
    const sg1 = step1.newSubGoals![0];
    const res1 = tacticDefs.exact.execute(
      sg1.goal,
      sg1.goal,
      sg1.hypotheses,
      "h_p"
    );
    expect(res1.success).toBe(true);
    expect(res1.isProofComplete).toBe(true);

    // Subgoal 2: exact h_q
    const sg2 = step1.newSubGoals![1];
    const res2 = tacticDefs.exact.execute(
      sg2.goal,
      sg2.goal,
      sg2.hypotheses,
      "h_q"
    );
    expect(res2.success).toBe(true);
    expect(res2.isProofComplete).toBe(true);
  });

  it("Level 10: Hypothetical Syllogism (P → Q, Q → R, P ⊢ R via apply h2 + apply h1 + exact h_p)", () => {
    const lvl = puzzleLevels[9];
    expect(lvl.id).toBe(10);

    // Step 1: apply h2 (Q → R) -> goal becomes Q
    const step1 = tacticDefs.apply.execute(
      lvl.goal,
      lvl.goal,
      lvl.hypotheses,
      "h2"
    );
    expect(step1.success).toBe(true);
    expect(step1.newAST?.value).toBe("Q");

    // Step 2: apply h1 (P → Q) -> goal becomes P
    const step2 = tacticDefs.apply.execute(
      step1.newAST!,
      step1.newAST!,
      lvl.hypotheses,
      "h1"
    );
    expect(step2.success).toBe(true);
    expect(step2.newAST?.value).toBe("P");

    // Step 3: exact h_p -> QED
    const step3 = tacticDefs.exact.execute(
      step2.newAST!,
      step2.newAST!,
      lvl.hypotheses,
      "h_p"
    );
    expect(step3.success).toBe(true);
    expect(step3.isProofComplete).toBe(true);
  });

  it("Level 11: Disjunction Splitting (P ∨ Q ⊢ Q ∨ P via cases h_or + right/left + exact)", () => {
    const lvl = puzzleLevels[10];
    expect(lvl.id).toBe(11);

    // Step 1: cases h_or -> Subgoal 1 (Case 1: h_left : P) and Subgoal 2 (Case 2: h_right : Q)
    const step1 = tacticDefs.cases.execute(
      lvl.goal,
      lvl.goal,
      lvl.hypotheses,
      "h_or"
    );
    expect(step1.success).toBe(true);
    expect(step1.newSubGoals?.length).toBe(2);

    // Branch 1 (Case 1: goal Q ∨ P with h_left: P)
    const sub1 = step1.newSubGoals![0];
    // Select right disjunct: Q ∨ P ⟹ P
    const right1 = tacticDefs.right.execute(
      sub1.goal,
      sub1.goal,
      sub1.hypotheses
    );
    expect(right1.success).toBe(true);
    expect(right1.newAST?.value).toBe("P");
    // Close with exact h_left
    const close1 = tacticDefs.exact.execute(
      right1.newAST!,
      right1.newAST!,
      sub1.hypotheses,
      "h_left"
    );
    expect(close1.success).toBe(true);
    expect(close1.isProofComplete).toBe(true);

    // Branch 2 (Case 2: goal Q ∨ P with h_right: Q)
    const sub2 = step1.newSubGoals![1];
    // Select left disjunct: Q ∨ P ⟹ Q
    const left2 = tacticDefs.left.execute(
      sub2.goal,
      sub2.goal,
      sub2.hypotheses
    );
    expect(left2.success).toBe(true);
    expect(left2.newAST?.value).toBe("Q");
    // Close with exact h_right
    const close2 = tacticDefs.exact.execute(
      left2.newAST!,
      left2.newAST!,
      sub2.hypotheses,
      "h_right"
    );
    expect(close2.success).toBe(true);
    expect(close2.isProofComplete).toBe(true);
  });

  it("Level 12: Decidable Computation ((2 * 3 = 6) ∧ (10 > 5) via norm_num)", () => {
    const lvl = puzzleLevels[11];
    expect(lvl.id).toBe(12);

    const step1 = tacticDefs.norm_num.execute(
      lvl.goal,
      lvl.goal,
      lvl.hypotheses
    );
    expect(step1.success).toBe(true);
    expect(step1.isProofComplete).toBe(true);
    expect(step1.leanProofStep).toBe("norm_num");
  });

  // =========================================================================
  // CHAPTER 3: Presburger Systems & Quasiperfect Theory (Levels 13 - 18)
  // =========================================================================

  it("Level 13: Presburger Systems (0 ≤ x, y ≤ 2x ⊢ 3x + 2y ≤ 5x + y via omega)", () => {
    const lvl = puzzleLevels[12];
    expect(lvl.id).toBe(13);

    const step1 = tacticDefs.omega.execute(lvl.goal, lvl.goal, lvl.hypotheses);
    expect(step1.success).toBe(true);
    expect(step1.isProofComplete).toBe(true);
    expect(step1.leanProofStep).toBe("omega");
  });

  it("Level 14: Bounded Transitivity (a ≤ b, b ≤ c ⊢ a ≤ c via linarith)", () => {
    const lvl = puzzleLevels[13];
    expect(lvl.id).toBe(14);

    const step1 = tacticDefs.linarith.execute(
      lvl.goal,
      lvl.goal,
      lvl.hypotheses
    );
    expect(step1.success).toBe(true);
    expect(step1.isProofComplete).toBe(true);
    expect(step1.leanProofStep).toBe("linarith");
  });

  it("Level 15: Divisor Function Primer (σ(p) = p + 1 via rw [h_prime] + rfl)", () => {
    const lvl = puzzleLevels[14];
    expect(lvl.id).toBe(15);

    const step1 = tacticDefs.rw.execute(
      lvl.goal.children![0],
      lvl.goal,
      lvl.hypotheses,
      "h_prime"
    );
    expect(step1.success).toBe(true);
    expect(renderASTString(step1.newAST!)).toBe("p + 1 = p + 1");

    const step2 = tacticDefs.rfl.execute(
      step1.newAST!,
      step1.newAST!,
      lvl.hypotheses
    );
    expect(step2.success).toBe(true);
    expect(step2.isProofComplete).toBe(true);
  });

  it("Level 16: Cattaneo's Abundancy (σ(n) = 2n + 1 ⊢ σ(n) > 2n via rw [h_def] + linarith)", () => {
    const lvl = puzzleLevels[15];
    expect(lvl.id).toBe(16);

    const step1 = tacticDefs.rw.execute(
      lvl.goal.children![0],
      lvl.goal,
      lvl.hypotheses,
      "h_def"
    );
    expect(step1.success).toBe(true);
    expect(renderASTString(step1.newAST!)).toBe("2 * n + 1 > 2 * n");

    const step2 = tacticDefs.linarith.execute(
      step1.newAST!,
      step1.newAST!,
      lvl.hypotheses
    );
    expect(step2.success).toBe(true);
    expect(step2.isProofComplete).toBe(true);
  });

  it("Level 17: Aliquot Sum Partition (σ(n) = 2n + 1 ⊢ σ(n) - n = n + 1 via rw [h_def] + ring)", () => {
    const lvl = puzzleLevels[16];
    expect(lvl.id).toBe(17);

    // Target the σ(n) subterm inside (σ(n) - n)
    const targetSigma = lvl.goal.children![0].children![0];
    const step1 = tacticDefs.rw.execute(
      targetSigma,
      lvl.goal,
      lvl.hypotheses,
      "h_def"
    );
    expect(step1.success).toBe(true);

    const step2 = tacticDefs.ring.execute(
      step1.newAST!,
      step1.newAST!,
      lvl.hypotheses
    );
    expect(step2.success).toBe(true);
    expect(step2.isProofComplete).toBe(true);
  });

  it("Level 18: The Quasiperfect Capstone ((σ(n) - 1) + n^2 = (n + 1)^2 - 1 via rw [h_sig] + ring)", () => {
    const lvl = puzzleLevels[17];
    expect(lvl.id).toBe(18);

    // Target σ(n) in (σ(n) - 1)
    const targetSigma = lvl.goal.children![0].children![0].children![0];
    const step1 = tacticDefs.rw.execute(
      targetSigma,
      lvl.goal,
      lvl.hypotheses,
      "h_sig"
    );
    expect(step1.success).toBe(true);

    const step2 = tacticDefs.ring.execute(
      step1.newAST!,
      step1.newAST!,
      lvl.hypotheses
    );
    expect(step2.success).toBe(true);
    expect(step2.isProofComplete).toBe(true);
  });

  it("generates Lean 4 proof scripts for completed and in-progress proofs", () => {
    const l1 = puzzleLevels[0];
    const scriptEmpty = generateLeanProofScript(l1, [], false);
    expect(scriptEmpty).toContain("sorry -- Goal open");

    const scriptDone = generateLeanProofScript(
      l1,
      [
        {
          id: "step-1",
          tacticId: "rfl",
          leanLine: "rfl",
          explanation: "Reflexivity closes trivial equalities",
          goalBefore: "x = x",
          goalAfter: "True",
        },
      ],
      true
    );
    expect(scriptDone).toContain("theorem identity_crisis");
    expect(scriptDone).toContain("  rfl");
    expect(scriptDone).toContain("Q.E.D.");
  });

  it("handles tactic error branches for intro, exact, apply, cases, left, right, symm, split, and norm_num", () => {
    const nonImp: ASTNode = { id: "1", type: "Variable", value: "P" };
    expect(tacticDefs.intro.execute(nonImp, nonImp, []).success).toBe(false);
    expect(
      tacticDefs.exact.execute(nonImp, nonImp, [], "missing").success
    ).toBe(false);
    expect(
      tacticDefs.apply.execute(nonImp, nonImp, [], "missing").success
    ).toBe(false);
    expect(
      tacticDefs.cases.execute(nonImp, nonImp, [], "missing").success
    ).toBe(false);
    expect(tacticDefs.left.execute(nonImp, nonImp, []).success).toBe(false);
    expect(tacticDefs.right.execute(nonImp, nonImp, []).success).toBe(false);
    expect(tacticDefs.symm.execute(nonImp, nonImp, []).success).toBe(false);
    expect(tacticDefs.split.execute(nonImp, nonImp, []).success).toBe(false);
    expect(tacticDefs.norm_num.execute(nonImp, nonImp, []).success).toBe(false);

    // sorry tactic
    const sorryRes = tacticDefs.sorry.execute(nonImp, nonImp, []);
    expect(sorryRes.success).toBe(true);
    expect(sorryRes.leanProofStep).toBe("sorry");
  });

  it("converts AST nodes to canonical polynomials and tests ring equivalence", () => {
    const const0: ASTNode = { id: "c0", type: "Constant", value: 0 };
    expect(astToPolynomial(const0)).toEqual({});

    const const5: ASTNode = { id: "c5", type: "Constant", value: 5 };
    expect(astToPolynomial(const5)).toEqual({ "": 5 });

    const negX: ASTNode = {
      id: "neg",
      type: "Operator",
      value: "-",
      children: [{ id: "x", type: "Variable", value: "x" }],
    };
    expect(astToPolynomial(negX)).toEqual({ x: -1 });

    const diff: ASTNode = {
      id: "diff",
      type: "Operator",
      value: "-",
      children: [
        { id: "x", type: "Variable", value: "x" },
        { id: "c2", type: "Constant", value: 2 },
      ],
    };
    expect(astToPolynomial(diff)).toEqual({ x: 1, "": -2 });

    const pow: ASTNode = {
      id: "pow",
      type: "Operator",
      value: "^",
      children: [
        { id: "x", type: "Variable", value: "x" },
        { id: "exp", type: "Constant", value: 2 },
      ],
    };
    expect(astToPolynomial(pow)).toEqual({ "x^2": 1 });

    expect(areRingEquivalent(const5, const5)).toBe(true);
    expect(areRingEquivalent(const5, const0)).toBe(false);
  });

  // =========================================================================
  // LIFO REVERSE LOOKUP RESOLUTION SUITE
  // =========================================================================

  describe("LIFO Reverse Lookup Resolution Suite", () => {
    it("prioritizes innermost / most recently introduced hypothesis when names collide (LIFO order)", () => {
      const outerHyp: ASTNode = {
        id: "hyp-outer-disj",
        type: "Disjunction",
        value: "∨",
        metadata: { name: "h_left" },
        children: [
          { id: "var-a", type: "Variable", value: "A" },
          { id: "var-b", type: "Variable", value: "B" },
        ],
      };

      const innerHyp: ASTNode = {
        id: "hyp-inner-val",
        type: "Variable",
        value: "A",
        metadata: { name: "h_left" },
      };

      const targetGoal: ASTNode = {
        id: "goal-a",
        type: "Variable",
        value: "A",
      };

      const hypotheses = [outerHyp, innerHyp];

      const result = tacticDefs.exact.execute(
        targetGoal,
        targetGoal,
        hypotheses,
        "h_left"
      );
      expect(result.success).toBe(true);
      expect(result.isProofComplete).toBe(true);
      expect(result.leanProofStep).toBe("exact h_left");
      expect(result.ramConsumed).toBe(1);
    });

    it("evaluates case-insensitive hypothesis names in LIFO reverse order", () => {
      const outerHyp: ASTNode = {
        id: "hyp-1",
        type: "Equality",
        value: "=",
        metadata: { name: "H_LEFT" },
        children: [
          { id: "v1", type: "Variable", value: "x" },
          { id: "c1", type: "Constant", value: 1 },
        ],
      };

      const innerHyp: ASTNode = {
        id: "hyp-2",
        type: "Equality",
        value: "=",
        metadata: { name: "h_left" },
        children: [
          { id: "v2", type: "Variable", value: "x" },
          { id: "c2", type: "Constant", value: 2 },
        ],
      };

      const targetNode: ASTNode = {
        id: "v-target",
        type: "Variable",
        value: "x",
      };
      const hypotheses = [outerHyp, innerHyp];

      const result = tacticDefs.rw.execute(
        targetNode,
        targetNode,
        hypotheses,
        "H_LEFT"
      );
      expect(result.success).toBe(true);
      expect(result.newAST?.value).toBe(2);
    });

    it("applies structural fallback in LIFO reverse order when no name argument is provided", () => {
      const outerHyp: ASTNode = {
        id: "hyp-imp-outer",
        type: "Implication",
        value: "→",
        metadata: { name: "h_imp_1" },
        children: [
          { id: "p1", type: "Variable", value: "P" },
          { id: "q1", type: "Variable", value: "Q" },
        ],
      };

      const innerHyp: ASTNode = {
        id: "hyp-imp-inner",
        type: "Implication",
        value: "→",
        metadata: { name: "h_imp_2" },
        children: [
          { id: "r2", type: "Variable", value: "R" },
          { id: "q2", type: "Variable", value: "Q" },
        ],
      };

      const targetGoal: ASTNode = {
        id: "q-target",
        type: "Variable",
        value: "Q",
      };
      const hypotheses = [outerHyp, innerHyp];

      const result = tacticDefs.apply.execute(
        targetGoal,
        targetGoal,
        hypotheses
      );
      expect(result.success).toBe(true);
      expect(result.newAST?.value).toBe("R");
      expect(result.leanProofStep).toBe("apply h_imp_2");
    });

    it("handles cases tactic LIFO lookup with duplicate disjunction hypothesis names", () => {
      const outerDisj: ASTNode = {
        id: "hyp-disj-outer",
        type: "Disjunction",
        value: "∨",
        metadata: { name: "h_or" },
        children: [
          { id: "d1", type: "Variable", value: "A" },
          { id: "d2", type: "Variable", value: "B" },
        ],
      };

      const innerDisj: ASTNode = {
        id: "hyp-disj-inner",
        type: "Disjunction",
        value: "∨",
        metadata: { name: "h_or" },
        children: [
          { id: "d3", type: "Variable", value: "X" },
          { id: "d4", type: "Variable", value: "Y" },
        ],
      };

      const globalAST: ASTNode = { id: "goal-z", type: "Variable", value: "Z" };
      const hypotheses = [outerDisj, innerDisj];

      const result = tacticDefs.cases.execute(
        globalAST,
        globalAST,
        hypotheses,
        "h_or"
      );
      expect(result.success).toBe(true);
      expect(result.newSubGoals?.length).toBe(2);
      expect(result.newSubGoals![0].label).toContain("Case 1: X");
      expect(result.newSubGoals![1].label).toContain("Case 2: Y");
    });
  });
});
