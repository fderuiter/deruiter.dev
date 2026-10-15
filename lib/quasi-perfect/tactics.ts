import { ASTNode, SubGoal, TacticDef, TacticId } from "./types";
import {
  areNodesEqual,
  areRingEquivalent,
  evaluateArithmetic,
  evaluateBooleanExpression,
  findNodeById,
  isConcreteExpression,
  isProofComplete,
  renderASTString,
  replaceNode,
  simplifyNode,
  cloneAST,
  freshCopy,
  instantiatePattern,
  isQuantifier,
  matchPattern,
  occursFree,
  stripForalls,
  substituteVariable,
} from "./engine";
import { parseFormulaWithError } from "./compiler";

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
          ramConsumed: tacticDefs.rfl.failureCost,
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
          ramConsumed: tacticDefs.rfl.baseRamCost,
          leanProofStep: "rfl",
          message: "tactic 'rfl' succeeded: equality proven by reflexivity.",
          isProofComplete: newAST.type === "Boolean" && newAST.value === true,
        };
      }

      return {
        success: false,
        ramConsumed: tacticDefs.rfl.failureCost,
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
          ramConsumed: tacticDefs.rw.failureCost,
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

      if (matchedHypothesis?.type === "Forall") {
        return rewriteWithLemma(targetNode, globalAST, matchedHypothesis);
      }

      if (
        !matchedHypothesis ||
        matchedHypothesis.type !== "Equality" ||
        !matchedHypothesis.children ||
        matchedHypothesis.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: tacticDefs.rw.failureCost,
          message: `error: tactic 'rw' failed. You selected '${renderASTString(targetNode)}', which matches no side of hypothesis ${
            arg ? `[${arg}]` : "in context"
          }. Select a sub-term equal to one side of the equality and apply rw again (a wrong target costs ${tacticDefs.rw.failureCost} GB).`,
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
          ramConsumed: tacticDefs.rw.failureCost,
          message: `error: tactic 'rw' failed. You selected '${renderASTString(targetNode)}', but rw [${
            (matchedHypothesis.metadata?.name as string) || "h"
          }] rewrites a selected sub-term equal to '${renderASTString(hypLHS)}' or '${renderASTString(hypRHS)}', not a whole larger expression. Tap one of those sub-terms inside the goal and apply rw again (a wrong target costs ${tacticDefs.rw.failureCost} GB).`,
        };
      }

      const newAST = replaceNode(globalAST, targetNode.id, replacement);
      const hypName = (matchedHypothesis.metadata?.name as string) || "h";

      return {
        success: true,
        newAST,
        ramConsumed: tacticDefs.rw.baseRamCost,
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
          ramConsumed: tacticDefs.simp.failureCost,
          message: `warning: 'simp' made no progress. ${tacticDefs.simp.failureCost} GB of RAM was consumed with no reduction.`,
        };
      }

      const newAST = replaceNode(globalAST, target.id, simplifiedSubtree);
      const isComplete = newAST.type === "Boolean" && newAST.value === true;

      return {
        success: true,
        newAST,
        ramConsumed: tacticDefs.simp.baseRamCost,
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
          ramConsumed: tacticDefs.ring.failureCost,
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
          ramConsumed: tacticDefs.ring.baseRamCost,
          leanProofStep: "ring",
          message: `local 'ring' check confirmed polynomial ring equivalence: '${renderASTString(left)}' = '${renderASTString(right)}'.`,
          isProofComplete: newAST.type === "Boolean" && newAST.value === true,
        };
      }

      return {
        success: false,
        ramConsumed: tacticDefs.ring.failureCost,
        message: `error: tactic 'ring' failed. Expressions are not algebraically equivalent in polynomial rings.`,
      };
    },
  },

  intro: {
    id: "intro",
    name: "intro",
    label: "intro",
    description:
      "Introduce the antecedent of an implication (P → Q) as a local hypothesis 'h : P', or fix the variable of a ∀ goal.",
    baseRamCost: 2,
    failureCost: 1,
    execute: (targetNode, globalAST, hypotheses, arg) => {
      // ∀ introduction (#2091): fix an arbitrary n and prove the body for it.
      if (globalAST.type === "Forall" && globalAST.children?.length === 1) {
        const name = String(globalAST.value);
        const body = cloneAST(globalAST.children[0]);
        return {
          success: true,
          newAST: body,
          newHypotheses: hypotheses,
          ramConsumed: tacticDefs.intro.baseRamCost,
          leanProofStep: `intro ${name}`,
          message: `tactic 'intro ${name}' fixed an arbitrary ${name}. New goal: '${renderASTString(body)}'.`,
          isProofComplete: false,
        };
      }

      const nodeToTest =
        targetNode.type === "Implication" ? targetNode : globalAST;

      if (
        nodeToTest.type !== "Implication" ||
        !nodeToTest.children ||
        nodeToTest.children.length !== 2
      ) {
        return {
          success: false,
          ramConsumed: tacticDefs.intro.failureCost,
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
        ramConsumed: tacticDefs.intro.baseRamCost,
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
          ramConsumed: tacticDefs.apply.failureCost,
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
          ramConsumed: tacticDefs.apply.failureCost,
          message: `error: tactic 'apply' failed. No hypothesis matches rule (P → ${renderASTString(targetNode)}).`,
        };
      }

      const [premise, conclusion] = matchedHyp.children;
      if (!areNodesEqual(conclusion, targetNode)) {
        return {
          success: false,
          ramConsumed: tacticDefs.apply.failureCost,
          message: `error: tactic 'apply' conclusion mismatch. Hypothesis proves '${renderASTString(conclusion)}', but goal is '${renderASTString(targetNode)}'.`,
        };
      }

      const hypName = (matchedHyp.metadata?.name as string) || "h";
      const newAST = replaceNode(globalAST, targetNode.id, premise);

      return {
        success: true,
        newAST,
        ramConsumed: tacticDefs.apply.baseRamCost,
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

      if (matchedHyp?.type === "Forall") {
        return exactWithLemma(targetNode, globalAST, matchedHyp);
      }

      if (!matchedHyp || !areNodesEqual(matchedHyp, targetNode)) {
        return {
          success: false,
          ramConsumed: tacticDefs.exact.failureCost,
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
        ramConsumed: tacticDefs.exact.baseRamCost,
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
          ramConsumed: tacticDefs.cases.failureCost,
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
        ramConsumed: tacticDefs.cases.baseRamCost,
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
          ramConsumed: tacticDefs.norm_num.baseRamCost,
          leanProofStep: "norm_num",
          message: `tactic 'norm_num' evaluated expression '${renderASTString(targetNode)}' to True.`,
          isProofComplete: newAST.type === "Boolean" && newAST.value === true,
        };
      }

      // A concrete claim that is false (`4 + 4 = 7` after the wrong witness)
      // is not "non-concrete": say it is false, so the player knows to undo
      // and pick another route (#2199).
      if (boolRes === false) {
        return {
          success: false,
          ramConsumed: tacticDefs.norm_num.failureCost,
          message: `error: tactic 'norm_num' reduced '${renderASTString(targetNode)}' to False. This goal is not provable; undo and choose another route.`,
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
          ramConsumed: tacticDefs.norm_num.baseRamCost,
          leanProofStep: "norm_num",
          message: `tactic 'norm_num' computed value ${numRes}.`,
          isProofComplete: false,
        };
      }

      return {
        success: false,
        ramConsumed: tacticDefs.norm_num.failureCost,
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
          ramConsumed: tacticDefs.decide.failureCost,
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
          ramConsumed: tacticDefs.decide.baseRamCost,
          leanProofStep: "decide",
          message: `local 'decide' evaluation succeeded for '${renderASTString(nodeToTest)}'.`,
          isProofComplete: newAST.type === "Boolean" && newAST.value === true,
        };
      }

      return {
        success: false,
        ramConsumed: tacticDefs.decide.failureCost,
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
          ramConsumed: tacticDefs.omega.failureCost,
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
        ramConsumed: tacticDefs.omega.baseRamCost,
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
        ramConsumed: tacticDefs.linarith.baseRamCost,
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
          ramConsumed: tacticDefs.symm.failureCost,
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
        ramConsumed: tacticDefs.symm.baseRamCost,
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
          ramConsumed: tacticDefs.split.failureCost,
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
        ramConsumed: tacticDefs.split.baseRamCost,
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
          ramConsumed: tacticDefs.left.failureCost,
          message:
            "error: tactic 'left' failed: goal is not a disjunction (A ∨ B).",
        };
      }

      const [leftDisj] = nodeToTest.children;
      const newAST = replaceNode(globalAST, nodeToTest.id, cloneAST(leftDisj));

      return {
        success: true,
        newAST,
        ramConsumed: tacticDefs.left.baseRamCost,
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
          ramConsumed: tacticDefs.right.failureCost,
          message:
            "error: tactic 'right' failed: goal is not a disjunction (A ∨ B).",
        };
      }

      const [, rightDisj] = nodeToTest.children;
      const newAST = replaceNode(globalAST, nodeToTest.id, cloneAST(rightDisj));

      return {
        success: true,
        newAST,
        ramConsumed: tacticDefs.right.baseRamCost,
        leanProofStep: "right",
        message: `tactic 'right' selected right disjunct: '${renderASTString(rightDisj)}'.`,
        isProofComplete: false,
      };
    },
  },

  use: {
    id: "use",
    name: "use",
    label: "use",
    description:
      "Existential introduction: name a witness w for a goal ∃ x, P x, leaving P w to prove.",
    baseRamCost: 2,
    failureCost: 1,
    execute: (_targetNode, globalAST, _hypotheses, arg) => {
      if (globalAST.type !== "Exists" || globalAST.children?.length !== 1) {
        return {
          success: false,
          ramConsumed: tacticDefs.use.failureCost,
          message:
            "error: tactic 'use' failed: the goal is not an existential (∃ x, P x).",
        };
      }
      const parsed = arg ? parseFormulaWithError(arg, "witness") : null;
      if (!parsed?.ast) {
        return {
          success: false,
          ramConsumed: tacticDefs.use.failureCost,
          message:
            "error: tactic 'use' needs a witness, such as 'use 3'. Play a card that names one.",
        };
      }
      const name = String(globalAST.value);
      const witness = parsed.ast;
      const newAST = substituteVariable(globalAST.children[0], name, witness);
      const closed = isProofComplete(newAST);
      const shown = renderASTString(witness);
      return {
        success: true,
        newAST: closed
          ? { id: `use-${Date.now()}`, type: "Boolean", value: true }
          : newAST,
        ramConsumed: tacticDefs.use.baseRamCost,
        leanProofStep: `use ${shown}`,
        message: closed
          ? `tactic 'use ${shown}' chose ${name} := ${shown}; '${renderASTString(newAST)}' holds by rfl.`
          : `tactic 'use ${shown}' chose ${name} := ${shown}. New goal: '${renderASTString(newAST)}'.`,
        isProofComplete: closed,
      };
    },
  },

  induction: {
    id: "induction",
    name: "induction",
    label: "induction",
    description:
      "Induction over ℕ: split a goal ∀ n, P n into a base case P 0 and a step case P (k + 1) with hypothesis ih : P k.",
    baseRamCost: 5,
    failureCost: 1,
    execute: (_targetNode, globalAST, hypotheses, arg) => {
      let variable: string | null = null;
      let motive: ASTNode = globalAST;
      let intro = "";
      if (globalAST.type === "Forall" && globalAST.children?.length === 1) {
        variable = String(globalAST.value);
        motive = globalAST.children[0];
        intro = `intro ${variable}; `;
      } else if (arg && occursFree(globalAST, arg)) {
        variable = arg;
      }
      if (!variable) {
        return {
          success: false,
          ramConsumed: tacticDefs.induction.failureCost,
          message:
            "error: tactic 'induction' needs a goal of the form ∀ n, P n (or a named natural-number variable in the goal).",
        };
      }
      const taken = (name: string) =>
        occursFree(motive, name) || hypotheses.some((h) => occursFree(h, name));
      const step =
        ["k", "m", "j", "i"].find(
          (name) => name !== variable && !taken(name)
        ) ?? `${variable}'`;
      const zero: ASTNode = { id: "ind-zero", type: "Constant", value: 0 };
      const stepVar: ASTNode = { id: "ind-k", type: "Variable", value: step };
      const succ: ASTNode = {
        id: "ind-succ",
        type: "Operator",
        value: "+",
        children: [stepVar, { id: "ind-one", type: "Constant", value: 1 }],
      };
      const baseGoal = substituteVariable(
        freshCopy(motive, "base"),
        variable,
        zero
      );
      const stepGoal = substituteVariable(
        freshCopy(motive, "step"),
        variable,
        succ
      );
      const ih: ASTNode = {
        ...substituteVariable(freshCopy(motive, "ih"), variable, stepVar),
        metadata: { name: "ih" },
      };
      const stamp = Date.now();
      const others = hypotheses.map(cloneAST);
      const subGoals: SubGoal[] = [
        {
          id: `subgoal-base-${stamp}`,
          label: `Base case: ${renderASTString(baseGoal)}`,
          goal: baseGoal,
          hypotheses: others,
          isCompleted: isProofComplete(baseGoal),
        },
        {
          id: `subgoal-step-${stamp}`,
          label: `Step case: ${renderASTString(stepGoal)}`,
          goal: stepGoal,
          hypotheses: [...others, ih],
          isCompleted: isProofComplete(stepGoal),
        },
      ];
      return {
        success: true,
        newSubGoals: subGoals,
        ramConsumed: tacticDefs.induction.baseRamCost,
        leanProofStep: `${intro}induction' ${variable} with ${step} ih`,
        message: `tactic 'induction ${variable}' split the goal: base case '${renderASTString(baseGoal)}', and step case '${renderASTString(stepGoal)}' with ih : '${renderASTString(ih)}'.`,
        isProofComplete: false,
      };
    },
  },

  trans: {
    id: "trans",
    name: "trans",
    label: "trans",
    description:
      "Chain ≤ by transitivity: with h : a ≤ b, the goal a ≤ c becomes b ≤ c; with h : b ≤ c, the goal a ≤ c becomes a ≤ b.",
    baseRamCost: 2,
    failureCost: 1,
    execute: (_targetNode, globalAST, hypotheses, arg) => {
      if (!isLessEqual(globalAST)) {
        return {
          success: false,
          ramConsumed: tacticDefs.trans.failureCost,
          message:
            "error: tactic 'trans' failed: the goal is not a ≤ chain (a ≤ c).",
        };
      }
      const [goalLeft, goalRight] = globalAST.children!;
      const attempt = (h: ASTNode) => chainStep(h, goalLeft, goalRight);
      const matched = resolveHypothesis(
        hypotheses,
        arg,
        (h) => attempt(h) !== null
      );
      const step = matched ? attempt(matched) : null;
      if (!matched || !step) {
        return {
          success: false,
          ramConsumed: tacticDefs.trans.failureCost,
          message: `error: tactic 'trans' failed: no ≤ hypothesis ${arg ? `[${arg}] ` : ""}shares an end with '${renderASTString(globalAST)}'. The hypothesis must start where the goal starts, or end where it ends.`,
        };
      }
      const hypName = (matched.metadata?.name as string) || "h";
      const proof = step.args.length
        ? `(${hypName} ${step.args.map(renderLeanArg).join(" ")})`
        : hypName;
      const newAST: ASTNode = {
        id: `trans-${Date.now()}`,
        type: "Inequality",
        value: "≤",
        children: step.remaining,
      };
      const closed = isProofComplete(newAST);
      return {
        success: true,
        newAST,
        ramConsumed: tacticDefs.trans.baseRamCost,
        leanProofStep:
          step.side === "left"
            ? `apply le_trans ${proof}`
            : `refine le_trans ?_ ${proof}`,
        message: `tactic 'trans' chained through ${hypName} : '${renderASTString(step.used)}'. New goal: '${renderASTString(newAST)}'${closed ? ", which holds by reflexivity" : ""}.`,
        isProofComplete: closed,
      };
    },
  },

  gcongr: {
    id: "gcongr",
    name: "gcongr",
    label: "gcongr",
    description:
      "Monotonicity over ℕ: when both sides of a ≤ goal differ in one place, as in 2 * a ≤ 2 * b, reduce it to a ≤ b. Closes the result if a hypothesis states it.",
    baseRamCost: 3,
    failureCost: 1,
    execute: (_targetNode, globalAST, hypotheses) => {
      if (!isLessEqual(globalAST)) {
        return {
          success: false,
          ramConsumed: tacticDefs.gcongr.failureCost,
          message:
            "error: tactic 'gcongr' failed: the goal is not a ≤ comparison.",
        };
      }
      const [left, right] = globalAST.children!;
      const core = monotoneCore(left, right);
      if (!core || core === "same" || (core[0] === left && core[1] === right)) {
        return {
          success: false,
          ramConsumed: tacticDefs.gcongr.failureCost,
          message: `error: tactic 'gcongr' failed: the sides of '${renderASTString(globalAST)}' do not share a monotone pattern (+, ×, powers) that differs in exactly one place.`,
        };
      }
      const newAST: ASTNode = {
        id: `gcongr-${Date.now()}`,
        type: "Inequality",
        value: "≤",
        children: [cloneAST(core[0]), cloneAST(core[1])],
      };
      const known = hypotheses.find((h) => areNodesEqual(h, newAST));
      if (known || isProofComplete(newAST)) {
        const by = known
          ? ` by assumption ${(known.metadata?.name as string) || "h"}`
          : " by reflexivity";
        return {
          success: true,
          newAST: {
            id: `gcongr-qed-${Date.now()}`,
            type: "Boolean",
            value: true,
          },
          ramConsumed: tacticDefs.gcongr.baseRamCost,
          leanProofStep: "gcongr",
          message: `tactic 'gcongr' reduced the goal to '${renderASTString(newAST)}' and closed it${by}.`,
          isProofComplete: true,
        };
      }
      return {
        success: true,
        newAST,
        ramConsumed: tacticDefs.gcongr.baseRamCost,
        leanProofStep: "gcongr",
        message: `tactic 'gcongr' reduced the goal to '${renderASTString(newAST)}'.`,
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
        ramConsumed: tacticDefs.sorry.baseRamCost,
        leanProofStep: "sorry",
        message:
          "WARNING: Morality exception. Proof accepted via 'sorry'. A single tear falls from the eye of a distant mathematician.",
        isProofComplete: true,
      };
    },
  },
};

// -------------------------------------------------------------
// Helpers for the quantifier, induction and ≤-chain tactics (#2091)
// -------------------------------------------------------------

function isLessEqual(node: ASTNode): boolean {
  return (
    node.type === "Inequality" &&
    node.value === "≤" &&
    node.children?.length === 2
  );
}

/** A term as a Lean argument: bracketed unless it is an atom. */
function renderLeanArg(node: ASTNode): string {
  const text = renderASTString(node);
  return node.children && node.children.length > 0 ? `(${text})` : text;
}

/**
 * Rewrite with a quantified equation such as `∀ m, S(m + 1) = S(m) + (m + 1)`:
 * its left side, read as a pattern, must match the selected sub-term (or its
 * right side, rewriting backwards).
 */
function rewriteWithLemma(
  targetNode: ASTNode,
  globalAST: ASTNode,
  lemma: ASTNode
) {
  const { variables, body } = stripForalls(lemma);
  const name = (lemma.metadata?.name as string) || "h";
  const holes = new Set(variables);
  if (body.type === "Equality" && body.children?.length === 2) {
    const [lhs, rhs] = body.children;
    for (const [from, to] of [
      [lhs, rhs],
      [rhs, lhs],
    ] as const) {
      // A side that is a bare variable matches anything; Lean refuses to
      // rewrite with it ("pattern is a metavariable"), and so does this.
      if (from.type === "Variable" && holes.has(String(from.value))) continue;
      const bindings = new Map<string, ASTNode>();
      if (
        matchPattern(from, targetNode, holes, bindings) &&
        variables.every((v) => bindings.has(v))
      ) {
        const replacement = instantiatePattern(to, bindings);
        const newAST = replaceNode(globalAST, targetNode.id, replacement);
        return {
          success: true,
          newAST,
          ramConsumed: tacticDefs.rw.baseRamCost,
          leanProofStep: from === lhs ? `rw [${name}]` : `rw [← ${name}]`,
          message: `tactic 'rw [${name}]' instantiated ${variables
            .map((v) => `${v} := ${renderASTString(bindings.get(v)!)}`)
            .join(
              ", "
            )} and substituted '${renderASTString(targetNode)}' with '${renderASTString(replacement)}'.`,
        };
      }
    }
  }
  return {
    success: false,
    ramConsumed: tacticDefs.rw.failureCost,
    message: `error: tactic 'rw [${name}]' failed. '${renderASTString(targetNode)}' does not have the shape of either side of '${renderASTString(body)}'. Tap a sub-term of that shape and apply rw again (a wrong target costs ${tacticDefs.rw.failureCost} GB).`,
  };
}

/** Close a goal with a ∀ lemma whose body matches it, such as `exact add_zero n`. */
function exactWithLemma(
  targetNode: ASTNode,
  globalAST: ASTNode,
  lemma: ASTNode
) {
  const { variables, body } = stripForalls(lemma);
  const name = (lemma.metadata?.name as string) || "h";
  const bindings = new Map<string, ASTNode>();
  const goal = isQuantifier(targetNode) ? globalAST : targetNode;
  if (
    !matchPattern(body, goal, new Set(variables), bindings) ||
    !variables.every((v) => bindings.has(v))
  ) {
    return {
      success: false,
      ramConsumed: tacticDefs.exact.failureCost,
      message: `error: tactic 'exact ${name}' failed: '${renderASTString(goal)}' is not an instance of '${renderASTString(body)}'.`,
    };
  }
  const args = variables.map((v) => renderLeanArg(bindings.get(v)!)).join(" ");
  const newAST = replaceNode(globalAST, goal.id, {
    id: `exact-${Date.now()}`,
    type: "Boolean",
    value: true,
  });
  return {
    success: true,
    newAST,
    ramConsumed: tacticDefs.exact.baseRamCost,
    leanProofStep: `exact ${name} ${args}`,
    message: `tactic 'exact ${name} ${args}' closed the goal as an instance of the lemma.`,
    isProofComplete: newAST.type === "Boolean" && newAST.value === true,
  };
}

/**
 * One ≤-chain step for {@link tacticDefs.trans}: a hypothesis (possibly
 * quantified) that starts where the goal starts or ends where it ends.
 */
function chainStep(
  hypothesis: ASTNode,
  goalLeft: ASTNode,
  goalRight: ASTNode
): {
  side: "left" | "right";
  remaining: [ASTNode, ASTNode];
  used: ASTNode;
  args: ASTNode[];
} | null {
  const { variables, body } = stripForalls(hypothesis);
  if (!isLessEqual(body)) return null;
  const [hl, hr] = body.children!;
  const holes = new Set(variables);
  const fromLeft = new Map<string, ASTNode>();
  if (
    matchPattern(hl, goalLeft, holes, fromLeft) &&
    variables.every((v) => fromLeft.has(v))
  ) {
    const middle = instantiatePattern(hr, fromLeft);
    return {
      side: "left",
      remaining: [middle, cloneAST(goalRight)],
      used: { ...body, children: [cloneAST(goalLeft), middle] },
      args: variables.map((v) => fromLeft.get(v)!),
    };
  }
  const fromRight = new Map<string, ASTNode>();
  if (
    matchPattern(hr, goalRight, holes, fromRight) &&
    variables.every((v) => fromRight.has(v))
  ) {
    const middle = instantiatePattern(hl, fromRight);
    return {
      side: "right",
      remaining: [cloneAST(goalLeft), middle],
      used: { ...body, children: [middle, cloneAST(goalRight)] },
      args: variables.map((v) => fromRight.get(v)!),
    };
  }
  return null;
}

/**
 * Where two sides of a ≤ differ, for `gcongr`: walk down while both sides
 * share an operator and differ in exactly one operand, and only through
 * positions where ℕ arithmetic is monotone (either side of + and ×, the
 * base or exponent of ^, the left of −). Function applications such as σ
 * are not monotone, so the walk stops there.
 *
 * @returns "same" for equal sides, the differing pair, or null when the
 *   difference is in more than one place or under a non-monotone position.
 */
function monotoneCore(
  left: ASTNode,
  right: ASTNode
): "same" | [ASTNode, ASTNode] | null {
  if (areNodesEqual(left, right)) return "same";
  const lc = left.children ?? [];
  const rc = right.children ?? [];
  if (
    left.type !== "Operator" ||
    right.type !== "Operator" ||
    left.value !== right.value ||
    lc.length !== 2 ||
    rc.length !== 2
  ) {
    return [left, right];
  }
  const differing = [0, 1].filter((i) => !areNodesEqual(lc[i], rc[i]));
  if (differing.length !== 1) return [left, right];
  const i = differing[0];
  const op = String(left.value);
  const monotone =
    op === "+" ||
    op === "*" ||
    op === "×" ||
    (op === "^" && (i === 0 || Number(lc[0].value) >= 1)) ||
    (op === "-" && i === 0);
  if (!monotone) return null;
  const inner = monotoneCore(lc[i], rc[i]);
  return inner === "same" ? null : inner;
}
