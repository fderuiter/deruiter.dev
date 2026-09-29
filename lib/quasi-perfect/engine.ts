import { ASTNode, LeanProofStep, PuzzlerLevelDef, SubGoal } from "./types";

/**
 * Creates a deep clone of an AST node tree.
 */
export function cloneAST(node: ASTNode): ASTNode {
  return {
    ...node,
    metadata: node.metadata ? { ...node.metadata } : undefined,
    children: node.children ? node.children.map(cloneAST) : undefined,
  };
}

/**
 * Searches for a node by its unique ID in the AST.
 */
export function findNodeById(root: ASTNode, id: string): ASTNode | null {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Replaces a target node matching targetId with replacementNode.
 */
export function replaceNode(
  root: ASTNode,
  targetId: string,
  replacementNode: ASTNode
): ASTNode {
  if (root.id === targetId) {
    return cloneAST(replacementNode);
  }
  if (!root.children || root.children.length === 0) {
    return { ...root };
  }
  return {
    ...root,
    children: root.children.map((child) =>
      replaceNode(child, targetId, replacementNode)
    ),
  };
}

/**
 * Deep structural equality check for two AST subtrees (ignoring node ID differences).
 */
export function areNodesEqual(a: ASTNode, b: ASTNode): boolean {
  if (a.type !== b.type || a.value !== b.value) {
    return false;
  }
  const aChildren = a.children || [];
  const bChildren = b.children || [];
  if (aChildren.length !== bChildren.length) {
    return false;
  }
  for (let i = 0; i < aChildren.length; i++) {
    if (!areNodesEqual(aChildren[i], bChildren[i])) {
      return false;
    }
  }
  return true;
}

type Associativity = "left" | "right" | "none";

const CONNECTIVE_SYMBOLS: Partial<Record<ASTNode["type"], string>> = {
  Implication: "→",
  Conjunction: "∧",
  Disjunction: "∨",
};

/**
 * Binding strength and grouping of a binary node, or null for nodes that
 * never need parentheses (atoms, functions, negations, unary operators).
 */
function binaryPrecedence(
  node: ASTNode
): { precedence: number; associativity: Associativity } | null {
  if (!node.children || node.children.length !== 2) return null;
  switch (node.type) {
    case "Implication":
      return { precedence: 1, associativity: "right" };
    case "Disjunction":
      return { precedence: 2, associativity: "left" };
    case "Conjunction":
      return { precedence: 3, associativity: "left" };
    case "Equality":
    case "Inequality":
      return { precedence: 4, associativity: "none" };
    case "Operator":
      if (node.value === "^") return { precedence: 7, associativity: "right" };
      if (node.value === "*" || node.value === "/" || node.value === "×") {
        return { precedence: 6, associativity: "left" };
      }
      return { precedence: 5, associativity: "left" };
    default:
      return null;
  }
}

/**
 * Renders a binary node's operand, adding parentheses whenever dropping them
 * would change the grouping, so (a + b) + c and a + (b + c) read differently.
 */
function renderOperand(
  child: ASTNode,
  parent: ASTNode,
  side: "left" | "right"
): string {
  const rendered = renderASTString(child);
  const outer = binaryPrecedence(parent);
  const inner = binaryPrecedence(child);
  if (!outer || !inner) return rendered;
  if (inner.precedence > outer.precedence) return rendered;
  if (inner.precedence === outer.precedence && outer.associativity === side) {
    return rendered;
  }
  return `(${rendered})`;
}

/**
 * Formats an AST node to human-readable mathematical notation string.
 *
 * Nested binary nodes are parenthesized only where the conventional
 * precedence and associativity rules would otherwise group them differently.
 */
export function renderASTString(node: ASTNode): string {
  switch (node.type) {
    case "Constant":
    case "Variable":
    case "Boolean":
      return String(node.value);

    case "Negation":
      if (node.children && node.children.length > 0) {
        const inner = renderASTString(node.children[0]);
        return `¬(${inner})`;
      }
      return `¬${node.value}`;

    case "Function":
      if (node.children && node.children.length > 0) {
        return `${node.value}(${node.children.map(renderASTString).join(", ")})`;
      }
      return String(node.value);

    case "Implication":
    case "Conjunction":
    case "Disjunction":
    case "Operator":
    case "Equality":
    case "Inequality": {
      if (!node.children || node.children.length === 0) {
        return String(node.value);
      }
      const symbol = CONNECTIVE_SYMBOLS[node.type] ?? String(node.value);
      if (node.children.length === 1) {
        const operand = node.children[0];
        const inner = renderASTString(operand);
        return binaryPrecedence(operand)
          ? `${symbol} (${inner})`
          : `${symbol} ${inner}`;
      }
      if (node.children.length === 2) {
        const left = renderOperand(node.children[0], node, "left");
        const right = renderOperand(node.children[1], node, "right");
        return `${left} ${symbol} ${right}`;
      }
      return node.children
        .map((child) =>
          binaryPrecedence(child)
            ? `(${renderASTString(child)})`
            : renderASTString(child)
        )
        .join(` ${symbol} `);
    }

    default:
      return String(node.value);
  }
}

/**
 * Recursively attempts to evaluate constant arithmetic expressions.
 */
export function evaluateArithmetic(node: ASTNode): number | null {
  if (node.type === "Constant") {
    const num = Number(node.value);
    return isNaN(num) ? null : num;
  }

  if (node.type === "Operator" && node.children && node.children.length === 2) {
    const leftVal = evaluateArithmetic(node.children[0]);
    const rightVal = evaluateArithmetic(node.children[1]);
    if (leftVal === null || rightVal === null) return null;

    switch (node.value) {
      case "+":
        return leftVal + rightVal;
      case "-":
        return leftVal - rightVal;
      case "*":
      case "×":
        return leftVal * rightVal;
      case "/":
      case "÷":
        return rightVal !== 0 ? Math.floor(leftVal / rightVal) : null;
      case "^":
        return Math.pow(leftVal, rightVal);
      default:
        return null;
    }
  }

  return null;
}

/**
 * Checks whether an entire sub-tree contains only constants and operators (no free variables).
 */
export function isConcreteExpression(node: ASTNode): boolean {
  if (node.type === "Variable") return false;
  if (node.type === "Constant" || node.type === "Boolean") return true;
  if (node.children) {
    return node.children.every(isConcreteExpression);
  }
  return true;
}

/**
 * Evaluates concrete boolean/relational expressions (e.g. 2 * 3 = 6 ∧ 10 > 5).
 */
export function evaluateBooleanExpression(node: ASTNode): boolean | null {
  if (node.type === "Boolean") {
    return Boolean(node.value);
  }

  if (node.type === "Equality" && node.children?.length === 2) {
    const left = evaluateArithmetic(node.children[0]);
    const right = evaluateArithmetic(node.children[1]);
    if (left !== null && right !== null) return left === right;
  }

  if (node.type === "Inequality" && node.children?.length === 2) {
    const left = evaluateArithmetic(node.children[0]);
    const right = evaluateArithmetic(node.children[1]);
    if (left !== null && right !== null) {
      const op = String(node.value);
      if (op === "≤" || op === "<=") return left <= right;
      if (op === "<") return left < right;
      if (op === "≥" || op === ">=") return left >= right;
      if (op === ">") return left > right;
    }
  }

  if (node.type === "Conjunction" && node.children?.length === 2) {
    const left = evaluateBooleanExpression(node.children[0]);
    const right = evaluateBooleanExpression(node.children[1]);
    if (left !== null && right !== null) return left && right;
  }

  if (node.type === "Disjunction" && node.children?.length === 2) {
    const left = evaluateBooleanExpression(node.children[0]);
    const right = evaluateBooleanExpression(node.children[1]);
    if (left !== null && right !== null) return left || right;
  }

  if (node.type === "Negation" && node.children?.length === 1) {
    const inner = evaluateBooleanExpression(node.children[0]);
    if (inner !== null) return !inner;
  }

  return null;
}

/**
 * Recursively simplifies algebraic and arithmetic expressions.
 */
export function simplifyNode(node: ASTNode): {
  node: ASTNode;
  changed: boolean;
} {
  let changed = false;

  // 1. Simplify children first
  let currentChildren: ASTNode[] = [];
  if (node.children && node.children.length > 0) {
    currentChildren = node.children.map((child) => {
      const res = simplifyNode(child);
      if (res.changed) changed = true;
      return res.node;
    });
  }

  const updatedNode: ASTNode = {
    ...node,
    children: currentChildren.length > 0 ? currentChildren : node.children,
  };

  // 2. Try constant folding if it's an operator with 2 children
  if (updatedNode.type === "Operator" && updatedNode.children?.length === 2) {
    const constResult = evaluateArithmetic(updatedNode);
    if (constResult !== null) {
      return {
        node: {
          id: `const-${Math.random().toString(36).substring(2, 8)}`,
          type: "Constant",
          value: constResult,
        },
        changed: true,
      };
    }

    const [left, right] = updatedNode.children;

    // Algebraic identities for addition: x + 0 -> x, 0 + x -> x
    if (updatedNode.value === "+") {
      if (right.type === "Constant" && right.value === 0) {
        return { node: left, changed: true };
      }
      if (left.type === "Constant" && left.value === 0) {
        return { node: right, changed: true };
      }
    }

    // Algebraic identities for multiplication: x * 1 -> x, 1 * x -> x, x * 0 -> 0, 0 * x -> 0
    if (updatedNode.value === "*" || updatedNode.value === "×") {
      if (right.type === "Constant" && right.value === 1)
        return { node: left, changed: true };
      if (left.type === "Constant" && left.value === 1)
        return { node: right, changed: true };
      if (right.type === "Constant" && right.value === 0)
        return { node: right, changed: true };
      if (left.type === "Constant" && left.value === 0)
        return { node: left, changed: true };
    }

    // Algebraic identities for subtraction: x - 0 -> x, x - x -> 0
    if (updatedNode.value === "-") {
      if (right.type === "Constant" && right.value === 0)
        return { node: left, changed: true };
      if (areNodesEqual(left, right)) {
        return {
          node: {
            id: `const-${Math.random().toString(36).substring(2, 8)}`,
            type: "Constant",
            value: 0,
          },
          changed: true,
        };
      }
    }
  }

  // 3. Equality simplification
  if (updatedNode.type === "Equality" && updatedNode.children?.length === 2) {
    const [left, right] = updatedNode.children;
    if (areNodesEqual(left, right)) {
      return {
        node: {
          id: `bool-${Math.random().toString(36).substring(2, 8)}`,
          type: "Boolean",
          value: true,
        },
        changed: true,
      };
    }
  }

  return { node: updatedNode, changed };
}

/**
 * Checks if the AST represents a fully solved/closed proof state.
 */
export function isProofComplete(ast: ASTNode): boolean {
  if (ast.type === "Boolean" && ast.value === true) {
    return true;
  }
  if (ast.type === "Equality" && ast.children?.length === 2) {
    return areNodesEqual(ast.children[0], ast.children[1]);
  }
  return false;
}

/**
 * Checks whether all subgoals are completed.
 */
export function areAllSubgoalsClosed(subgoals: SubGoal[]): boolean {
  if (subgoals.length === 0) return false;
  return subgoals.every((sg) => sg.isCompleted || isProofComplete(sg.goal));
}

// -------------------------------------------------------------
// Polynomial Ring Equivalence Normalizer for tactic 'ring'
// -------------------------------------------------------------

export type MonomialMap = Record<string, number>; // varKey -> coefficient, e.g. "a^2*b": 2

function multiplyMonomialKeys(k1: string, k2: string): string {
  if (!k1) return k2;
  if (!k2) return k1;

  const powers: Record<string, number> = {};
  const parseKey = (k: string) => {
    k.split("*").forEach((part) => {
      if (!part) return;
      const [v, pStr] = part.split("^");
      const p = pStr ? parseInt(pStr, 10) : 1;
      powers[v] = (powers[v] || 0) + p;
    });
  };

  parseKey(k1);
  parseKey(k2);

  return Object.keys(powers)
    .sort()
    .map((v) => (powers[v] === 1 ? v : `${v}^${powers[v]}`))
    .join("*");
}

function addPolynomials(p1: MonomialMap, p2: MonomialMap): MonomialMap {
  const result: MonomialMap = { ...p1 };
  for (const [key, coeff] of Object.entries(p2)) {
    result[key] = (result[key] || 0) + coeff;
    if (result[key] === 0) {
      delete result[key];
    }
  }
  return result;
}

function subtractPolynomials(p1: MonomialMap, p2: MonomialMap): MonomialMap {
  const result: MonomialMap = { ...p1 };
  for (const [key, coeff] of Object.entries(p2)) {
    result[key] = (result[key] || 0) - coeff;
    if (result[key] === 0) {
      delete result[key];
    }
  }
  return result;
}

function multiplyPolynomials(p1: MonomialMap, p2: MonomialMap): MonomialMap {
  const result: MonomialMap = {};
  for (const [k1, c1] of Object.entries(p1)) {
    for (const [k2, c2] of Object.entries(p2)) {
      const newKey = multiplyMonomialKeys(k1, k2);
      const coeff = c1 * c2;
      result[newKey] = (result[newKey] || 0) + coeff;
      if (result[newKey] === 0) {
        delete result[newKey];
      }
    }
  }
  return result;
}

function powerPolynomial(p: MonomialMap, exponent: number): MonomialMap {
  if (exponent === 0) return { "": 1 };
  let result: MonomialMap = { ...p };
  for (let i = 1; i < exponent; i++) {
    result = multiplyPolynomials(result, p);
  }
  return result;
}

/**
 * Converts an arithmetic/algebraic AST node into a canonical polynomial representation.
 */
export function astToPolynomial(node: ASTNode): MonomialMap | null {
  if (node.type === "Constant") {
    const val = Number(node.value);
    if (isNaN(val)) return null;
    return val === 0 ? {} : { "": val };
  }

  if (node.type === "Variable") {
    return { [String(node.value)]: 1 };
  }

  if (node.type === "Operator" && node.children) {
    if (node.children.length === 1 && node.value === "-") {
      const inner = astToPolynomial(node.children[0]);
      return inner ? subtractPolynomials({}, inner) : null;
    }

    if (node.children.length === 2) {
      const left = astToPolynomial(node.children[0]);
      const right = astToPolynomial(node.children[1]);
      if (!left || !right) return null;

      switch (node.value) {
        case "+":
          return addPolynomials(left, right);
        case "-":
          return subtractPolynomials(left, right);
        case "*":
        case "×":
          return multiplyPolynomials(left, right);
        case "^": {
          const exponent = Number(node.children[1].value);
          if (Number.isInteger(exponent) && exponent >= 0) {
            return powerPolynomial(left, exponent);
          }
          return null;
        }
        default:
          return null;
      }
    }
  }

  return null;
}

/**
 * Checks if two AST expressions are equivalent under commutative ring axioms.
 */
export function areRingEquivalent(a: ASTNode, b: ASTNode): boolean {
  const polyA = astToPolynomial(a);
  const polyB = astToPolynomial(b);
  if (!polyA || !polyB) return false;

  const keysA = Object.keys(polyA);
  const keysB = Object.keys(polyB);

  if (keysA.length !== keysB.length) return false;

  for (const k of keysA) {
    if (polyA[k] !== polyB[k]) return false;
  }

  return true;
}

/**
 * Generates an accurate, clean Lean 4 proof script for the given level and executed steps.
 */
export function generateLeanProofScript(
  level: PuzzlerLevelDef,
  steps: LeanProofStep[],
  isComplete: boolean
): string {
  const lines: string[] = [
    `-- Theorem: ${level.title}`,
    `-- Chapter ${level.chapter}: ${level.chapterTitle}`,
    `theorem ${level.leanTheoremName} ${level.leanTypeSignature} := by`,
  ];

  if (steps.length === 0) {
    lines.push("  sorry -- Goal open");
  } else {
    for (const step of steps) {
      lines.push(`  ${step.leanLine}`);
    }
    if (isComplete) {
      lines.push("  -- Q.E.D. Goal closed! 🚀");
    }
  }

  return lines.join("\n");
}
