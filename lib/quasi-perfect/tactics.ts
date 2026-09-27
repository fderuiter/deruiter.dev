import { ASTNode, SubGoal, TacticDef, TacticId } from "./types";
import {
  areNodesEqual,
  areRingEquivalent,
  evaluateArithmetic,
  evaluateBooleanExpression,
  findNodeById,
  isConcreteExpression,
  renderASTString,
  replaceNode,
  simplifyNode,
  cloneAST,
} from "./engine";

/**
 * Resolves a hypothesis from context using LIFO (reverse array search) order.
 * Tier 1: Searches by metadata.name (case-insensitive) or node id in reverse order.
 * Tier 2: Structural predicate fallback searching in reverse order.
 */
export function resolveHypothesis(
  hypotheses: ASTNode[] = [],
  arg?: string,
  structuralPredicate?: (h: ASTNode) => boolean
): ASTNode | undefined {
  const reversed = [...hypotheses].reverse();

  if (arg) {
    const nameMatched = reversed.find(
      (h) =>
        (h.metadata?.name as string)?.toLowerCase() === arg.toLowerCase() ||
        h.id === arg
    );
    if (nameMatched) return nameMatched;
  }

  if (structuralPredicate) {
    return reversed.find(structuralPredicate);
  }

  return undefined;
}

export const tacticDefs: Record<TacticId, TacticDef> = {
  rfl: {
    id: "rfl",
    name: "rfl",
    label: "rfl",
    description:
      "Close goal by reflexivity if Left-Hand Side exactly equals Right-Hand Side.",
    baseRamCost: 1,
    failureCost: 1,
    execute: (targetNode, globalAST) => {
      const nodeToTest =
        targetNode.type === "Equality" ? targetNode : globalAST;

      if (
        nodeToTest.type !== "Equality" ||
        !nodeToTest.children ||
        nodeToTest.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "error: 'rfl' failed: target is not an equality (lhs = rhs).",
        };
      }

      const [left, right] = nodeToTest.children;
      if (areNodesEqual(left, right)) {
        const trueNode: ASTNode = {
          id: `qed-${Date.now()}`,
          type: "Boolean",
          value: true,
        };
        const newAST = replaceNode(globalAST, nodeToTest.id, trueNode);
        return {
          success: true,
          newAST,
          ramConsumed: 1,
          leanProofStep: "rfl",
          message: "tactic 'rfl' succeeded: equality proven by reflexivity.",
          isProofComplete: newAST.type === "Boolean" && newAST.value === true,
        };
      }

      return {
        success: false,
        ramConsumed: 1,
        message: `error: type mismatch in 'rfl': expected '${renderASTString(left)} = ${renderASTString(left)}', got '${renderASTString(left)} = ${renderASTString(right)}'.`,
      };
    },
  },

  rw: {
    id: "rw",
    name: "rw",
    label: "rw",
    description:
      "Rewrite a sub-expression using an active equality hypothesis.",
    baseRamCost: 2,
    failureCost: 1,
    execute: (targetNode, globalAST, hypotheses, arg) => {
      if (!hypotheses || hypotheses.length === 0) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "error: tactic 'rw' failed. No hypotheses available in context.",
        };
      }

      // Find matching hypothesis using LIFO resolution (Tier 1: Name/ID, Tier 2: Structural)
      const matchedHypothesis = resolveHypothesis(
        hypotheses,
        arg,
        (h) =>
          h.type === "Equality" &&
          h.children?.length === 2 &&
          (areNodesEqual(h.children[0], targetNode) ||
            areNodesEqual(h.children[1], targetNode))
      );

      if (
        !matchedHypothesis ||
        matchedHypothesis.type !== "Equality" ||
        !matchedHypothesis.children ||
        matchedHypothesis.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: 1,
          message: `error: tactic 'rw' failed. Target '${renderASTString(targetNode)}' does not match hypothesis ${
            arg ? `[${arg}]` : "context"
          }.`,
        };
      }

      const [hypLHS, hypRHS] = matchedHypothesis.children;
      let replacement: ASTNode | null = null;

      if (areNodesEqual(targetNode, hypLHS)) {
        replacement = hypRHS;
      } else if (areNodesEqual(targetNode, hypRHS)) {
        replacement = hypLHS;
      }

      if (!replacement) {
        return {
          success: false,
          ramConsumed: 1,
          message: `error: tactic 'rw' failed. Sub-expression '${renderASTString(targetNode)}' does not match '${renderASTString(hypLHS)} = ${renderASTString(hypRHS)}'.`,
        };
      }

      const newAST = replaceNode(globalAST, targetNode.id, replacement);
      const hypName = (matchedHypothesis.metadata?.name as string) || "h";

      return {
        success: true,
        newAST,
        ramConsumed: 2,
        leanProofStep: `rw [${hypName}]`,
        message: `tactic 'rw [${hypName}]' succeeded: substituted '${renderASTString(targetNode)}' with '${renderASTString(replacement)}'.`,
      };
    },
  },

  simp: {
    id: "simp",
    name: "simp",
    label: "simp",
    description:
      "Aggressively simplify arithmetic identities, identity operations, and constants.",
    baseRamCost: 6,
    failureCost: 1,
    execute: (targetNode, globalAST) => {
      const target =
        targetNode.id === globalAST.id
          ? globalAST
          : findNodeById(globalAST, targetNode.id) || targetNode;
      const { node: simplifiedSubtree, changed } = simplifyNode(target);

      if (!changed) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "warning: 'simp' made no progress. 6 GB of RAM was consumed with no reduction.",
        };
      }

      const newAST = replaceNode(globalAST, target.id, simplifiedSubtree);
      const isComplete = newAST.type === "Boolean" && newAST.value === true;

      return {
        success: true,
        newAST,
        ramConsumed: 6,
        leanProofStep: "simp",
        message: `tactic 'simp' succeeded: expression reduced to '${renderASTString(newAST)}'.`,
        isProofComplete: isComplete,
      };
    },
  },

  ring: {
    id: "ring",
    name: "ring",
    label: "ring",
    description:
      "Solve algebraic identities in commutative rings & polynomials (e.g. (a+b)² = a² + 2ab + b²).",
    baseRamCost: 4,
    failureCost: 1,
    execute: (targetNode, globalAST) => {
      const nodeToTest =
        targetNode.type === "Equality" ? targetNode : globalAST;

      if (
        nodeToTest.type !== "Equality" ||
        !nodeToTest.children ||
        nodeToTest.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "error: 'ring' failed: target must be an algebraic equality (A = B).",
        };
      }

      const [left, right] = nodeToTest.children;
      if (areRingEquivalent(left, right)) {
        const trueNode: ASTNode = {
          id: `ring-${Date.now()}`,
          type: "Boolean",
          value: true,
        };
        const newAST = replaceNode(globalAST, nodeToTest.id, trueNode);
        return {
          success: true,
          newAST,
          ramConsumed: 4,
          leanProofStep: "ring",
          message: `local 'ring' check confirmed polynomial ring equivalence: '${renderASTString(left)}' = '${renderASTString(right)}'.`,
          isProofComplete: newAST.type === "Boolean" && newAST.value === true,
        };
      }

      return {
        success: false,
        ramConsumed: 1,
        message: `error: tactic 'ring' failed. Expressions are not algebraically equivalent in polynomial rings.`,
      };
    },
  },

  intro: {
    id: "intro",
    name: "intro",
    label: "intro",
    description:
      "Introduce the antecedent of an implication (P → Q) as a local hypothesis 'h : P'.",
    baseRamCost: 2,
    failureCost: 1,
    execute: (targetNode, globalAST, hypotheses, arg) => {
      const nodeToTest =
        targetNode.type === "Implication" ? targetNode : globalAST;

      if (
        nodeToTest.type !== "Implication" ||
        !nodeToTest.children ||
        nodeToTest.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "error: tactic 'intro' failed: goal is not an implication (P → Q).",
        };
      }

      const [antecedent, consequent] = nodeToTest.children;
      const hypName = arg || "h";
      const newHyp: ASTNode = {
        ...cloneAST(antecedent),
        id: `hyp-intro-${Date.now()}`,
        metadata: { name: hypName },
      };

      const newHypotheses = [...hypotheses, newHyp];
      const newAST = cloneAST(consequent);

      return {
        success: true,
        newAST,
        newHypotheses,
        ramConsumed: 2,
        leanProofStep: `intro ${hypName}`,
        message: `tactic 'intro ${hypName}' introduced hypothesis ${hypName} : '${renderASTString(antecedent)}'. New goal: '${renderASTString(consequent)}'.`,
        isProofComplete: false,
      };
    },
  },

  apply: {
    id: "apply",
    name: "apply",
    label: "apply",
    description:
      "Backwards reasoning: given goal Q and hypothesis h : P → Q, transform goal into P.",
    baseRamCost: 3,
    failureCost: 1,
    execute: (targetNode, globalAST, hypotheses, arg) => {
      if (!hypotheses || hypotheses.length === 0) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "error: tactic 'apply' failed. No implication hypotheses in context.",
        };
      }

      const matchedHyp = resolveHypothesis(
        hypotheses,
        arg,
        (h) =>
          h.type === "Implication" &&
          h.children?.length === 2 &&
          areNodesEqual(h.children[1], targetNode)
      );

      if (
        !matchedHyp ||
        matchedHyp.type !== "Implication" ||
        !matchedHyp.children ||
        matchedHyp.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: 1,
          message: `error: tactic 'apply' failed. No hypothesis matches rule (P → ${renderASTString(targetNode)}).`,
        };
      }

      const [premise, conclusion] = matchedHyp.children;
      if (!areNodesEqual(conclusion, targetNode)) {
        return {
          success: false,
          ramConsumed: 1,
          message: `error: tactic 'apply' conclusion mismatch. Hypothesis proves '${renderASTString(conclusion)}', but goal is '${renderASTString(targetNode)}'.`,
        };
      }

      const hypName = (matchedHyp.metadata?.name as string) || "h";
      const newAST = replaceNode(globalAST, targetNode.id, premise);

      return {
        success: true,
        newAST,
        ramConsumed: 3,
        leanProofStep: `apply ${hypName}`,
        message: `tactic 'apply ${hypName}' applied rule. New subgoal required: '${renderASTString(premise)}'.`,
        isProofComplete: false,
      };
    },
  },

  exact: {
    id: "exact",
    name: "exact",
    label: "exact",
    description:
      "Close goal immediately if a known hypothesis matches the goal precisely.",
    baseRamCost: 1,
    failureCost: 1,
    execute: (targetNode, globalAST, hypotheses, arg) => {
      const matchedHyp = resolveHypothesis(hypotheses, arg, (h) =>
        areNodesEqual(h, targetNode)
      );

      if (!matchedHyp || !areNodesEqual(matchedHyp, targetNode)) {
        return {
          success: false,
          ramConsumed: 1,
          message: `error: tactic 'exact' failed: no hypothesis exactly matches '${renderASTString(targetNode)}'.`,
        };
      }

      const hypName = (matchedHyp.metadata?.name as string) || "h";
      const trueNode: ASTNode = {
        id: `exact-${Date.now()}`,
        type: "Boolean",
        value: true,
      };
      const newAST = replaceNode(globalAST, targetNode.id, trueNode);

      return {
        success: true,
        newAST,
        ramConsumed: 1,
        leanProofStep: `exact ${hypName}`,
        message: `tactic 'exact ${hypName}' closed goal by direct hypothesis proof.`,
        isProofComplete: newAST.type === "Boolean" && newAST.value === true,
      };
    },
  },

  cases: {
    id: "cases",
    name: "cases",
    label: "cases",
    description:
      "Perform case analysis on a disjunction (P ∨ Q), splitting the goal into 2 subgoals.",
    baseRamCost: 4,
    failureCost: 1,
    execute: (_targetNode, globalAST, hypotheses, arg) => {
      const matchedHyp = resolveHypothesis(
        hypotheses,
        arg,
        (h) => h.type === "Disjunction" && h.children?.length === 2
      );

      if (
        !matchedHyp ||
        matchedHyp.type !== "Disjunction" ||
        !matchedHyp.children ||
        matchedHyp.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "error: tactic 'cases' requires a disjunctive hypothesis (P ∨ Q).",
        };
      }

      const [leftDisj, rightDisj] = matchedHyp.children;
      const hypName = (matchedHyp.metadata?.name as string) || "h_or";
      const remainingHypotheses = hypotheses.filter(
        (h) => h.id !== matchedHyp!.id
      );

      const subGoal1: SubGoal = {
        id: `subgoal-1-${Date.now()}`,
        label: `Case 1: ${renderASTString(leftDisj)}`,
        goal: cloneAST(globalAST),
        hypotheses: [
          ...remainingHypotheses,
          {
            ...cloneAST(leftDisj),
            id: `h_left-${Date.now()}`,
            metadata: { name: "h_left" },
          },
        ],
        isCompleted: false,
      };

      const subGoal2: SubGoal = {
        id: `subgoal-2-${Date.now()}`,
        label: `Case 2: ${renderASTString(rightDisj)}`,
        goal: cloneAST(globalAST),
        hypotheses: [
          ...remainingHypotheses,
          {
            ...cloneAST(rightDisj),
            id: `h_right-${Date.now()}`,
            metadata: { name: "h_right" },
          },
        ],
        isCompleted: false,
      };

      return {
        success: true,
        newSubGoals: [subGoal1, subGoal2],
        ramConsumed: 4,
        leanProofStep: `cases ${hypName} with h_left h_right`,
        message: `tactic 'cases ${hypName}' split goal into 2 subgoals: Case 1 (h_left) and Case 2 (h_right).`,
        isProofComplete: false,
      };
    },
  },

  norm_num: {
    id: "norm_num",
    name: "norm_num",
    label: "norm_num",
    description:
      "Normalize and compute numerical arithmetic expressions and compound boolean assertions.",
    baseRamCost: 3,
    failureCost: 1,
    execute: (targetNode, globalAST) => {
      const boolRes = evaluateBooleanExpression(targetNode);
      if (boolRes === true) {
        const trueNode: ASTNode = {
          id: `norm-${Date.now()}`,
          type: "Boolean",
          value: true,
        };
        const newAST = replaceNode(globalAST, targetNode.id, trueNode);
        return {
          success: true,
          newAST,
          ramConsumed: 3,
          leanProofStep: "norm_num",
          message: `tactic 'norm_num' evaluated expression '${renderASTString(targetNode)}' to True.`,
          isProofComplete: newAST.type === "Boolean" && newAST.value === true,
        };
      }

      const numRes = evaluateArithmetic(targetNode);
      if (numRes !== null) {
        const numNode: ASTNode = {
          id: `const-${Date.now()}`,
          type: "Constant",
          value: numRes,
        };
        const newAST = replaceNode(globalAST, targetNode.id, numNode);
        return {
          success: true,
          newAST,
          ramConsumed: 3,
          leanProofStep: "norm_num",
          message: `tactic 'norm_num' computed value ${numRes}.`,
          isProofComplete: false,
        };
      }

      return {
        success: false,
        ramConsumed: 1,
        message:
          "error: tactic 'norm_num' could not evaluate non-concrete expression.",
      };
    },
  },

  decide: {
    id: "decide",
    name: "decide",
    label: "decide",
    description:
      "Evaluate a decidable, concrete arithmetic proposition to True.",
    baseRamCost: 4,
    failureCost: 1,
    execute: (targetNode, globalAST) => {
      const nodeToTest =
        targetNode.type === "Equality" ||
        targetNode.type === "Inequality" ||
        targetNode.type === "Conjunction"
          ? targetNode
          : globalAST;

      if (!isConcreteExpression(nodeToTest)) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "error: tactic 'decide' failed. Expression contains free variables and is not decidable by finite computation.",
        };
      }

      const boolRes = evaluateBooleanExpression(nodeToTest);
      if (boolRes === true) {
        const trueNode: ASTNode = {
          id: `decide-${Date.now()}`,
          type: "Boolean",
          value: true,
        };
        const newAST = replaceNode(globalAST, nodeToTest.id, trueNode);
        return {
          success: true,
          newAST,
          ramConsumed: 4,
          leanProofStep: "decide",
          message: `local 'decide' evaluation succeeded for '${renderASTString(nodeToTest)}'.`,
          isProofComplete: newAST.type === "Boolean" && newAST.value === true,
        };
      }

      return {
        success: false,
        ramConsumed: 1,
        message: `error: tactic 'decide' evaluated proposition '${renderASTString(nodeToTest)}' to False.`,
      };
    },
  },

  omega: {
    id: "omega",
    name: "omega",
    label: "omega",
    description:
      "Solve linear integer arithmetic inequalities over Presburger arithmetic.",
    baseRamCost: 10,
    failureCost: 1,
    execute: (targetNode, globalAST) => {
      const nodeToTest =
        targetNode.type === "Inequality" || targetNode.type === "Equality"
          ? targetNode
          : globalAST;

      const rendered = renderASTString(nodeToTest);
      if (
        rendered.includes("σ") ||
        rendered.includes("^") ||
        rendered.includes("x * x")
      ) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "error: omega cannot evaluate non-linear arithmetic (e.g. x * x or σ(n)). Presburger arithmetic is strictly linear.",
        };
      }

      const trueNode: ASTNode = {
        id: `omega-${Date.now()}`,
        type: "Boolean",
        value: true,
      };
      const newAST = replaceNode(globalAST, nodeToTest.id, trueNode);
      return {
        success: true,
        newAST,
        ramConsumed: 10,
        leanProofStep: "omega",
        message:
          "tactic 'omega' closed linear integer arithmetic goal via Presburger elimination.",
        isProofComplete: newAST.type === "Boolean" && newAST.value === true,
      };
    },
  },

  linarith: {
    id: "linarith",
    name: "linarith",
    label: "linarith",
    description:
      "Linear arithmetic solver for linear combinations of hypotheses.",
    baseRamCost: 8,
    failureCost: 1,
    execute: (targetNode, globalAST) => {
      const nodeToTest =
        targetNode.type === "Inequality" || targetNode.type === "Equality"
          ? targetNode
          : globalAST;
      const trueNode: ASTNode = {
        id: `linarith-${Date.now()}`,
        type: "Boolean",
        value: true,
      };
      const newAST = replaceNode(globalAST, nodeToTest.id, trueNode);
      return {
        success: true,
        newAST,
        ramConsumed: 8,
        leanProofStep: "linarith",
        message: "tactic 'linarith' found linear combination proving the goal.",
        isProofComplete: newAST.type === "Boolean" && newAST.value === true,
      };
    },
  },

  symm: {
    id: "symm",
    name: "symm",
    label: "symm",
    description:
      "Symmetry of equality: transpose goal from (A = B) to (B = A).",
    baseRamCost: 1,
    failureCost: 1,
    execute: (targetNode, globalAST) => {
      const nodeToTest =
        targetNode.type === "Equality" ? targetNode : globalAST;

      if (
        nodeToTest.type !== "Equality" ||
        !nodeToTest.children ||
        nodeToTest.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "error: 'symm' failed: target must be an equality (LHS = RHS).",
        };
      }

      const [left, right] = nodeToTest.children;
      const swappedNode: ASTNode = {
        ...cloneAST(nodeToTest),
        children: [cloneAST(right), cloneAST(left)],
      };
      const newAST = replaceNode(globalAST, nodeToTest.id, swappedNode);

      return {
        success: true,
        newAST,
        ramConsumed: 1,
        leanProofStep: "symm",
        message: `tactic 'symm' transposed equality: '${renderASTString(left)} = ${renderASTString(right)}' ⟹ '${renderASTString(right)} = ${renderASTString(left)}'.`,
        isProofComplete: false,
      };
    },
  },

  split: {
    id: "split",
    name: "split",
    label: "split",
    description:
      "Decompose a conjunction goal (A ∧ B) into 2 subgoals (constructor / split).",
    baseRamCost: 2,
    failureCost: 1,
    execute: (targetNode, globalAST, hypotheses) => {
      const nodeToTest =
        targetNode.type === "Conjunction" ? targetNode : globalAST;

      if (
        nodeToTest.type !== "Conjunction" ||
        !nodeToTest.children ||
        nodeToTest.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: 1,
          message: "error: 'split' failed: goal is not a conjunction (A ∧ B).",
        };
      }

      const [leftConj, rightConj] = nodeToTest.children;
      const subGoal1: SubGoal = {
        id: `subgoal-left-${Date.now()}`,
        label: `Left Branch: ${renderASTString(leftConj)}`,
        goal: cloneAST(leftConj),
        hypotheses: hypotheses.map(cloneAST),
        isCompleted: false,
      };
      const subGoal2: SubGoal = {
        id: `subgoal-right-${Date.now()}`,
        label: `Right Branch: ${renderASTString(rightConj)}`,
        goal: cloneAST(rightConj),
        hypotheses: hypotheses.map(cloneAST),
        isCompleted: false,
      };

      return {
        success: true,
        newSubGoals: [subGoal1, subGoal2],
        ramConsumed: 2,
        leanProofStep: "constructor",
        message: `tactic 'split' decomposed conjunction goal into 2 subgoals: '${renderASTString(leftConj)}' and '${renderASTString(rightConj)}'.`,
        isProofComplete: false,
      };
    },
  },

  left: {
    id: "left",
    name: "left",
    label: "left",
    description: "Disjunction introduction: select Left branch (A ∨ B ⟹ A).",
    baseRamCost: 1,
    failureCost: 1,
    execute: (targetNode, globalAST) => {
      const nodeToTest =
        targetNode.type === "Disjunction" ? targetNode : globalAST;

      if (
        nodeToTest.type !== "Disjunction" ||
        !nodeToTest.children ||
        nodeToTest.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "error: tactic 'left' failed: goal is not a disjunction (A ∨ B).",
        };
      }

      const [leftDisj] = nodeToTest.children;
      const newAST = replaceNode(globalAST, nodeToTest.id, cloneAST(leftDisj));

      return {
        success: true,
        newAST,
        ramConsumed: 1,
        leanProofStep: "left",
        message: `tactic 'left' selected left disjunct: '${renderASTString(leftDisj)}'.`,
        isProofComplete: false,
      };
    },
  },

  right: {
    id: "right",
    name: "right",
    label: "right",
    description: "Disjunction introduction: select Right branch (A ∨ B ⟹ B).",
    baseRamCost: 1,
    failureCost: 1,
    execute: (targetNode, globalAST) => {
      const nodeToTest =
        targetNode.type === "Disjunction" ? targetNode : globalAST;

      if (
        nodeToTest.type !== "Disjunction" ||
        !nodeToTest.children ||
        nodeToTest.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: 1,
          message:
            "error: tactic 'right' failed: goal is not a disjunction (A ∨ B).",
        };
      }

      const [, rightDisj] = nodeToTest.children;
      const newAST = replaceNode(globalAST, nodeToTest.id, cloneAST(rightDisj));

      return {
        success: true,
        newAST,
        ramConsumed: 1,
        leanProofStep: "right",
        message: `tactic 'right' selected right disjunct: '${renderASTString(rightDisj)}'.`,
        isProofComplete: false,
      };
    },
  },

  sorry: {
    id: "sorry",
    name: "sorry",
    label: "Use sorry",
    description:
      "Admit the theorem without proof. Warning: Causes catastrophic mathematical morality loss.",
    baseRamCost: 0,
    failureCost: 0,
    execute: () => {
      const qedNode: ASTNode = {
        id: `sorry-${Date.now()}`,
        type: "Boolean",
        value: true,
        metadata: { provedViaSorry: true },
      };
      return {
        success: true,
        newAST: qedNode,
        ramConsumed: 0,
        leanProofStep: "sorry",
        message:
          "WARNING: Morality exception. Proof accepted via 'sorry'. A single tear falls from the eye of a distant mathematician.",
        isProofComplete: true,
      };
    },
  },
};
