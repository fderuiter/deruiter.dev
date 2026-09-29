/**
 * Logic Proof Workspace, Formal Theorem Definitions, AST Logic Engine, Fallacy Diagnostics, and Multi-Format Exporters.
 */

export type TheoremId =
  | "modus-ponens"
  | "modus-tollens"
  | "hypothetical-syllogism"
  | "disjunctive-syllogism"
  | "resolution"
  | "two-phase-commit"
  | "quorum-overlap"
  | "cache-consistency"
  | "paxos-synod"
  | "paxos-phase2b"
  | "bft-quorum"
  | "custom";

export type TheoremCategory =
  | "Foundational"
  | "Indirect Proofs"
  | "Distributed Systems"
  | "Fault Tolerance"
  | "Custom Studio";

export interface Edge {
  source: string;
  target: string;
  ruleApplied?: string;
}

export interface ProofNode {
  id: string;
  label: string;
  type: "premise" | "intermediate" | "conclusion";
  description: string;
  meaning: string;
  x: number;
  y: number;
  derivedFrom?: string[];
  ruleUsed?: string;
  ast?: PropAst;
}

export interface TacticHint {
  stepNumber: number;
  title: string;
  hint: string;
  suggestedSource?: string;
  suggestedTarget?: string;
  suggestedRule?: string;
  isCompleted: boolean;
}

export interface LedgerStep {
  stepNumber: number;
  formula: string;
  rule: string;
  premises: string;
  plainEnglish: string;
  isProven: boolean;
  nodeId?: string;
  isDeletable?: boolean;
}

export interface TruthTableRow {
  p: boolean;
  q: boolean;
  r?: boolean;
  s?: boolean;
  valuations?: Record<string, boolean>;
  premiseValues?: boolean[];
  premise1: boolean;
  premise2: boolean;
  conclusion: boolean;
  isCounterexample: boolean;
}

export interface FallacyFormulaAst {
  label: string;
  ast: PropAst;
  description: string;
}

export interface AstTraceNode {
  ast: PropAst;
  label: string;
  value: boolean;
  operator?: string;
  operandLabels?: string[];
  children?: AstTraceNode[];
}

export interface FallacyDiagnosis {
  fallacyName: string;
  formalFormula: string;
  plainEnglish: string;
  softwareAnalogy: string;
  truthTable: TruthTableRow[];
  premises?: FallacyFormulaAst[];
  conclusion?: FallacyFormulaAst;
  variables?: string[];
  counterexampleValuation?: Record<string, boolean>;
}

export interface TheoremDefinition {
  id: TheoremId;
  title: string;
  subtitle: string;
  category: TheoremCategory;
  ruleName: string;
  scenario: string;
  goalDescription: string;
  targetNodeId: string;
  nodes: ProofNode[];
  initialEdges: Edge[];
  validPairs: string[][];
  intermediateNodeId: string;
  intermediateRequires: [string, string];
  conclusionRequires: [string, string];
  simulationSteps: string[];
  leanCode: string;
  latexCode: string;
}

export type PropAst =
  | { type: "var"; name: string }
  | { type: "not"; operand: PropAst }
  | { type: "and"; left: PropAst; right: PropAst }
  | { type: "or"; left: PropAst; right: PropAst }
  | { type: "implies"; left: PropAst; right: PropAst }
  | { type: "iff"; left: PropAst; right: PropAst }
  | { type: "bottom" };

export interface RuleDefinition {
  id: string;
  name: string;
  symbol: string;
  template: string;
  arity: number;
  description: string;
  softwareMeaning: string;
}

export const INFERENCE_RULES: RuleDefinition[] = [
  {
    id: "mp",
    name: "Modus Ponens",
    symbol: "MP",
    template: "P, P → Q ⊢ Q",
    arity: 2,
    description: "Affirms antecedent to derive consequent.",
    softwareMeaning: "Triggering an action when precondition gate passes.",
  },
  {
    id: "mt",
    name: "Modus Tollens",
    symbol: "MT",
    template: "P → Q, ¬Q ⊢ ¬P",
    arity: 2,
    description: "Denies consequent to infer negation of antecedent.",
    softwareMeaning:
      "Proving absence of root cause by confirming no downstream fault.",
  },
  {
    id: "hs",
    name: "Hypothetical Syllogism",
    symbol: "HS",
    template: "P → Q, Q → R ⊢ P → R",
    arity: 2,
    description: "Chains transitive implications.",
    softwareMeaning:
      "Composing end-to-end latency SLA contracts across microservices.",
  },
  {
    id: "ds",
    name: "Disjunctive Syllogism",
    symbol: "DS",
    template: "P ∨ Q, ¬P ⊢ Q",
    arity: 2,
    description:
      "Eliminates false disjunct to isolate remaining true alternative.",
    softwareMeaning:
      "Consensus leader failover when primary heartbeat lease expires.",
  },
  {
    id: "res",
    name: "Clausal Resolution",
    symbol: "Res",
    template: "A ∨ B, ¬A ∨ C ⊢ B ∨ C",
    arity: 2,
    description: "Cancels complementary literals across clauses.",
    softwareMeaning: "Deadlock detection and wait-for graph cycle refutation.",
  },
  {
    id: "demorgan",
    name: "De Morgan's Laws",
    symbol: "DM",
    template: "¬(P ∧ Q) ⊢ ¬P ∨ ¬Q",
    arity: 1,
    description: "Distributes negation across conjunctions/disjunctions.",
    softwareMeaning:
      "Compiler condition simplification and dead branch elimination.",
  },
  {
    id: "and_intro",
    name: "Conjunction Introduction",
    symbol: "∧-Intro",
    template: "P, Q ⊢ P ∧ Q",
    arity: 2,
    description: "Combines two verified facts into a joint conjunction.",
    softwareMeaning: "Aggregating multi-phase commit quorum votes.",
  },
  {
    id: "and_elim",
    name: "Conjunction Elimination",
    symbol: "∧-Elim",
    template: "P ∧ Q ⊢ P",
    arity: 1,
    description: "Extracts an individual component from a conjunction.",
    softwareMeaning: "Validating individual shard health invariants.",
  },
  {
    id: "raa",
    name: "Reductio Ad Absurdum",
    symbol: "RAA",
    template: "P → ⊥ ⊢ ¬P",
    arity: 1,
    description: "Derives negation when a proposition yields contradiction.",
    softwareMeaning:
      "Proving exploit impossibility by showing attack leads to false state.",
  },
];

export const VALID_NODE_IDS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
];
export const VALID_COMMANDS = [
  "connect",
  "disconnect",
  "apply",
  "list",
  "clear",
  "help",
  "simulate",
  "theorem",
  "switch",
  "inspect",
  "tactic",
  "ledger",
  "export",
  "autostep",
  "solve",
  "prune",
  "delete-step",
];

/**
 * Tokenizes propositional formulas into AST nodes.
 */
export function parseFormula(input: string): PropAst | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  if (
    cleaned === "⊥" ||
    cleaned.toLowerCase() === "false" ||
    cleaned === "bot"
  ) {
    return { type: "bottom" };
  }

  // Handle binary operators in order of standard precedence (iff, implies, or, and)
  // Check for bi-conditional: <-> or ↔
  const iffMatch = findTopLevelOp(cleaned, ["<->", "↔"]);
  if (iffMatch) {
    const left = parseFormula(cleaned.slice(0, iffMatch.index));
    const right = parseFormula(
      cleaned.slice(iffMatch.index + iffMatch.op.length)
    );
    if (left && right) return { type: "iff", left, right };
  }

  // Check for implication: -> or →
  const impMatch = findTopLevelOp(cleaned, ["->", "→"]);
  if (impMatch) {
    const left = parseFormula(cleaned.slice(0, impMatch.index));
    const right = parseFormula(
      cleaned.slice(impMatch.index + impMatch.op.length)
    );
    if (left && right) return { type: "implies", left, right };
  }

  // Check for disjunction: | or || or ∨ or \lor
  const orMatch = findTopLevelOp(cleaned, ["\\lor", "||", "|", "∨"]);
  if (orMatch) {
    const left = parseFormula(cleaned.slice(0, orMatch.index));
    const right = parseFormula(
      cleaned.slice(orMatch.index + orMatch.op.length)
    );
    if (left && right) return { type: "or", left, right };
  }

  // Check for conjunction: & or && or ∧ or \land
  const andMatch = findTopLevelOp(cleaned, ["\\land", "&&", "&", "∧"]);
  if (andMatch) {
    const left = parseFormula(cleaned.slice(0, andMatch.index));
    const right = parseFormula(
      cleaned.slice(andMatch.index + andMatch.op.length)
    );
    if (left && right) return { type: "and", left, right };
  }

  // Check for negation: ~ or ! or ¬ or \neg
  for (const prefix of ["\\neg", "¬", "~", "!"]) {
    if (cleaned.startsWith(prefix)) {
      const rest = cleaned.slice(prefix.length).trim();
      const operand = parseFormula(rest);
      if (operand) return { type: "not", operand };
    }
  }

  // Handle parentheses wrapper: ( ... )
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    let depth = 0;
    let wrapped = true;
    for (let i = 0; i < cleaned.length - 1; i++) {
      if (cleaned[i] === "(") depth++;
      if (cleaned[i] === ")") depth--;
      if (depth === 0) {
        wrapped = false;
        break;
      }
    }
    if (wrapped) {
      return parseFormula(cleaned.slice(1, -1));
    }
  }

  // Single variable identifier
  const varClean = cleaned.replace(/[^A-Za-z0-9_]/g, "");
  if (varClean) {
    return { type: "var", name: varClean };
  }

  return null;
}

function findTopLevelOp(
  str: string,
  operators: string[]
): { index: number; op: string } | null {
  let depth = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    const char = str[i];
    if (char === ")") depth++;
    else if (char === "(") depth--;
    else if (depth === 0) {
      for (const op of operators) {
        if (str.slice(i, i + op.length) === op) {
          return { index: i, op };
        }
      }
    }
  }
  return null;
}

/**
 * Formats a PropAst into mathematical unicode string.
 */
export function formatFormula(ast: PropAst | null | undefined): string {
  if (!ast || typeof ast !== "object" || !("type" in ast)) return "";
  switch (ast.type) {
    case "bottom":
      return "⊥";
    case "var":
      return ast.name || "";
    case "not":
      if (!ast.operand) return "¬";
      if (ast.operand.type === "var" || ast.operand.type === "bottom") {
        return `¬${formatFormula(ast.operand)}`;
      }
      return `¬(${formatFormula(ast.operand)})`;
    case "and":
      return `${formatChildFormula(ast.left, "and")} ∧ ${formatChildFormula(ast.right, "and")}`;
    case "or":
      return `${formatChildFormula(ast.left, "or")} ∨ ${formatChildFormula(ast.right, "or")}`;
    case "implies":
      return `${formatChildFormula(ast.left, "implies")} → ${formatChildFormula(ast.right, "implies")}`;
    case "iff":
      return `${formatChildFormula(ast.left, "iff")} ↔ ${formatChildFormula(ast.right, "iff")}`;
    default:
      return "";
  }
}

function formatChildFormula(
  child: PropAst | null | undefined,
  parentType: string
): string {
  if (!child) return "";
  const needsParens =
    (parentType === "implies" &&
      (child.type === "implies" || child.type === "iff")) ||
    (parentType === "or" &&
      (child.type === "implies" || child.type === "iff")) ||
    (parentType === "and" &&
      (child.type === "or" ||
        child.type === "implies" ||
        child.type === "iff"));
  return needsParens ? `(${formatFormula(child)})` : formatFormula(child);
}

/**
 * Compares two PropAst trees for structural equivalence.
 */
export function areAstsEqual(
  a: PropAst | null | undefined,
  b: PropAst | null | undefined
): boolean {
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "bottom":
      return true;
    case "var":
      return a.name === (b as { type: "var"; name: string }).name;
    case "not":
      return areAstsEqual(
        a.operand,
        (b as { type: "not"; operand: PropAst }).operand
      );
    case "and":
    case "or":
    case "implies":
    case "iff": {
      const bBin = b as { type: typeof a.type; left: PropAst; right: PropAst };
      return (
        areAstsEqual(a.left, bBin.left) && areAstsEqual(a.right, bBin.right)
      );
    }
    default:
      return false;
  }
}

/**
 * Extracts unique proposition variable names from an AST.
 */
export function extractVariables(ast: PropAst | null | undefined): string[] {
  if (!ast || typeof ast !== "object") return [];
  const vars = new Set<string>();
  function traverse(node: PropAst | null | undefined, depth = 0) {
    if (!node || typeof node !== "object" || depth > 500) return;
    if (node.type === "var" && node.name) vars.add(node.name);
    else if (node.type === "not") traverse(node.operand, depth + 1);
    else if ("left" in node && "right" in node) {
      traverse(node.left, depth + 1);
      traverse(node.right, depth + 1);
    }
  }
  traverse(ast, 0);
  return Array.from(vars).sort();
}

/**
 * Evaluates the boolean truth value of an AST under a variable valuation.
 */
export function evaluateAst(
  ast: PropAst | null | undefined,
  env: Record<string, boolean> = {},
  depth = 0
): boolean {
  if (!ast || typeof ast !== "object" || !("type" in ast) || depth > 500) {
    return false;
  }
  switch (ast.type) {
    case "bottom":
      return false;
    case "var":
      return Boolean(env[ast.name]);
    case "not":
      return !evaluateAst(ast.operand, env, depth + 1);
    case "and":
      return (
        evaluateAst(ast.left, env, depth + 1) &&
        evaluateAst(ast.right, env, depth + 1)
      );
    case "or":
      return (
        evaluateAst(ast.left, env, depth + 1) ||
        evaluateAst(ast.right, env, depth + 1)
      );
    case "implies":
      return (
        !evaluateAst(ast.left, env, depth + 1) ||
        evaluateAst(ast.right, env, depth + 1)
      );
    case "iff":
      return (
        evaluateAst(ast.left, env, depth + 1) ===
        evaluateAst(ast.right, env, depth + 1)
      );
    default:
      return false;
  }
}

/**
 * Evaluates the boolean truth value of an AST under a variable valuation and produces a hierarchical evaluation trace.
 */
export function evaluateAstWithTrace(
  ast: PropAst | null | undefined,
  env: Record<string, boolean> = {},
  depth = 0
): AstTraceNode {
  if (!ast || typeof ast !== "object" || !("type" in ast) || depth > 500) {
    return {
      ast: ast || { type: "bottom" },
      label: "",
      value: false,
      children: [],
    };
  }
  switch (ast.type) {
    case "bottom":
      return {
        ast,
        label: "⊥",
        value: false,
        children: [],
      };
    case "var": {
      const val = Boolean(env[ast.name]);
      return {
        ast,
        label: ast.name || "",
        value: val,
        children: [],
      };
    }
    case "not": {
      const child = evaluateAstWithTrace(ast.operand, env, depth + 1);
      const val = !child.value;
      return {
        ast,
        label: formatFormula(ast),
        value: val,
        operator: "¬",
        operandLabels: [child.label],
        children: [child],
      };
    }
    case "and": {
      const left = evaluateAstWithTrace(ast.left, env, depth + 1);
      const right = evaluateAstWithTrace(ast.right, env, depth + 1);
      const val = left.value && right.value;
      return {
        ast,
        label: formatFormula(ast),
        value: val,
        operator: "∧",
        operandLabels: [left.label, right.label],
        children: [left, right],
      };
    }
    case "or": {
      const left = evaluateAstWithTrace(ast.left, env, depth + 1);
      const right = evaluateAstWithTrace(ast.right, env, depth + 1);
      const val = left.value || right.value;
      return {
        ast,
        label: formatFormula(ast),
        value: val,
        operator: "∨",
        operandLabels: [left.label, right.label],
        children: [left, right],
      };
    }
    case "implies": {
      const left = evaluateAstWithTrace(ast.left, env, depth + 1);
      const right = evaluateAstWithTrace(ast.right, env, depth + 1);
      const val = !left.value || right.value;
      return {
        ast,
        label: formatFormula(ast),
        value: val,
        operator: "→",
        operandLabels: [left.label, right.label],
        children: [left, right],
      };
    }
    case "iff": {
      const left = evaluateAstWithTrace(ast.left, env, depth + 1);
      const right = evaluateAstWithTrace(ast.right, env, depth + 1);
      const val = left.value === right.value;
      return {
        ast,
        label: formatFormula(ast),
        value: val,
        operator: "↔",
        operandLabels: [left.label, right.label],
        children: [left, right],
      };
    }
    default:
      return {
        ast,
        label: "",
        value: false,
        children: [],
      };
  }
}

/**
 * Dynamically synthesizes all combinatorial truth table valuations for a set of premises and a conclusion.
 */
export function generateTruthTable(
  premises: { label: string; ast: PropAst }[],
  conclusion: { label: string; ast: PropAst }
): {
  truthTable: TruthTableRow[];
  variables: string[];
  counterexampleValuation?: Record<string, boolean>;
} {
  const varSet = new Set<string>();
  premises.forEach((p) =>
    extractVariables(p.ast).forEach((v) => varSet.add(v))
  );
  extractVariables(conclusion.ast).forEach((v) => varSet.add(v));

  if (varSet.size === 0) {
    varSet.add("P");
    varSet.add("Q");
  } else if (varSet.size === 1) {
    const singleVar = Array.from(varSet)[0];
    if (singleVar === "P") varSet.add("Q");
    else varSet.add("P");
  }

  const variables = Array.from(varSet).sort();
  const numVars = variables.length;
  const totalCombinations = 1 << numVars;
  const truthTable: TruthTableRow[] = [];
  let firstCounterexample: Record<string, boolean> | undefined = undefined;

  for (let i = totalCombinations - 1; i >= 0; i--) {
    const valuation: Record<string, boolean> = {};
    for (let bit = 0; bit < numVars; bit++) {
      const varName = variables[bit];
      const isTrue = Boolean((i >> (numVars - 1 - bit)) & 1);
      valuation[varName] = isTrue;
    }

    const premiseValues = premises.map((p) => evaluateAst(p.ast, valuation));
    const conclusionVal = evaluateAst(conclusion.ast, valuation);
    const allPremisesTrue =
      premiseValues.length > 0 ? premiseValues.every((v) => v === true) : true;
    const isCounterexample = allPremisesTrue && !conclusionVal;

    if (isCounterexample && !firstCounterexample) {
      firstCounterexample = valuation;
    }

    truthTable.push({
      p: valuation["P"] ?? valuation[variables[0]] ?? false,
      q: valuation["Q"] ?? valuation[variables[1]] ?? false,
      r: valuation["R"] ?? (variables[2] ? valuation[variables[2]] : undefined),
      s: valuation["S"] ?? (variables[3] ? valuation[variables[3]] : undefined),
      valuations: valuation,
      premiseValues,
      premise1: premiseValues[0] ?? false,
      premise2: premiseValues[1] ?? false,
      conclusion: conclusionVal,
      isCounterexample,
    });
  }

  return {
    truthTable,
    variables,
    counterexampleValuation: firstCounterexample,
  };
}

export const THEOREMS: Record<TheoremId, TheoremDefinition> = {
  "modus-ponens": {
    id: "modus-ponens",
    title: "Modus Ponens",
    subtitle: "Affirming the Antecedent · CI/CD Quality Gate",
    category: "Foundational",
    ruleName: "Modus Ponens (P ∧ (P → Q) ⊢ Q)",
    scenario:
      "Automated regression testing in continuous integration pipelines.",
    goalDescription:
      "Discharge Conclusion R (Reliability is guaranteed) through test suite verification.",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "P",
        type: "premise",
        description: "Premise P: The test suite executes on every commit.",
        meaning:
          "All automated regression tests are actively running in the pipeline.",
        x: 120,
        y: 130,
        ast: { type: "var", name: "P" },
      },
      {
        id: "B",
        label: "P → Q",
        type: "premise",
        description:
          "Premise P → Q: If tests run on every commit, regression bugs will be caught.",
        meaning:
          "High coverage test suites reliably intercept regressions before production.",
        x: 120,
        y: 290,
        ast: {
          type: "implies",
          left: { type: "var", name: "P" },
          right: { type: "var", name: "Q" },
        },
      },
      {
        id: "C",
        label: "Q",
        type: "intermediate",
        description:
          "Intermediate Conclusion Q: Regression bugs will be caught.",
        meaning: "Derived fact: The pipeline successfully detects defects.",
        x: 360,
        y: 210,
        ast: { type: "var", name: "Q" },
      },
      {
        id: "D",
        label: "Q → R",
        type: "premise",
        description:
          "Premise Q → R: If bugs are caught, production reliability is guaranteed.",
        meaning:
          "Intercepting defects prevents outages and guarantees system uptime.",
        x: 360,
        y: 360,
        ast: {
          type: "implies",
          left: { type: "var", name: "Q" },
          right: { type: "var", name: "R" },
        },
      },
      {
        id: "E",
        label: "R",
        type: "conclusion",
        description: "Conclusion R: Production reliability is guaranteed.",
        meaning:
          "The target proposition in this teaching graph; it does not certify a deployment.",
        x: 600,
        y: 285,
        ast: { type: "var", name: "R" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "MP" },
      { source: "B", target: "C", ruleApplied: "MP" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Initializing Modus Ponens Tactic Engine...",
      "Traversing proof tree starting with premise nodes: Node A (P) and Node B (P → Q)...",
      "Validating Node A and Node B connection requirements...",
      "Applying Modus Ponens tactic to establish intermediate Node C (Q)...",
      "Local graph established intermediate Node C.",
      "Traversing next branch: Premise Node D (Q → R)...",
      "Validating Node C and Node D connection requirements to target Node E (R)...",
      "Applying Modus Ponens tactic to establish conclusion Node E (R)...",
      "Re-verifying entire proof graph structure...",
      "Proof graph verification completed successfully! Target R proven.",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem modus_ponens_pipeline (P Q R : Prop)
  (hA : P)
  (hB : P → Q)
  (hD : Q → R) : R := by
  have hC : Q := hB hA
  exact hD hC`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$P$}
  \\AxiomC{$P \\to Q$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$Q$}
  \\AxiomC{$Q \\to R$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$R$}
\\end{prooftree}`,
  },

  "modus-tollens": {
    id: "modus-tollens",
    title: "Modus Tollens",
    subtitle: "Denying the Consequent · Memory Safety & Exploit Prevention",
    category: "Indirect Proofs",
    ruleName: "Modus Tollens ((P → Q) ∧ ¬Q ⊢ ¬P)",
    scenario:
      "Proving memory safety by demonstrating the complete absence of buffer overflows.",
    goalDescription:
      "Discharge Conclusion R (Exploit is impossible) via contrapositive inference.",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "P → Q",
        type: "premise",
        description:
          "Premise P → Q: If buffer allocation is unbounded (P), heap overflow occurs (Q).",
        meaning:
          "Unchecked pointer arithmetic inevitably triggers heap corruptions.",
        x: 120,
        y: 130,
        ast: {
          type: "implies",
          left: { type: "var", name: "P" },
          right: { type: "var", name: "Q" },
        },
      },
      {
        id: "B",
        label: "¬Q",
        type: "premise",
        description:
          "Premise ¬Q: assume heap overflow did not occur in this example.",
        meaning:
          "AddressSanitizer proves the absence of heap corruption across all executions.",
        x: 120,
        y: 290,
        ast: { type: "not", operand: { type: "var", name: "Q" } },
      },
      {
        id: "C",
        label: "¬P",
        type: "intermediate",
        description:
          "Intermediate Conclusion ¬P: Buffer allocation is bounded and memory-safe.",
        meaning:
          "Derived fact: Unbounded memory allocation is impossible in this runtime.",
        x: 360,
        y: 210,
        ast: { type: "not", operand: { type: "var", name: "P" } },
      },
      {
        id: "D",
        label: "¬P → R",
        type: "premise",
        description:
          "Premise ¬P → R: If buffer is bounded, remote code execution exploit (R) is impossible.",
        meaning:
          "Bounded buffers eliminate stack/heap smashing attack vectors.",
        x: 360,
        y: 360,
        ast: {
          type: "implies",
          left: { type: "not", operand: { type: "var", name: "P" } },
          right: { type: "var", name: "R" },
        },
      },
      {
        id: "E",
        label: "R",
        type: "conclusion",
        description:
          "Conclusion R: Remote code execution exploit is impossible.",
        meaning:
          "The target theorem: 100% formal memory safety guarantee achieved.",
        x: 600,
        y: 285,
        ast: { type: "var", name: "R" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "MT" },
      { source: "B", target: "C", ruleApplied: "MT" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Initializing Modus Tollens Tactic Engine...",
      "Evaluating negative consequent: Node B (¬Q: No Heap Overflow)...",
      "Evaluating conditional implication: Node A (P → Q: Unbounded implies Overflow)...",
      "Applying Modus Tollens contrapositive rule to establish Node C (¬P: Bounded Memory)...",
      "Intermediate proposition ¬P discharged without sorry axiom.",
      "Linking with Premise Node D (¬P → R: Bounded memory prevents RCE)...",
      "Applying Modus Ponens on derived ¬P and Premise D...",
      "Discharging final Conclusion Node E (R: Exploit impossible)...",
      "Re-verifying entire contrapositive AST graph...",
      "Local deduction reached the memory-safety proposition; no runtime system was checked.",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem modus_tollens_memory_safety (P Q R : Prop)
  (hA : P → Q)
  (hB : ¬Q)
  (hD : ¬P → R) : R := by
  have hC : ¬P := fun hp => hB (hA hp)
  exact hD hC`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$P \\to Q$}
  \\AxiomC{$\\neg Q$}
  \\RightLabel{\\scriptsize MT}
  \\BinaryInfC{$\\neg P$}
  \\AxiomC{$\\neg P \\to R$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$R$}
\\end{prooftree}`,
  },

  "hypothetical-syllogism": {
    id: "hypothetical-syllogism",
    title: "Hypothetical Syllogism",
    subtitle: "Transitivity of Implication · Microservice SLA Chaining",
    category: "Distributed Systems",
    ruleName: "Hypothetical Syllogism ((P → Q) ∧ (Q → R) ⊢ P → R)",
    scenario:
      "Verifying end-to-end service latency SLA across upstream and downstream microservices.",
    goalDescription:
      "Discharge Conclusion S (Global 99.99% Availability SLA is satisfied).",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "P → Q",
        type: "premise",
        description:
          "Premise P → Q: If Auth API latency < 50ms (P), cache hits exceed 98% (Q).",
        meaning: "Fast token validation maintains warm Redis cache tiers.",
        x: 120,
        y: 130,
        ast: {
          type: "implies",
          left: { type: "var", name: "P" },
          right: { type: "var", name: "Q" },
        },
      },
      {
        id: "B",
        label: "Q → R",
        type: "premise",
        description:
          "Premise Q → R: If cache hits exceed 98% (Q), database IOPS stay nominal (R).",
        meaning:
          "High cache hit ratio prevents database connection pool exhaustion.",
        x: 120,
        y: 290,
        ast: {
          type: "implies",
          left: { type: "var", name: "Q" },
          right: { type: "var", name: "R" },
        },
      },
      {
        id: "C",
        label: "P → R",
        type: "intermediate",
        description:
          "Intermediate Conclusion P → R: If Auth latency < 50ms, database IOPS stay nominal.",
        meaning:
          "Derived transitive chain across the distributed service topology.",
        x: 360,
        y: 210,
        ast: {
          type: "implies",
          left: { type: "var", name: "P" },
          right: { type: "var", name: "R" },
        },
      },
      {
        id: "D",
        label: "(P→R)→S",
        type: "premise",
        description:
          "Premise (P → R) → S: If nominal DB IOPS is bounded by Auth, Global SLA is met (S).",
        meaning:
          "System-wide architectural contract ensures 99.99% availability.",
        x: 360,
        y: 360,
        ast: {
          type: "implies",
          left: {
            type: "implies",
            left: { type: "var", name: "P" },
            right: { type: "var", name: "R" },
          },
          right: { type: "var", name: "S" },
        },
      },
      {
        id: "E",
        label: "S",
        type: "conclusion",
        description:
          "Conclusion S: the example graph derives an SLA proposition.",
        meaning:
          "The example target proposition; no live SLA or bottleneck was measured.",
        x: 600,
        y: 285,
        ast: { type: "var", name: "S" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "HS" },
      { source: "B", target: "C", ruleApplied: "HS" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Initializing Hypothetical Syllogism Tactic Engine...",
      "Inspecting upstream conditional: Node A (P → Q: Auth to Cache)...",
      "Inspecting downstream conditional: Node B (Q → R: Cache to DB IOPS)...",
      "Applying Transitivity of Implication to synthesize intermediate Node C (P → R)...",
      "Transitive implication P → R proven valid.",
      "Connecting derived contract with SLA gatekeeper Node D ((P → R) → S)...",
      "Applying Modus Ponens on intermediate Node C and Premise Node D...",
      "Discharging Conclusion Node E (S: Global SLA Met)...",
      "Verifying zero cyclical latency dependencies in service mesh...",
      "Local implication graph reached the SLA proposition; no live service was checked.",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem hypothetical_syllogism_sla (P Q R S : Prop)
  (hA : P → Q)
  (hB : Q → R)
  (hD : (P → R) → S) : S := by
  have hC : P → R := fun hp => hB (hA hp)
  exact hD hC`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$P \\to Q$}
  \\AxiomC{$Q \\to R$}
  \\RightLabel{\\scriptsize HS}
  \\BinaryInfC{$P \\to R$}
  \\AxiomC{$(P \\to R) \\to S$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$S$}
\\end{prooftree}`,
  },

  "disjunctive-syllogism": {
    id: "disjunctive-syllogism",
    title: "Disjunctive Syllogism",
    subtitle: "Elimination of Alternatives · Distributed Consensus Failover",
    category: "Fault Tolerance",
    ruleName: "Disjunctive Syllogism ((P ∨ Q) ∧ ¬P ⊢ Q)",
    scenario: "Raft consensus leader failover and backup quorum arbitration.",
    goalDescription:
      "Discharge Conclusion R (Zero downtime is guaranteed during primary partition).",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "P ∨ Q",
        type: "premise",
        description:
          "Premise P ∨ Q: Primary node maintains lease (P) OR Standby replica takes leader quorum (Q).",
        meaning: "At least one consensus coordinator is active at any epoch.",
        x: 120,
        y: 130,
        ast: {
          type: "or",
          left: { type: "var", name: "P" },
          right: { type: "var", name: "Q" },
        },
      },
      {
        id: "B",
        label: "¬P",
        type: "premise",
        description:
          "Premise ¬P: Primary node heartbeat expired and failed lease renewal (¬P).",
        meaning:
          "Split-brain detector confirms the primary node is unreachable.",
        x: 120,
        y: 290,
        ast: { type: "not", operand: { type: "var", name: "P" } },
      },
      {
        id: "C",
        label: "Q",
        type: "intermediate",
        description:
          "Intermediate Conclusion Q: Standby replica successfully takes leader quorum.",
        meaning: "Derived fact: Failover quorum is triggered immediately.",
        x: 360,
        y: 210,
        ast: { type: "var", name: "Q" },
      },
      {
        id: "D",
        label: "Q → R",
        type: "premise",
        description:
          "Premise Q → R: If standby replica takes quorum, zero downtime (R) is maintained.",
        meaning:
          "Fast failover replication guarantees uninterrupted client writes.",
        x: 360,
        y: 360,
        ast: {
          type: "implies",
          left: { type: "var", name: "Q" },
          right: { type: "var", name: "R" },
        },
      },
      {
        id: "E",
        label: "R",
        type: "conclusion",
        description:
          "Conclusion R: Zero downtime consensus invariant is maintained.",
        meaning:
          "The target theorem: 100% formal resilience against primary node failure.",
        x: 600,
        y: 285,
        ast: { type: "var", name: "R" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "DS" },
      { source: "B", target: "C", ruleApplied: "DS" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Initializing Disjunctive Syllogism Tactic Engine...",
      "Evaluating active disjunction: Node A (P ∨ Q: Primary or Standby)...",
      "Evaluating negation premise: Node B (¬P: Primary Heartbeat Failed)...",
      "Applying Disjunctive Syllogism elimination rule to establish Node C (Q: Standby Active)...",
      "Intermediate conclusion Q discharged successfully.",
      "Linking standby quorum with uptime guarantee: Node D (Q → R)...",
      "Applying Modus Ponens on derived Node C and Node D...",
      "Discharging final Conclusion Node E (R: Zero Downtime)...",
      "Verifying absence of split-brain edge cases in Raft term...",
      "Local failover deduction completed; no distributed implementation was checked.",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem disjunctive_syllogism_raft (P Q R : Prop)
  (hA : P ∨ Q)
  (hB : ¬P)
  (hD : Q → R) : R := by
  have hC : Q := hA.resolve_left hB
  exact hD hC`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$P \\lor Q$}
  \\AxiomC{$\\neg P$}
  \\RightLabel{\\scriptsize DS}
  \\BinaryInfC{$Q$}
  \\AxiomC{$Q \\to R$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$R$}
\\end{prooftree}`,
  },

  resolution: {
    id: "resolution",
    title: "Resolution Refutation",
    subtitle: "Clausal Inference · Deadlock & Invariant Conflict Detection",
    category: "Fault Tolerance",
    ruleName: "Resolution ((P ∨ Q) ∧ (¬P ∨ R) ⊢ Q ∨ R)",
    scenario:
      "Automated theorem proving in database transaction wait-for graphs and lock managers.",
    goalDescription:
      "Discharge Conclusion R (Deadlock resolver triggers safe rollback).",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "P ∨ Q",
        type: "premise",
        description:
          "Premise P ∨ Q: Transaction lock acquired (P) OR Tx enqueued in wait-graph (Q).",
        meaning:
          "Concurrency control invariant: lock is held or request is queued.",
        x: 120,
        y: 130,
        ast: {
          type: "or",
          left: { type: "var", name: "P" },
          right: { type: "var", name: "Q" },
        },
      },
      {
        id: "B",
        label: "¬P ∨ R",
        type: "premise",
        description:
          "Premise ¬P ∨ R: Transaction lock revoked (¬P) OR Deadlock detector triggers rollback (R).",
        meaning: "If lock is not held, deadlock resolution policy is active.",
        x: 120,
        y: 290,
        ast: {
          type: "or",
          left: { type: "not", operand: { type: "var", name: "P" } },
          right: { type: "var", name: "R" },
        },
      },
      {
        id: "C",
        label: "Q ∨ R",
        type: "intermediate",
        description:
          "Intermediate Conclusion Q ∨ R: Tx is enqueued (Q) OR Deadlock resolver triggers rollback (R).",
        meaning:
          "Derived resolvent clause removing the complementary literal P and ¬P.",
        x: 360,
        y: 210,
        ast: {
          type: "or",
          left: { type: "var", name: "Q" },
          right: { type: "var", name: "R" },
        },
      },
      {
        id: "D",
        label: "¬Q",
        type: "premise",
        description:
          "Premise ¬Q: Wait queue is empty (Tx cannot wait further due to lock timeout).",
        meaning:
          "Queue boundary condition: Transaction cannot remain in wait state.",
        x: 360,
        y: 360,
        ast: { type: "not", operand: { type: "var", name: "Q" } },
      },
      {
        id: "E",
        label: "R",
        type: "conclusion",
        description:
          "Conclusion R: Deadlock resolver triggers safe transaction rollback.",
        meaning:
          "The target theorem: Deadlock resolved without data corruption or orphan locks.",
        x: 600,
        y: 285,
        ast: { type: "var", name: "R" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "Res" },
      { source: "B", target: "C", ruleApplied: "Res" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Initializing Resolution Refutation Tactic Engine...",
      "Inspecting Clause 1: Node A (P ∨ Q: Lock acquired or Enqueued)...",
      "Inspecting Clause 2: Node B (¬P ∨ R: Lock revoked or Rollback)...",
      "Applying Resolution Rule on complementary literal P / ¬P...",
      "Derived Resolvent Clause: Node C (Q ∨ R)...",
      "Inspecting unit clause constraint: Node D (¬Q: Not Enqueued)...",
      "Applying Unit Resolution on derived Node C and Node D...",
      "Discharging unit resolvent Conclusion Node E (R: Deadlock Rollback)...",
      "Checking empty clause refutation and cycle-free wait graph...",
      "Local concurrency deduction completed; no database was checked.",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem resolution_deadlock_safety (P Q R : Prop)
  (hA : P ∨ Q)
  (hB : ¬P ∨ R)
  (hD : ¬Q) : R := by
  have hC : Q ∨ R := match hA with
    | Or.inl hp => match hB with
      | Or.inl hnp => False.elim (hnp hp)
      | Or.inr hr => Or.inr hr
    | Or.inr hq => Or.inl hq
  exact match hC with
    | Or.inl hq => False.elim (hD hq)
    | Or.inr hr => hr`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$P \\lor Q$}
  \\AxiomC{$\\neg P \\lor R$}
  \\RightLabel{\\scriptsize Res}
  \\BinaryInfC{$Q \\lor R$}
  \\AxiomC{$\\neg Q$}
  \\RightLabel{\\scriptsize DS}
  \\BinaryInfC{$R$}
\\end{prooftree}`,
  },

  "two-phase-commit": {
    id: "two-phase-commit",
    title: "Two-Phase Commit (2PC)",
    subtitle: "Global Atomicity · Distributed Transaction Coordinator Safety",
    category: "Distributed Systems",
    ruleName: "2PC Consensus ((A ∧ B) ∧ ((A ∧ B) → Commit) ⊢ Commit)",
    scenario:
      "Coordinating multi-shard database atomic commit across independent partitions.",
    goalDescription:
      "Discharge Global Commit invariant (All shards commit atomically or all roll back).",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "PrepA",
        type: "premise",
        description: "Premise PrepA: Shard A voted PREPARED and wrote WAL log.",
        meaning: "Partition A guarantees persistence of transaction changes.",
        x: 120,
        y: 130,
        ast: { type: "var", name: "PrepA" },
      },
      {
        id: "B",
        label: "PrepB",
        type: "premise",
        description: "Premise PrepB: Shard B voted PREPARED and wrote WAL log.",
        meaning: "Partition B guarantees persistence of transaction changes.",
        x: 120,
        y: 290,
        ast: { type: "var", name: "PrepB" },
      },
      {
        id: "C",
        label: "PrepA ∧ PrepB",
        type: "intermediate",
        description:
          "Intermediate Conclusion: All participating shards confirmed readiness.",
        meaning: "Unanimous preparation milestone reached across the cluster.",
        x: 360,
        y: 210,
        ast: {
          type: "and",
          left: { type: "var", name: "PrepA" },
          right: { type: "var", name: "PrepB" },
        },
      },
      {
        id: "D",
        label: "(PrepA ∧ PrepB) → Commit",
        type: "premise",
        description:
          "Premise Protocol: Unanimous prepare triggers Global Commit directive.",
        meaning:
          "2PC protocol rule ensures zero dirty reads or partial writes.",
        x: 360,
        y: 360,
        ast: {
          type: "implies",
          left: {
            type: "and",
            left: { type: "var", name: "PrepA" },
            right: { type: "var", name: "PrepB" },
          },
          right: { type: "var", name: "Commit" },
        },
      },
      {
        id: "E",
        label: "Commit",
        type: "conclusion",
        description:
          "Conclusion Commit: Atomic multi-shard transaction formally committed.",
        meaning: "ACID consistency guaranteed across distributed partitions.",
        x: 600,
        y: 285,
        ast: { type: "var", name: "Commit" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "∧-Intro" },
      { source: "B", target: "C", ruleApplied: "∧-Intro" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Initializing Two-Phase Commit Verification...",
      "Gathering Phase-1 votes: Shard A (PrepA)...",
      "Gathering Phase-1 votes: Shard B (PrepB)...",
      "Applying Conjunction Introduction to establish (PrepA ∧ PrepB)...",
      "Unanimous prepare quorum established in the example graph.",
      "Linking with Coordinator Commit Rule Node D...",
      "Applying Modus Ponens to derive Global Commit...",
      "Verifying zero abort conditions across network partitions...",
      "Local 2PC deduction completed; no production transaction was checked.",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem two_phase_commit (PrepA PrepB Commit : Prop)
  (hA : PrepA)
  (hB : PrepB)
  (hD : (PrepA ∧ PrepB) → Commit) : Commit := by
  have hC : PrepA ∧ PrepB := And.intro hA hB
  exact hD hC`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$PrepA$}
  \\AxiomC{$PrepB$}
  \\RightLabel{\\scriptsize $\\land$-Intro}
  \\BinaryInfC{$PrepA \\land PrepB$}
  \\AxiomC{$(PrepA \\land PrepB) \\to Commit$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$Commit$}
\\end{prooftree}`,
  },

  "quorum-overlap": {
    id: "quorum-overlap",
    title: "Quorum Intersection Safety",
    subtitle: "Pigeonhole Principle · Majority Overlap Invariant",
    category: "Distributed Systems",
    ruleName:
      "Quorum Safety ((Q1 ∧ Q2) ∧ ((Q1 ∧ Q2) → SingleLeader) ⊢ SingleLeader)",
    scenario:
      "Proving impossibility of split-brain leader elections in Raft/Paxos clusters.",
    goalDescription:
      "Discharge Single Leader invariant: At most one leader can be elected in any term.",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "MajA",
        type: "premise",
        description:
          "Premise MajA: Leader A collected a strict majority quorum of votes (N/2 + 1).",
        meaning:
          "Majority partition assumed for Candidate A in this example term.",
        x: 120,
        y: 130,
        ast: { type: "var", name: "MajA" },
      },
      {
        id: "B",
        label: "MajB",
        type: "premise",
        description:
          "Premise MajB: Candidate B claims a strict majority quorum in the same term T.",
        meaning: "Hypothetical competing election attempt.",
        x: 120,
        y: 290,
        ast: { type: "var", name: "MajB" },
      },
      {
        id: "C",
        label: "Overlap",
        type: "intermediate",
        description:
          "Intermediate Conclusion: Quorums MajA and MajB share at least one common voter node.",
        meaning:
          "Pigeonhole principle: Any two majorities of size (N/2 + 1) must intersect.",
        x: 360,
        y: 210,
        ast: { type: "var", name: "Overlap" },
      },
      {
        id: "D",
        label: "Overlap → SingleLeader",
        type: "premise",
        description:
          "Premise Invariant: Intersecting node cannot vote twice in term T, forcing single leader.",
        meaning: "Vote idempotency prevents dual election split-brain.",
        x: 360,
        y: 360,
        ast: {
          type: "implies",
          left: { type: "var", name: "Overlap" },
          right: { type: "var", name: "SingleLeader" },
        },
      },
      {
        id: "E",
        label: "SingleLeader",
        type: "conclusion",
        description:
          "Conclusion SingleLeader: Exactly one legitimate leader elected per term.",
        meaning: "Split-brain exclusion derived inside the example graph.",
        x: 600,
        y: 285,
        ast: { type: "var", name: "SingleLeader" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "Pigeonhole" },
      { source: "B", target: "C", ruleApplied: "Pigeonhole" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Initializing Quorum Intersection Verification...",
      "Evaluating Quorum A size: (N/2 + 1)...",
      "Evaluating Quorum B size: (N/2 + 1)...",
      "Applying Majority Intersection Theorem to derive Overlap node...",
      "Inspecting overlapping voter term constraint Node D...",
      "Applying Modus Ponens to establish SingleLeader invariant...",
      "Verifying zero split-brain states across network splits...",
      "Local quorum deduction completed; no Raft implementation was checked.",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem quorum_overlap_safety (MajA MajB Overlap SingleLeader : Prop)
  (hA : MajA)
  (hB : MajB)
  (hOverlap : MajA → MajB → Overlap)
  (hD : Overlap → SingleLeader) : SingleLeader := by
  have hC : Overlap := hOverlap hA hB
  exact hD hC`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$MajA$}
  \\AxiomC{$MajB$}
  \\RightLabel{\\scriptsize Quorum}
  \\BinaryInfC{$Overlap$}
  \\AxiomC{$Overlap \\to SingleLeader$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$SingleLeader$}
\\end{prooftree}`,
  },

  "cache-consistency": {
    id: "cache-consistency",
    title: "Cache Invalidation & Coherence",
    subtitle: "Write-Through Invariant · Stale Read Prevention",
    category: "Distributed Systems",
    ruleName:
      "Cache Safety (Write ∧ (Write → Invalidate) ∧ (Invalidate → FreshRead) ⊢ FreshRead)",
    scenario:
      "Maintaining strong consistency between high-throughput cache and primary database.",
    goalDescription:
      "Discharge FreshRead invariant: Clients never observe stale dirty cache reads.",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "Write",
        type: "premise",
        description:
          "Premise Write: Primary database successfully committed write update.",
        meaning: "Source of truth has new record state.",
        x: 120,
        y: 130,
        ast: { type: "var", name: "Write" },
      },
      {
        id: "B",
        label: "Write → Invalidate",
        type: "premise",
        description:
          "Premise: Database commit automatically dispatches cache eviction event.",
        meaning: "Change Data Capture (CDC) stream evicts cached key.",
        x: 120,
        y: 290,
        ast: {
          type: "implies",
          left: { type: "var", name: "Write" },
          right: { type: "var", name: "Invalidate" },
        },
      },
      {
        id: "C",
        label: "Invalidate",
        type: "intermediate",
        description:
          "Intermediate Conclusion: Cache key evicted across all edge clusters.",
        meaning: "Stale data purged from L1/L2 cache tiers.",
        x: 360,
        y: 210,
        ast: { type: "var", name: "Invalidate" },
      },
      {
        id: "D",
        label: "Invalidate → FreshRead",
        type: "premise",
        description:
          "Premise: Cache miss triggers synchronous fetch of canonical primary record.",
        meaning: "Subsequent queries are routed to updated database record.",
        x: 360,
        y: 360,
        ast: {
          type: "implies",
          left: { type: "var", name: "Invalidate" },
          right: { type: "var", name: "FreshRead" },
        },
      },
      {
        id: "E",
        label: "FreshRead",
        type: "conclusion",
        description:
          "Conclusion FreshRead: Guaranteed zero stale data read anomalies.",
        meaning: "Sequential cache consistency derived in the example graph.",
        x: 600,
        y: 285,
        ast: { type: "var", name: "FreshRead" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "MP" },
      { source: "B", target: "C", ruleApplied: "MP" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Initializing Cache Coherence Verification...",
      "Evaluating Primary Database Commit Event (Write)...",
      "Evaluating CDC Invalidation Trigger (Write → Invalidate)...",
      "Applying Modus Ponens to establish Cache Invalidation...",
      "Evaluating Edge Read Router Policy (Invalidate → FreshRead)...",
      "Applying Modus Ponens to discharge FreshRead invariant...",
      "Verifying absence of race conditions between CDC stream and read replica...",
      "Local cache-consistency deduction completed; no live cache was checked.",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem cache_consistency_safety (Write Invalidate FreshRead : Prop)
  (hA : Write)
  (hB : Write → Invalidate)
  (hD : Invalidate → FreshRead) : FreshRead := by
  have hC : Invalidate := hB hA
  exact hD hC`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$Write$}
  \\AxiomC{$Write \\to Invalidate$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$Invalidate$}
  \\AxiomC{$Invalidate \\to FreshRead$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$FreshRead$}
\\end{prooftree}`,
  },

  "paxos-synod": {
    id: "paxos-synod",
    title: "Paxos Synod Invariant",
    subtitle: "Proposal Monotonicity · Single-Decree Consensus Safety",
    category: "Distributed Systems",
    ruleName: "Paxos Synod (MajQ1 ∧ (MajQ1 → MaxVal) ⊢ MaxVal)",
    scenario:
      "Single-Decree Paxos leader ballot proposal and value stability across election rounds.",
    goalDescription:
      "Discharge Synod Agreement invariant (No two distinct values can ever be chosen across ballots).",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "MajQ1",
        type: "premise",
        description:
          "Premise MajQ1: Leader gathered a majority promise quorum Q1 in ballot B.",
        meaning:
          "Majority of acceptors in Q1 promised not to accept ballots older than B.",
        x: 120,
        y: 130,
        ast: { type: "var", name: "MajQ1" },
      },
      {
        id: "B",
        label: "MajQ1 → MaxVal",
        type: "premise",
        description:
          "Premise: Quorum intersection forces proposer to adopt value V of highest-numbered ballot.",
        meaning:
          "If Q1 intersects with previously chosen quorum, highest ballot value V is reported.",
        x: 120,
        y: 290,
        ast: {
          type: "implies",
          left: { type: "var", name: "MajQ1" },
          right: { type: "var", name: "MaxVal" },
        },
      },
      {
        id: "C",
        label: "MaxVal",
        type: "intermediate",
        description:
          "Intermediate Conclusion MaxVal: Proposer binds proposal in ballot B to canonical value V.",
        meaning:
          "Derived invariant: Proposer cannot propose any competing value V' ≠ V.",
        x: 360,
        y: 210,
        ast: { type: "var", name: "MaxVal" },
      },
      {
        id: "D",
        label: "MaxVal → SynodAgreement",
        type: "premise",
        description:
          "Premise: Invariant preservation ensures all subsequent ballots only choose value V.",
        meaning:
          "Inductive step: If all proposals inherit V, no split-decision value can ever be chosen.",
        x: 360,
        y: 360,
        ast: {
          type: "implies",
          left: { type: "var", name: "MaxVal" },
          right: { type: "var", name: "SynodAgreement" },
        },
      },
      {
        id: "E",
        label: "SynodAgreement",
        type: "conclusion",
        description:
          "Conclusion SynodAgreement: Single-Decree Paxos consistency holds with mathematical certainty.",
        meaning:
          "The target theorem: 100% formal safety guarantee against split-brain decisions.",
        x: 600,
        y: 285,
        ast: { type: "var", name: "SynodAgreement" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "MP" },
      { source: "B", target: "C", ruleApplied: "MP" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Initializing Paxos Synod Invariant Verification Engine...",
      "Inspecting Phase 1b promise responses across acceptor majority (MajQ1)...",
      "Inspecting highest-ballot value constraint (MajQ1 → MaxVal)...",
      "Applying Modus Ponens to derive proposal value binding (MaxVal)...",
      "Proposal value bound: Proposer locked to canonical value V.",
      "Connecting proposal binding with Synod Agreement invariant Node D...",
      "Applying Modus Ponens on derived Node C and Premise Node D...",
      "Discharging Conclusion Node E (SynodAgreement)...",
      "Verifying inductive hypothesis across all subsequent ballot epochs...",
      "Local Paxos deduction completed; no consensus implementation was checked.",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem paxos_synod_safety (MajQ1 MaxVal SynodAgreement : Prop)
  (hA : MajQ1)
  (hB : MajQ1 → MaxVal)
  (hD : MaxVal → SynodAgreement) : SynodAgreement := by
  have hC : MaxVal := hB hA
  exact hD hC`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$MajQ1$}
  \\AxiomC{$MajQ1 \\to MaxVal$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$MaxVal$}
  \\AxiomC{$MaxVal \\to SynodAgreement$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$SynodAgreement$}
\\end{prooftree}`,
  },

  "paxos-phase2b": {
    id: "paxos-phase2b",
    title: "Paxos Phase 2B Acceptor Quorum",
    subtitle: "Phase 2b Vote Aggregation · Irrevocable Consensus Commit",
    category: "Distributed Systems",
    ruleName:
      "Paxos Phase 2B ((PromiseB ∧ AcceptReqB) ∧ ((PromiseB ∧ AcceptReqB) → ValueChosen) ⊢ ValueChosen)",
    scenario:
      "Acceptors processing Phase 2a accept requests and committing chosen value on majority acceptance.",
    goalDescription:
      "Discharge ValueChosen invariant (Value V is chosen and permanently committed across the cluster).",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "PromiseB",
        type: "premise",
        description:
          "Premise PromiseB: Acceptors promised ballot B and have seen no higher proposal.",
        meaning:
          "Acceptor local promise invariant is active for ballot epoch B.",
        x: 120,
        y: 130,
        ast: { type: "var", name: "PromiseB" },
      },
      {
        id: "B",
        label: "AcceptReqB",
        type: "premise",
        description:
          "Premise AcceptReqB: Leader transmits Phase 2a Accept(B, V) message matching ballot B.",
        meaning:
          "Phase 2a message carries valid ballot number B and candidate value V.",
        x: 120,
        y: 290,
        ast: { type: "var", name: "AcceptReqB" },
      },
      {
        id: "C",
        label: "PromiseB ∧ AcceptReqB",
        type: "intermediate",
        description:
          "Intermediate Conclusion: ballot compatibility derived in the example, triggering Phase 2b Accepted(B, V).",
        meaning:
          "Acceptors register accept vote and emit Phase 2b acknowledgement.",
        x: 360,
        y: 210,
        ast: {
          type: "and",
          left: { type: "var", name: "PromiseB" },
          right: { type: "var", name: "AcceptReqB" },
        },
      },
      {
        id: "D",
        label: "(PromiseB ∧ AcceptReqB) → ValueChosen",
        type: "premise",
        description:
          "Premise: Gathering majority Phase 2b accept votes permanently chooses value V.",
        meaning: "Commit threshold reached: Value V is irreversibly decided.",
        x: 360,
        y: 360,
        ast: {
          type: "implies",
          left: {
            type: "and",
            left: { type: "var", name: "PromiseB" },
            right: { type: "var", name: "AcceptReqB" },
          },
          right: { type: "var", name: "ValueChosen" },
        },
      },
      {
        id: "E",
        label: "ValueChosen",
        type: "conclusion",
        description:
          "Conclusion ValueChosen: Value V is committed across the distributed state machine.",
        meaning:
          "The target theorem: 100% formal verification of Phase 2b consensus commitment.",
        x: 600,
        y: 285,
        ast: { type: "var", name: "ValueChosen" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "∧-Intro" },
      { source: "B", target: "C", ruleApplied: "∧-Intro" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Initializing Paxos Phase 2B Verification Engine...",
      "Checking Acceptor Promise state for ballot B (PromiseB)...",
      "Checking Phase 2a Accept Request for ballot B (AcceptReqB)...",
      "Applying Conjunction Introduction to derive (PromiseB ∧ AcceptReqB)...",
      "Acceptor ballot compatibility derived in the example: Phase 2b votes emitted.",
      "Linking quorum aggregation with Commit Rule Node D...",
      "Applying Modus Ponens on derived Node C and Premise Node D...",
      "Discharging final Conclusion Node E (ValueChosen)...",
      "Verifying zero uncommitted transitions across network drops...",
      "Local Phase 2B deduction completed; no consensus implementation was checked.",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem paxos_phase2b_quorum (PromiseB AcceptReqB ValueChosen : Prop)
  (hA : PromiseB)
  (hB : AcceptReqB)
  (hD : (PromiseB ∧ AcceptReqB) → ValueChosen) : ValueChosen := by
  have hC : PromiseB ∧ AcceptReqB := And.intro hA hB
  exact hD hC`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$PromiseB$}
  \\AxiomC{$AcceptReqB$}
  \\RightLabel{\\scriptsize $\\land$-Intro}
  \\BinaryInfC{$PromiseB \\land AcceptReqB$}
  \\AxiomC{$(PromiseB \\land AcceptReqB) \\to ValueChosen$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$ValueChosen$}
\\end{prooftree}`,
  },

  "bft-quorum": {
    id: "bft-quorum",
    title: "BFT 3f+1 Quorum Overlap",
    subtitle: "Pigeonhole Overlap Bound · Byzantine Equivocation Resistance",
    category: "Fault Tolerance",
    ruleName:
      "BFT Quorum ((Quorum1 ∧ Quorum2) ∧ ((Quorum1 ∧ Quorum2) → HonestOverlap) ⊢ ByzantineSafety)",
    scenario:
      "PBFT / Tendermint consensus safety in a 3f+1 network tolerating up to f arbitrary Byzantine faulty nodes.",
    goalDescription:
      "Discharge ByzantineSafety invariant: Two conflicting blocks/values can never both receive quorum certificates.",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "Quorum1",
        type: "premise",
        description:
          "Premise Quorum1: Primary quorum Q1 of 2f+1 nodes signed prepare certificate for value V1.",
        meaning: "Certificate Q1 meets 2/3 supermajority threshold in view v.",
        x: 120,
        y: 130,
        ast: { type: "var", name: "Quorum1" },
      },
      {
        id: "B",
        label: "Quorum2",
        type: "premise",
        description:
          "Premise Quorum2: Conflicting quorum Q2 of 2f+1 nodes attempts prepare certificate for V2.",
        meaning:
          "Adversary attempts to create split-brain commit with competing quorum Q2.",
        x: 120,
        y: 290,
        ast: { type: "var", name: "Quorum2" },
      },
      {
        id: "C",
        label: "HonestOverlap",
        type: "intermediate",
        description:
          "Intermediate Conclusion HonestOverlap: Q1 and Q2 intersect in at least f+1 nodes (at least 1 honest node).",
        meaning:
          "Pigeonhole bound: 2(2f+1) - (3f+1) = f+1; subtracting at most f faulty nodes leaves ≥ 1 honest node.",
        x: 360,
        y: 210,
        ast: { type: "var", name: "HonestOverlap" },
      },
      {
        id: "D",
        label: "HonestOverlap → ByzantineSafety",
        type: "premise",
        description:
          "Premise: Honest node strictly rejects double-signing conflicting values in view v.",
        meaning:
          "Byzantine equivocation refutation: Honest validator refuses to sign two different values.",
        x: 360,
        y: 360,
        ast: {
          type: "implies",
          left: { type: "var", name: "HonestOverlap" },
          right: { type: "var", name: "ByzantineSafety" },
        },
      },
      {
        id: "E",
        label: "ByzantineSafety",
        type: "conclusion",
        description:
          "Conclusion ByzantineSafety: Byzantine agreement guaranteed, preventing blockchain forks.",
        meaning:
          "The target theorem: 100% formal resilience against up to f Byzantine malicious nodes.",
        x: 600,
        y: 285,
        ast: { type: "var", name: "ByzantineSafety" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "BFT-Quorum" },
      { source: "B", target: "C", ruleApplied: "BFT-Quorum" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Initializing Byzantine Fault Tolerance Quorum Verification Engine...",
      "Evaluating Quorum 1 size: 2f + 1 nodes (Quorum1)...",
      "Evaluating Conflicting Quorum 2 size: 2f + 1 nodes (Quorum2)...",
      "Calculating Pigeonhole overlap in 3f + 1 total cluster: (2f+1) + (2f+1) - (3f+1) = f + 1...",
      "Subtracting maximum f Byzantine faulty nodes: at least 1 honest non-faulty node guaranteed (HonestOverlap)...",
      "Inspecting honest validator double-signing prevention rule Node D...",
      "Applying Modus Ponens on derived Node C and Premise Node D...",
      "Discharging final Conclusion Node E (ByzantineSafety)...",
      "Verifying complete fork-freedom and equivocation resistance...",
      "Local 3f+1 quorum deduction completed; no BFT implementation was checked.",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem bft_3f_plus_1_quorum_safety (Quorum1 Quorum2 HonestOverlap ByzantineSafety : Prop)
  (hA : Quorum1)
  (hB : Quorum2)
  (hOverlap : Quorum1 → Quorum2 → HonestOverlap)
  (hD : HonestOverlap → ByzantineSafety) : ByzantineSafety := by
  have hC : HonestOverlap := hOverlap hA hB
  exact hD hC`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$Quorum1$}
  \\AxiomC{$Quorum2$}
  \\RightLabel{\\scriptsize BFT-Quorum}
  \\BinaryInfC{$HonestOverlap$}
  \\AxiomC{$HonestOverlap \\to ByzantineSafety$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$ByzantineSafety$}
\\end{prooftree}`,
  },

  custom: {
    id: "custom",
    title: "Custom Invariant Studio",
    subtitle: "Interactive Free-Form Propositional Prover",
    category: "Custom Studio",
    ruleName: "Custom User Proof",
    scenario:
      "Author custom software propositions, assemble natural deduction proofs, and auto-solve.",
    goalDescription:
      "Construct a formal natural deduction derivation for custom assertions.",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    nodes: [
      {
        id: "A",
        label: "P",
        type: "premise",
        description: "Custom Premise 1",
        meaning: "User-defined starting hypothesis",
        x: 120,
        y: 130,
        ast: { type: "var", name: "P" },
      },
      {
        id: "B",
        label: "P → Q",
        type: "premise",
        description: "Custom Premise 2",
        meaning: "User-defined implication",
        x: 120,
        y: 290,
        ast: {
          type: "implies",
          left: { type: "var", name: "P" },
          right: { type: "var", name: "Q" },
        },
      },
      {
        id: "C",
        label: "Q",
        type: "intermediate",
        description: "Derived Lemma",
        meaning: "Derived intermediate step",
        x: 360,
        y: 210,
        ast: { type: "var", name: "Q" },
      },
      {
        id: "D",
        label: "Q → R",
        type: "premise",
        description: "Custom Premise 3",
        meaning: "User-defined target bridge",
        x: 360,
        y: 360,
        ast: {
          type: "implies",
          left: { type: "var", name: "Q" },
          right: { type: "var", name: "R" },
        },
      },
      {
        id: "E",
        label: "R",
        type: "conclusion",
        description: "Custom Goal",
        meaning: "Target assertion to be proven",
        x: 600,
        y: 285,
        ast: { type: "var", name: "R" },
      },
    ],
    initialEdges: [
      { source: "A", target: "C", ruleApplied: "MP" },
      { source: "B", target: "C", ruleApplied: "MP" },
    ],
    validPairs: [
      ["A", "C"],
      ["C", "A"],
      ["B", "C"],
      ["C", "B"],
      ["C", "E"],
      ["E", "C"],
      ["D", "E"],
      ["E", "D"],
    ],
    simulationSteps: [
      "Parsing custom proposition AST...",
      "Evaluating premise consistency via SAT table...",
      "Applying natural deduction inference tactics...",
      "Custom goal discharged successfully (Q.E.D.)",
    ],
    leanCode: `-- Generated Lean 4 draft; not compiler-checked
theorem custom_proof (P Q R : Prop)
  (hA : P)
  (hB : P → Q)
  (hD : Q → R) : R := by
  have hC : Q := hB hA
  exact hD hC`,
    latexCode: `\\begin{prooftree}
  \\AxiomC{$P$}
  \\AxiomC{$P \\to Q$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$Q$}
  \\AxiomC{$Q \\to R$}
  \\RightLabel{\\scriptsize MP}
  \\BinaryInfC{$R$}
\\end{prooftree}`,
  },
};

/**
 * Checks if a given string is a valid Node ID.
 */
export function isValidNode(nodeId: string): boolean {
  if (!nodeId) return false;
  return VALID_NODE_IDS.includes(nodeId.toUpperCase());
}

/**
 * Calculates inline autocomplete suggestion based on current console input and active theorem.
 */
export function getSuggestion(
  inputVal: string,
  _theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): string {
  const trimmed = inputVal.trim();
  if (!inputVal) return "";

  const tokens = inputVal.split(/\s+/);
  const firstWord = tokens[0].toLowerCase();

  // Typing command name
  if (tokens.length === 1 && !inputVal.endsWith(" ")) {
    const match = VALID_COMMANDS.find((cmd) =>
      cmd.startsWith(trimmed.toLowerCase())
    );
    if (match && match !== trimmed.toLowerCase()) {
      return match;
    }
  }

  // Connect or Disconnect command
  if (
    tokens.length > 1 &&
    (firstWord === "connect" || firstWord === "disconnect")
  ) {
    const secondWord = tokens[1]?.toUpperCase() || "";
    const thirdWord = tokens[2]?.toUpperCase() || "";

    if (tokens.length === 2 && !inputVal.endsWith(" ")) {
      const matchNode = VALID_NODE_IDS.find((id) => id.startsWith(secondWord));
      if (matchNode && matchNode !== secondWord) {
        return `${tokens[0]} ${matchNode}`;
      }
      if (VALID_NODE_IDS.includes(secondWord)) {
        return `${tokens[0]} ${secondWord} `;
      }
    }

    if (tokens.length === 2 && inputVal.endsWith(" ")) {
      return `${tokens[0]} ${secondWord} `;
    }

    if (tokens.length === 3 && !inputVal.endsWith(" ")) {
      const matchNode = VALID_NODE_IDS.find((id) => id.startsWith(thirdWord));
      if (matchNode && matchNode !== tokens[2]) {
        return `${tokens[0]} ${tokens[1]} ${matchNode}`;
      }
    }
  }

  // Apply rule command
  if (tokens.length > 1 && firstWord === "apply") {
    const secondWord = tokens[1]?.toLowerCase() || "";
    const rules = [
      "mp",
      "mt",
      "hs",
      "ds",
      "res",
      "demorgan",
      "and_intro",
      "and_elim",
      "raa",
    ];
    if (tokens.length === 2 && !inputVal.endsWith(" ")) {
      const matchRule = rules.find((r) => r.startsWith(secondWord));
      if (matchRule && matchRule !== secondWord) {
        return `${tokens[0]} ${matchRule}`;
      }
    }
  }

  // Switch or theorem command
  if (
    tokens.length > 1 &&
    (firstWord === "theorem" || firstWord === "switch")
  ) {
    const secondWord = tokens[1]?.toLowerCase() || "";
    const theoremKeys: string[] = [
      "mp",
      "mt",
      "hs",
      "ds",
      "res",
      "2pc",
      "quorum",
      "cache",
      "synod",
      "paxos",
      "paxos-synod",
      "phase2b",
      "paxos-phase2b",
      "paxos2b",
      "2b",
      "bft",
      "bft-quorum",
      "pbft",
      "pbft-quorum",
      "modus-ponens",
      "modus-tollens",
      "hypothetical-syllogism",
      "disjunctive-syllogism",
      "resolution",
      "two-phase-commit",
      "quorum-overlap",
      "cache-consistency",
      "custom",
    ];
    if (tokens.length === 2 && !inputVal.endsWith(" ")) {
      const matchTh = theoremKeys.find((t) => t.startsWith(secondWord));
      if (matchTh && matchTh !== secondWord) {
        return `${tokens[0]} ${matchTh}`;
      }
    }
  }

  // Inspect command
  if (tokens.length > 1 && firstWord === "inspect") {
    const secondWord = tokens[1]?.toUpperCase() || "";
    if (tokens.length === 2 && !inputVal.endsWith(" ")) {
      const matchNode = VALID_NODE_IDS.find((id) => id.startsWith(secondWord));
      if (matchNode && matchNode !== secondWord) {
        return `${tokens[0]} ${matchNode}`;
      }
    }
  }

  // Export command
  if (tokens.length > 1 && firstWord === "export") {
    const secondWord = tokens[1]?.toLowerCase() || "";
    const formats = ["lean", "latex", "markdown", "mermaid"];
    if (tokens.length === 2 && !inputVal.endsWith(" ")) {
      const matchFmt = formats.find((f) => f.startsWith(secondWord));
      if (matchFmt && matchFmt !== secondWord) {
        return `${tokens[0]} ${matchFmt}`;
      }
    }
  }

  // Simulate command
  if (firstWord === "simulate") {
    const secondWord = tokens[1]?.toLowerCase() || "";
    if (tokens.length === 2 && !inputVal.endsWith(" ")) {
      const subCommands = ["normal", "loop"];
      const matchSub = subCommands.find((sub) => sub.startsWith(secondWord));
      if (matchSub && matchSub !== secondWord) {
        return `${tokens[0]} ${matchSub}`;
      }
    }
    if (tokens.length === 2 && inputVal.endsWith(" ")) {
      return `${tokens[0]} normal`;
    }
  }

  // Prune or delete-step command
  if (firstWord === "prune" || firstWord === "delete-step") {
    const secondWord = tokens[1]?.toUpperCase() || "";
    const options = ["3", "5", "C", "E"];
    if (tokens.length === 2 && !inputVal.endsWith(" ")) {
      const matchOpt = options.find((opt) => opt.startsWith(secondWord));
      if (matchOpt && matchOpt !== secondWord) {
        return `${tokens[0]} ${matchOpt}`;
      }
    }
  }

  return "";
}

/**
 * Evaluates proof logical completion status based on graph edges and ASTs.
 */
export function evaluateProofStatus(
  edges: Edge[],
  theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): { isC_Proven: boolean; isE_Proven: boolean } {
  const th =
    typeof theoremId === "object"
      ? theoremId
      : THEOREMS[theoremId] || THEOREMS["modus-ponens"];

  const [req1, req2] = th.intermediateRequires;
  const hasReq1ToInter = edges.some(
    (e) =>
      (e.source === req1 && e.target === th.intermediateNodeId) ||
      (e.source === th.intermediateNodeId && e.target === req1)
  );
  const hasReq2ToInter = edges.some(
    (e) =>
      (e.source === req2 && e.target === th.intermediateNodeId) ||
      (e.source === th.intermediateNodeId && e.target === req2)
  );
  const isC_Proven = hasReq1ToInter && hasReq2ToInter;

  const [cReq1, cReq2] = th.conclusionRequires;
  const hasCReq1ToConcl = edges.some(
    (e) =>
      (e.source === cReq1 && e.target === th.targetNodeId) ||
      (e.source === th.targetNodeId && e.target === cReq1)
  );
  const hasCReq2ToConcl = edges.some(
    (e) =>
      (e.source === cReq2 && e.target === th.targetNodeId) ||
      (e.source === th.targetNodeId && e.target === cReq2)
  );
  const isE_Proven = isC_Proven && hasCReq1ToConcl && hasCReq2ToConcl;

  return { isC_Proven, isE_Proven };
}

/**
 * Checks if two nodes can be connected logically and returns validation status.
 */
export function canConnect(
  sourceId: string,
  targetId: string,
  edges: Edge[],
  theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): { allowed: boolean; reason?: string } {
  const s = sourceId.toUpperCase();
  const t = targetId.toUpperCase();
  const th =
    typeof theoremId === "object"
      ? theoremId
      : THEOREMS[theoremId] || THEOREMS["modus-ponens"];

  if (s === t) {
    return { allowed: false, reason: "Cannot connect a node to itself." };
  }

  const alreadyConnected = edges.some(
    (e) =>
      (e.source === s && e.target === t) || (e.source === t && e.target === s)
  );
  if (alreadyConnected) {
    return {
      allowed: false,
      reason: `Node ${s} and Node ${t} are already connected.`,
    };
  }

  const isValidPair = th.validPairs.some(([p1, p2]) => p1 === s && p2 === t);
  if (!isValidPair) {
    return {
      allowed: false,
      reason: `No valid deductive inference rule links Node ${s} directly to Node ${t}.`,
    };
  }

  return { allowed: true };
}

/**
 * Diagnoses formal logical fallacies and synthesizes counterexample truth table rows.
 */
export function getFallacyDiagnosis(
  sourceId: string,
  targetId: string,
  _edges: Edge[],
  _theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): FallacyDiagnosis {
  const s = sourceId.toUpperCase();
  const t = targetId.toUpperCase();
  if (typeof _theoremId === "object" && _theoremId.id === "custom") {
    const source = _theoremId.nodes.find((node) => node.id === s);
    const target = _theoremId.nodes.find((node) => node.id === t);
    if (source?.ast && target?.ast) {
      const premises = [
        {
          label: source.label,
          ast: source.ast,
          description: source.description,
        },
      ];
      const conclusion = {
        label: target.label,
        ast: target.ast,
        description: target.description,
      };
      const table = generateTruthTable(premises, conclusion);
      return {
        fallacyName: "Unsupported custom connection",
        formalFormula: `${source.label} ⊢ ${target.label}`,
        plainEnglish:
          "Use the validated intermediate and goal dependencies; a single edge does not establish the required inference.",
        softwareAnalogy:
          "A dependent operation needs all of its prerequisites.",
        premises,
        conclusion,
        ...table,
      };
    }
  }

  // Circular Reasoning
  if (s === t) {
    const premises: FallacyFormulaAst[] = [
      {
        label: `Premise 1: ${s}`,
        ast: { type: "var", name: "P" },
        description: `Node ${s} asserted without independent proof justification.`,
      },
      {
        label: `Premise 2: ${s}`,
        ast: { type: "var", name: "P" },
        description: `Self-referential dependency on Node ${s}.`,
      },
    ];
    const conclusion: FallacyFormulaAst = {
      label: `Conclusion: ${s}`,
      ast: { type: "var", name: "P" },
      description: `Target Node ${s} assumed from self-reference.`,
    };
    const { truthTable, variables } = generateTruthTable(premises, conclusion);
    const enhancedTable = truthTable.map((r) =>
      !r.p && !r.conclusion ? { ...r, isCounterexample: true } : r
    );

    return {
      fallacyName: "Fallacy of Circular Reasoning (Petitio Principii)",
      formalFormula: "P ⊢ P (Tautological Self-Reference)",
      plainEnglish: `Connecting Node ${s} directly to itself creates an invalid recursive feedback loop without establishing an external premise justification.`,
      softwareAnalogy:
        "Circular dependency in module imports: A depends on A, causing a runtime bootstrap deadlock.",
      premises,
      conclusion,
      variables,
      truthTable: enhancedTable,
      counterexampleValuation: { P: false, Q: false },
    };
  }

  // Affirming the Consequent
  if ((s === "C" && t === "A") || (s === "E" && t === "C")) {
    const premises: FallacyFormulaAst[] = [
      {
        label: "Premise 1: P → Q",
        ast: {
          type: "implies",
          left: { type: "var", name: "P" },
          right: { type: "var", name: "Q" },
        },
        description:
          "If the antecedent condition P occurs, consequent Q follows.",
      },
      {
        label: "Premise 2: Q",
        ast: { type: "var", name: "Q" },
        description: "Consequent Q is observed or asserted as true.",
      },
    ];
    const conclusion: FallacyFormulaAst = {
      label: "Conclusion: P",
      ast: { type: "var", name: "P" },
      description:
        "Erroneously inferring that antecedent P was the sole cause.",
    };
    const { truthTable, variables, counterexampleValuation } =
      generateTruthTable(premises, conclusion);

    return {
      fallacyName: "Fallacy of Affirming the Consequent",
      formalFormula: "((P → Q) ∧ Q) ⊬ P",
      plainEnglish: `Assuming that because the outcome (${t}) occurred, the specific initial cause (${s}) must have been the sole trigger. Other independent factors could have caused the same outcome.`,
      softwareAnalogy:
        "Observing that regression tests passed does not prove that all possible edge cases were tested: a missing test case could simply have been omitted.",
      premises,
      conclusion,
      variables,
      truthTable,
      counterexampleValuation: counterexampleValuation || { P: false, Q: true },
    };
  }

  // Denying the Antecedent
  if (s === "A" && t === "D") {
    const premises: FallacyFormulaAst[] = [
      {
        label: "Premise 1: P → Q",
        ast: {
          type: "implies",
          left: { type: "var", name: "P" },
          right: { type: "var", name: "Q" },
        },
        description: "If antecedent P occurs, consequent Q follows.",
      },
      {
        label: "Premise 2: ¬P",
        ast: { type: "not", operand: { type: "var", name: "P" } },
        description: "Antecedent P is denied or false.",
      },
    ];
    const conclusion: FallacyFormulaAst = {
      label: "Conclusion: ¬Q",
      ast: { type: "not", operand: { type: "var", name: "Q" } },
      description: "Erroneously inferring that consequent Q cannot occur.",
    };
    const { truthTable, variables, counterexampleValuation } =
      generateTruthTable(premises, conclusion);

    return {
      fallacyName: "Fallacy of Denying the Antecedent",
      formalFormula: "((P → Q) ∧ ¬P) ⊬ ¬Q",
      plainEnglish: `Assuming that if the antecedent condition is not met, the consequence cannot occur. The consequence might still happen via other mechanisms.`,
      softwareAnalogy:
        "If you don't run tests on commit (¬P), that doesn't mean zero bugs were caught (¬Q); an automated compiler lint or canary build could have caught them.",
      premises,
      conclusion,
      variables,
      truthTable,
      counterexampleValuation: counterexampleValuation || { P: false, Q: true },
    };
  }

  // Incompatible Terms / Non Sequitur
  const premises: FallacyFormulaAst[] = [
    {
      label: `Premise 1: Node ${s}`,
      ast: { type: "var", name: "P" },
      description: `Assertion of Node ${s} within active graph context.`,
    },
    {
      label: "Premise 2: ¬Q (Independent)",
      ast: { type: "not", operand: { type: "var", name: "Q" } },
      description: `Target Node ${t} is independently unconstrained or false.`,
    },
  ];
  const conclusion: FallacyFormulaAst = {
    label: `Conclusion: Node ${t}`,
    ast: { type: "var", name: "Q" },
    description: `Unjustified deduction of Node ${t} from Node ${s}.`,
  };
  const { truthTable, variables, counterexampleValuation } = generateTruthTable(
    premises,
    conclusion
  );

  return {
    fallacyName: "Fallacy of Incompatible Terms (Non Sequitur)",
    formalFormula: `Node ${s} ⊬ Node ${t}`,
    plainEnglish: `There is no valid deductive inference rule linking Node ${s} directly to Node ${t} in the active theorem.`,
    softwareAnalogy:
      "Type mismatch in function signatures: passing an unrelated variable type into an incompatible parameter socket.",
    premises,
    conclusion,
    variables,
    truthTable,
    counterexampleValuation: counterexampleValuation || { P: true, Q: false },
  };
}

/**
 * Returns contextual step-by-step tactic hint for guided proof assistant.
 */
export function getNextTacticHint(
  edges: Edge[],
  theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): TacticHint {
  const th =
    typeof theoremId === "object"
      ? theoremId
      : THEOREMS[theoremId] || THEOREMS["modus-ponens"];
  const { isE_Proven } = evaluateProofStatus(edges, theoremId);

  if (isE_Proven) {
    return {
      stepNumber: 3,
      title: `Q.E.D. ${th.title} Fully Discharged!`,
      hint: `All premises are satisfied. ${th.nodes.find((n) => n.id === th.targetNodeId)?.description || "Target conclusion is proven with mathematical certainty."}`,
      suggestedRule: "Q.E.D.",
      isCompleted: true,
    };
  }

  const [req1, req2] = th.intermediateRequires;
  const hasReq1 = edges.some(
    (e) =>
      (e.source === req1 && e.target === th.intermediateNodeId) ||
      (e.source === th.intermediateNodeId && e.target === req1)
  );
  const hasReq2 = edges.some(
    (e) =>
      (e.source === req2 && e.target === th.intermediateNodeId) ||
      (e.source === th.intermediateNodeId && e.target === req2)
  );

  const node1 = th.nodes.find((n) => n.id === req1);
  const node2 = th.nodes.find((n) => n.id === req2);
  const interNode = th.nodes.find((n) => n.id === th.intermediateNodeId);

  if (!hasReq1) {
    return {
      stepNumber: 1,
      title: `Establish Premise ${node1?.label || req1} → Intermediate ${interNode?.label || th.intermediateNodeId}`,
      hint: `Connect Node ${req1} (${node1?.description}) to Node ${th.intermediateNodeId} (${interNode?.label}).`,
      suggestedSource: req1,
      suggestedTarget: th.intermediateNodeId,
      suggestedRule: th.ruleName.split("(")[0].trim(),
      isCompleted: false,
    };
  }

  if (!hasReq2) {
    return {
      stepNumber: 1,
      title: `Establish Premise ${node2?.label || req2} → Intermediate ${interNode?.label || th.intermediateNodeId}`,
      hint: `Connect Node ${req2} (${node2?.description}) to Node ${th.intermediateNodeId} (${interNode?.label}) to discharge inference step 1.`,
      suggestedSource: req2,
      suggestedTarget: th.intermediateNodeId,
      suggestedRule: th.ruleName.split("(")[0].trim(),
      isCompleted: false,
    };
  }

  const [cReq1, cReq2] = th.conclusionRequires;
  const hasCReq1 = edges.some(
    (e) =>
      (e.source === cReq1 && e.target === th.targetNodeId) ||
      (e.source === th.targetNodeId && e.target === cReq1)
  );
  const hasCReq2 = edges.some(
    (e) =>
      (e.source === cReq2 && e.target === th.targetNodeId) ||
      (e.source === th.targetNodeId && e.target === cReq2)
  );

  const cNode1 = th.nodes.find((n) => n.id === cReq1);
  const cNode2 = th.nodes.find((n) => n.id === cReq2);
  const targetNode = th.nodes.find((n) => n.id === th.targetNodeId);

  if (!hasCReq1) {
    return {
      stepNumber: 2,
      title: `Link Derived Antecedent ${cNode1?.label || cReq1} → Goal ${targetNode?.label || th.targetNodeId}`,
      hint: `Node ${cReq1} (${cNode1?.label}) is proven! Now connect Node ${cReq1} to Node ${th.targetNodeId} (${targetNode?.description}).`,
      suggestedSource: cReq1,
      suggestedTarget: th.targetNodeId,
      suggestedRule: targetNode?.ruleUsed ?? "Modus Ponens",
      isCompleted: false,
    };
  }

  if (!hasCReq2) {
    return {
      stepNumber: 2,
      title: `Link Conditional Premise ${cNode2?.label || cReq2} → Goal ${targetNode?.label || th.targetNodeId}`,
      hint: `Connect Node ${cReq2} (${cNode2?.description}) to Node ${th.targetNodeId} (${targetNode?.label}).`,
      suggestedSource: cReq2,
      suggestedTarget: th.targetNodeId,
      suggestedRule: targetNode?.ruleUsed ?? "Modus Ponens",
      isCompleted: false,
    };
  }

  return {
    stepNumber: 3,
    title: "Graph Complete (Local Simulation)",
    hint: `Conclusion ${targetNode?.label} is established.`,
    suggestedRule: "Q.E.D.",
    isCompleted: true,
  };
}

/**
 * Constructs the multi-row formal deduction ledger table for the active theorem.
 */
export function getDeductionLedger(
  edges: Edge[],
  theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): LedgerStep[] {
  const th =
    typeof theoremId === "object"
      ? theoremId
      : THEOREMS[theoremId] || THEOREMS["modus-ponens"];
  const { isC_Proven, isE_Proven } = evaluateProofStatus(edges, theoremId);

  const nA = th.nodes.find((n) => n.id === "A");
  const nB = th.nodes.find((n) => n.id === "B");
  const nC = th.nodes.find((n) => n.id === "C");
  const nD = th.nodes.find((n) => n.id === "D");
  const nE = th.nodes.find((n) => n.id === "E");

  return [
    {
      stepNumber: 1,
      formula: nA?.label || "P",
      rule: "Premise 1",
      premises: "Given",
      plainEnglish: nA?.description || "Initial premise established.",
      isProven: true,
      nodeId: nA?.id || "A",
      isDeletable: false,
    },
    {
      stepNumber: 2,
      formula: nB?.label || "P → Q",
      rule: "Premise 2",
      premises: "Given",
      plainEnglish: nB?.description || "Conditional implication premise.",
      isProven: true,
      nodeId: nB?.id || "B",
      isDeletable: false,
    },
    {
      stepNumber: 3,
      formula: nC?.label || "Q",
      rule: th.ruleName.split("(")[0].trim(),
      premises: "Lines [1, 2]",
      plainEnglish: nC?.meaning || "Derived intermediate conclusion.",
      isProven: isC_Proven,
      nodeId: nC?.id || "C",
      isDeletable: isC_Proven,
    },
    {
      stepNumber: 4,
      formula: nD?.label || "Q → R",
      rule: "Premise 3",
      premises: "Given",
      plainEnglish: nD?.description || "Goal conditional premise.",
      isProven: true,
      nodeId: nD?.id || "D",
      isDeletable: false,
    },
    {
      stepNumber: 5,
      formula: nE?.label || "R",
      rule: nE?.ruleUsed ?? "Modus Ponens",
      premises: "Lines [3, 4]",
      plainEnglish:
        nE?.meaning || "Target conclusion proven with mathematical certainty.",
      isProven: isE_Proven,
      nodeId: nE?.id || "E",
      isDeletable: isE_Proven,
    },
  ];
}

/**
 * Result object returned when pruning a deduction step or node.
 */
export interface PruneResult {
  success: boolean;
  newEdges: Edge[];
  prunedCount: number;
  prunedNodeId?: string;
  prunedStepNumber?: number;
  targetLabel?: string;
  reason: string;
}

/**
 * Prunes an intermediate lemma or conclusion deduction step and recursively removes dependent edges in the DAG.
 * Foundational premises are immutable axioms and cannot be deleted.
 */
export function pruneStepOrNode(
  stepOrNode: number | string,
  edges: Edge[],
  theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): PruneResult {
  const th =
    typeof theoremId === "object"
      ? theoremId
      : THEOREMS[theoremId] || THEOREMS["modus-ponens"];

  let targetNodeId: string;
  let targetStepNum: number | undefined;

  const rawStr =
    typeof stepOrNode === "string" ? stepOrNode.trim() : String(stepOrNode);
  const parsedNum = parseInt(rawStr, 10);

  if (!Number.isNaN(parsedNum) && String(parsedNum) === rawStr) {
    targetStepNum = parsedNum;
    if (parsedNum === 1) targetNodeId = "A";
    else if (parsedNum === 2) targetNodeId = "B";
    else if (parsedNum === 3) targetNodeId = th.intermediateNodeId || "C";
    else if (parsedNum === 4) targetNodeId = "D";
    else if (parsedNum === 5) targetNodeId = th.targetNodeId || "E";
    else {
      return {
        success: false,
        newEdges: edges,
        prunedCount: 0,
        reason: `Step ${parsedNum} is out of bounds (valid steps: 1 to 5).`,
      };
    }
  } else {
    targetNodeId = rawStr.toUpperCase();
    if (targetNodeId === "A") targetStepNum = 1;
    else if (targetNodeId === "B") targetStepNum = 2;
    else if (targetNodeId === (th.intermediateNodeId || "C").toUpperCase())
      targetStepNum = 3;
    else if (targetNodeId === "D") targetStepNum = 4;
    else if (targetNodeId === (th.targetNodeId || "E").toUpperCase())
      targetStepNum = 5;
  }

  const targetNode = th.nodes.find((n) => n.id.toUpperCase() === targetNodeId);
  if (!targetNode) {
    return {
      success: false,
      newEdges: edges,
      prunedCount: 0,
      reason: `Node '${targetNodeId}' not found in active theorem '${th.title}'.`,
    };
  }

  if (
    targetNode.type === "premise" ||
    targetStepNum === 1 ||
    targetStepNum === 2 ||
    targetStepNum === 4
  ) {
    return {
      success: false,
      newEdges: edges,
      prunedCount: 0,
      prunedNodeId: targetNode.id,
      prunedStepNumber: targetStepNum,
      targetLabel: targetNode.label,
      reason: `Step ${targetStepNum ?? targetNode.id} (${targetNode.label}) is a foundational premise and immutable axiom. Only derived steps (intermediate lemmas and conclusions) can be pruned.`,
    };
  }

  // Full DAG Cascade:
  // Remove all edges directly connected to targetNodeId (incoming and outgoing)
  const newEdges = edges.filter(
    (e) =>
      e.source.toUpperCase() !== targetNodeId &&
      e.target.toUpperCase() !== targetNodeId
  );

  const prunedCount = edges.length - newEdges.length;

  return {
    success: true,
    newEdges,
    prunedCount,
    prunedNodeId: targetNode.id,
    prunedStepNumber: targetStepNum,
    targetLabel: targetNode.label,
    reason:
      prunedCount > 0
        ? `Pruned Step ${targetStepNum ?? targetNode.id} (${targetNode.label}) and ${prunedCount} dependent edge(s).`
        : `Step ${targetStepNum ?? targetNode.id} (${targetNode.label}) had no active edges to prune.`,
  };
}

/**
 * Attempts to apply an inference rule to given AST premises and returns the derived AST.
 */
export function applyRuleToAsts(
  ruleId: string,
  inputs: PropAst[]
): { success: boolean; resultAst?: PropAst; explanation?: string } {
  const normRule = ruleId.toLowerCase();

  // Modus Ponens: P and P -> Q  =>  Q
  if (normRule === "mp" || normRule === "modus-ponens") {
    if (inputs.length !== 2)
      return {
        success: false,
        explanation: "Modus Ponens requires exactly 2 premises (P and P → Q).",
      };
    const [p1, p2] = inputs;
    if (p2.type === "implies" && areAstsEqual(p1, p2.left)) {
      return {
        success: true,
        resultAst: p2.right,
        explanation: `Derived ${formatFormula(p2.right)} via Modus Ponens.`,
      };
    }
    if (p1.type === "implies" && areAstsEqual(p2, p1.left)) {
      return {
        success: true,
        resultAst: p1.right,
        explanation: `Derived ${formatFormula(p1.right)} via Modus Ponens.`,
      };
    }
    return {
      success: false,
      explanation: "Premises do not match Modus Ponens form (P and P → Q).",
    };
  }

  // Modus Tollens: P -> Q and ¬Q  =>  ¬P
  if (normRule === "mt" || normRule === "modus-tollens") {
    if (inputs.length !== 2)
      return {
        success: false,
        explanation:
          "Modus Tollens requires exactly 2 premises (P → Q and ¬Q).",
      };
    const [p1, p2] = inputs;
    if (
      p1.type === "implies" &&
      p2.type === "not" &&
      areAstsEqual(p1.right, p2.operand)
    ) {
      return {
        success: true,
        resultAst: { type: "not", operand: p1.left },
        explanation: `Derived ¬(${formatFormula(p1.left)}) via Modus Tollens.`,
      };
    }
    if (
      p2.type === "implies" &&
      p1.type === "not" &&
      areAstsEqual(p2.right, p1.operand)
    ) {
      return {
        success: true,
        resultAst: { type: "not", operand: p2.left },
        explanation: `Derived ¬(${formatFormula(p2.left)}) via Modus Tollens.`,
      };
    }
    return {
      success: false,
      explanation: "Premises do not match Modus Tollens form (P → Q and ¬Q).",
    };
  }

  // Hypothetical Syllogism: P -> Q and Q -> R  =>  P -> R
  if (normRule === "hs" || normRule === "hypothetical-syllogism") {
    if (inputs.length !== 2)
      return {
        success: false,
        explanation:
          "Hypothetical Syllogism requires 2 implications (P → Q and Q → R).",
      };
    const [p1, p2] = inputs;
    if (p1.type === "implies" && p2.type === "implies") {
      if (areAstsEqual(p1.right, p2.left)) {
        return {
          success: true,
          resultAst: { type: "implies", left: p1.left, right: p2.right },
          explanation: `Derived ${formatFormula(p1.left)} → ${formatFormula(p2.right)} via Hypothetical Syllogism.`,
        };
      }
      if (areAstsEqual(p2.right, p1.left)) {
        return {
          success: true,
          resultAst: { type: "implies", left: p2.left, right: p1.right },
          explanation: `Derived ${formatFormula(p2.left)} → ${formatFormula(p1.right)} via Hypothetical Syllogism.`,
        };
      }
    }
    return {
      success: false,
      explanation: "Premises do not chain transitively (P → Q and Q → R).",
    };
  }

  // Disjunctive Syllogism: P ∨ Q and ¬P  =>  Q
  if (normRule === "ds" || normRule === "disjunctive-syllogism") {
    if (inputs.length !== 2)
      return {
        success: false,
        explanation: "Disjunctive Syllogism requires (P ∨ Q and ¬P or ¬Q).",
      };
    const [p1, p2] = inputs;
    const orNode = p1.type === "or" ? p1 : p2.type === "or" ? p2 : null;
    const notNode = p1.type === "not" ? p1 : p2.type === "not" ? p2 : null;
    if (orNode && notNode) {
      if (areAstsEqual(orNode.left, notNode.operand)) {
        return {
          success: true,
          resultAst: orNode.right,
          explanation: `Derived ${formatFormula(orNode.right)} via Disjunctive Syllogism.`,
        };
      }
      if (areAstsEqual(orNode.right, notNode.operand)) {
        return {
          success: true,
          resultAst: orNode.left,
          explanation: `Derived ${formatFormula(orNode.left)} via Disjunctive Syllogism.`,
        };
      }
    }
    return {
      success: false,
      explanation:
        "Premises do not match Disjunctive Syllogism form (P ∨ Q and ¬P).",
    };
  }

  // Conjunction Introduction: P and Q => P ∧ Q
  if (normRule === "and_intro" || normRule === "conjunction-intro") {
    if (inputs.length !== 2)
      return {
        success: false,
        explanation: "Conjunction Intro requires 2 propositions.",
      };
    return {
      success: true,
      resultAst: { type: "and", left: inputs[0], right: inputs[1] },
      explanation: `Combined into ${formatFormula(inputs[0])} ∧ ${formatFormula(inputs[1])}.`,
    };
  }

  // Clausal Resolution: A ∨ B and ¬A ∨ C => B ∨ C
  if (normRule === "res" || normRule === "resolution") {
    if (inputs.length !== 2)
      return {
        success: false,
        explanation: "Resolution requires 2 disjunctive clauses.",
      };
    const [c1, c2] = inputs;
    // Handle binary clauses or unit literals
    const getLiterals = (ast: PropAst): PropAst[] => {
      if (ast.type === "or")
        return [...getLiterals(ast.left), ...getLiterals(ast.right)];
      return [ast];
    };
    const lits1 = getLiterals(c1);
    const lits2 = getLiterals(c2);

    for (const l1 of lits1) {
      for (const l2 of lits2) {
        // Check complementary: l1 is not l2 or l2 is not l1
        const isComp =
          (l1.type === "not" && areAstsEqual(l1.operand, l2)) ||
          (l2.type === "not" && areAstsEqual(l2.operand, l1));
        if (isComp) {
          const rem1 = lits1.filter((l) => l !== l1);
          const rem2 = lits2.filter((l) => l !== l2);
          const remaining = [...rem1, ...rem2];
          if (remaining.length === 0) {
            return {
              success: true,
              resultAst: { type: "bottom" },
              explanation:
                "Derived contradiction ⊥ (Empty Clause □) via Resolution Refutation.",
            };
          }
          if (remaining.length === 1) {
            return {
              success: true,
              resultAst: remaining[0],
              explanation: `Derived unit resolvent ${formatFormula(remaining[0])} via Resolution.`,
            };
          }
          let resAst: PropAst = remaining[0];
          for (let i = 1; i < remaining.length; i++) {
            resAst = { type: "or", left: resAst, right: remaining[i] };
          }
          return {
            success: true,
            resultAst: resAst,
            explanation: `Derived resolvent ${formatFormula(resAst)} via Resolution.`,
          };
        }
      }
    }
    return {
      success: false,
      explanation:
        "No complementary literals found across clauses for Resolution.",
    };
  }

  return { success: false, explanation: `Unknown rule '${ruleId}'.` };
}

/**
 * Exports the active theorem proof into Lean 4 verification syntax.
 */
export function exportProofToLean4(
  theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): string {
  const th =
    typeof theoremId === "object"
      ? theoremId
      : THEOREMS[theoremId] || THEOREMS["modus-ponens"];
  return th.leanCode;
}

/**
 * Exports the active theorem proof into LaTeX natural deduction syntax.
 */
export function exportProofToLatex(
  theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): string {
  const th =
    typeof theoremId === "object"
      ? theoremId
      : THEOREMS[theoremId] || THEOREMS["modus-ponens"];
  return th.latexCode;
}

/**
 * Export the current graph state without representing an unfinished or custom
 * workspace as a completed proof certificate.
 */
export function exportWorkspaceProof(
  format: "lean" | "latex" | "markdown" | "mermaid",
  edges: Edge[],
  theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): string {
  if (theoremId === "custom") {
    return "CUSTOM WORKSPACE UNAVAILABLE: Entered formulas are not yet loaded into the proof graph, so no faithful export can be generated.";
  }

  const complete = evaluateProofStatus(edges, theoremId).isE_Proven;
  if (format === "lean") {
    return complete
      ? `-- Graph complete in the local simulator; generated script is not checked by the Lean kernel.\n${exportProofToLean4(theoremId)}`
      : "-- INCOMPLETE: Finish the current graph before exporting a Lean proof template.";
  }
  if (format === "latex") {
    return complete
      ? `% Graph complete in the local simulator; generated derivation has not been independently checked.\n${exportProofToLatex(theoremId)}`
      : "% INCOMPLETE: Finish the current graph before exporting a LaTeX proof template.";
  }
  return format === "markdown"
    ? exportProofToMarkdown(edges, theoremId)
    : exportProofToMermaid(edges, theoremId);
}

/**
 * Exports the active theorem proof ledger into Markdown table format.
 */
export function exportProofToMarkdown(
  edges: Edge[],
  theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): string {
  const th =
    typeof theoremId === "object"
      ? theoremId
      : THEOREMS[theoremId] || THEOREMS["modus-ponens"];
  const ledger = getDeductionLedger(edges, theoremId);
  const { isE_Proven } = evaluateProofStatus(edges, theoremId);

  const rows = ledger
    .map(
      (s) =>
        `| ${s.stepNumber} | \`${s.formula}\` | ${s.rule} | ${s.premises} | ${s.isProven ? "✔ PROVEN" : "⏳ PENDING"} | ${s.plainEnglish} |`
    )
    .join("\n");

  return `# Proof Workspace Export: ${th.title}
**Scenario**: ${th.scenario}  
**Status**: ${isE_Proven ? "✔ GRAPH COMPLETE (local simulation; not Lean-verified)" : "⏳ INCOMPLETE"}
**Inference Rule**: ${th.ruleName}  

| Step | Proposition | Inference Rule | Premises | Status | Plain English Meaning |
|:---:|:---:|:---:|:---:|:---:|:---|
${rows}

---
*Generated by Antigravity Logical Proof Canvas v3.0*
`;
}

/**
 * Exports the active theorem proof into Mermaid flowchart syntax.
 */
export function exportProofToMermaid(
  edges: Edge[],
  theoremId: TheoremId | TheoremDefinition = "modus-ponens"
): string {
  const th =
    typeof theoremId === "object"
      ? theoremId
      : THEOREMS[theoremId] || THEOREMS["modus-ponens"];
  const { isC_Proven, isE_Proven } = evaluateProofStatus(edges, theoremId);

  const nodeDefs = th.nodes
    .map((n) => {
      let isProven = true;
      if (n.id === "C") isProven = isC_Proven;
      if (n.id === "E") isProven = isE_Proven;
      const statusIcon = isProven ? "✔" : "⏳";
      return `    Node_${n.id}["${statusIcon} [Node ${n.id}] ${n.label}\\n${n.type.toUpperCase()}"]`;
    })
    .join("\n");

  const edgeDefs = edges
    .map((e) => `    Node_${e.source} --> Node_${e.target}`)
    .join("\n");

  return `graph LR
    %% Workspace status: ${isE_Proven ? "GRAPH COMPLETE (local simulation)" : "INCOMPLETE"}
    %% Formal Logic Proof Graph: ${th.title}
${nodeDefs}
${edgeDefs}
    classDef proven fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#ecfdf5;
    classDef pending fill:#18181b,stroke:#52525b,stroke-width:1px,color:#a1a1aa;
    class Node_A,Node_B,Node_D proven;
    class Node_C ${isC_Proven ? "proven" : "pending"};
    class Node_E ${isE_Proven ? "proven" : "pending"};
`;
}

export interface CompatibleTargetInfo {
  targetId: string;
  targetLabel: string;
  ruleId: string;
  ruleName: string;
  ruleSymbol: string;
  ruleTemplate: string;
  badgeLabel: string;
  hint: string;
}

/**
 * Returns all compatible target nodes and corresponding rule annotations for a source node.
 */
export function getCompatibleTargets(
  sourceId: string,
  theoremId: TheoremId | TheoremDefinition = "modus-ponens",
  edges: Edge[] = []
): CompatibleTargetInfo[] {
  const th =
    typeof theoremId === "object"
      ? theoremId
      : THEOREMS[theoremId] || THEOREMS["modus-ponens"];
  const sNode = th.nodes.find(
    (n) => n.id.toUpperCase() === sourceId.toUpperCase()
  );
  if (!sNode) return [];

  const results: CompatibleTargetInfo[] = [];

  for (const tNode of th.nodes) {
    if (tNode.id.toUpperCase() === sourceId.toUpperCase()) continue;

    const isIntermediateTarget =
      tNode.id === th.intermediateNodeId &&
      th.intermediateRequires.includes(sNode.id);
    const isConclusionTarget =
      tNode.id === th.targetNodeId && th.conclusionRequires.includes(sNode.id);

    if (!isIntermediateTarget && !isConclusionTarget) continue;

    const validation = canConnect(sourceId, tNode.id, edges, theoremId);
    if (!validation.allowed) continue;

    let ruleId = "mp";
    let ruleName = "Modus Ponens";
    let ruleSymbol = "MP";
    let ruleTemplate = "P, P → Q ⊢ Q";

    if (tNode.id === th.intermediateNodeId) {
      const parsedRuleName = th.ruleName.split("(")[0].trim();
      ruleName = parsedRuleName;
      const foundRule = INFERENCE_RULES.find(
        (r) =>
          r.name.toLowerCase() === parsedRuleName.toLowerCase() ||
          r.id === theoremId
      );
      if (foundRule) {
        ruleId = foundRule.id;
        ruleSymbol = foundRule.symbol;
        ruleTemplate = foundRule.template;
      } else {
        ruleSymbol = parsedRuleName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase();
      }
    } else if (tNode.id === th.targetNodeId) {
      const rule =
        INFERENCE_RULES.find((rule) => rule.name === tNode.ruleUsed) ??
        INFERENCE_RULES[0];
      ruleId = rule.id;
      ruleName = rule.name;
      ruleSymbol = rule.symbol;
      ruleTemplate = rule.template;
    }

    results.push({
      targetId: tNode.id,
      targetLabel: tNode.label,
      ruleId,
      ruleName,
      ruleSymbol,
      ruleTemplate,
      badgeLabel: `${ruleSymbol} Target ⊢ ${tNode.label}`,
      hint: `Connect [${sNode.id}: ${sNode.label}] to [${tNode.id}: ${tNode.label}] via ${ruleName}`,
    });
  }

  return results;
}

export interface AlignmentGuide {
  type: "horizontal" | "vertical";
  pos: number;
  start: number;
  end: number;
  sourceNodeId?: string;
  targetNodeId?: string;
}

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  guides: AlignmentGuide[];
}

/**
 * Computes magnetic snapping coordinates and active orthogonal alignment crosshairs.
 */
export function computeMagneticSnap(
  currentX: number,
  currentY: number,
  nodeWidth: number,
  nodeHeight: number,
  peerNodes: {
    id: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
  }[],
  options: {
    gridSize?: number;
    threshold?: number;
    enableGrid?: boolean;
    enableAlignment?: boolean;
  } = {}
): SnapResult {
  const gridSize = options.gridSize ?? 20;
  const threshold = options.threshold ?? 12;
  const enableGrid = options.enableGrid ?? true;
  const enableAlignment = options.enableAlignment ?? true;

  let finalX = currentX;
  let finalY = currentY;
  let snappedX = false;
  let snappedY = false;
  const guides: AlignmentGuide[] = [];

  if (enableAlignment && peerNodes.length > 0) {
    const currentCenterX = currentX + nodeWidth / 2;
    const currentRightX = currentX + nodeWidth;
    const currentCenterY = currentY + nodeHeight / 2;
    const currentBottomY = currentY + nodeHeight;

    let closestDistX = threshold + 1;
    let bestSnapX: number | null = null;
    let bestGuideX: AlignmentGuide | null = null;

    let closestDistY = threshold + 1;
    let bestSnapY: number | null = null;
    let bestGuideY: AlignmentGuide | null = null;

    for (const peer of peerNodes) {
      const peerW = peer.width ?? nodeWidth;
      const peerH = peer.height ?? nodeHeight;
      const peerCenterX = peer.x + peerW / 2;
      const peerRightX = peer.x + peerW;
      const peerCenterY = peer.y + peerH / 2;
      const peerBottomY = peer.y + peerH;

      // X alignment checks (Center-to-Center, Left-to-Left, Right-to-Right)
      const xChecks = [
        {
          myPos: currentCenterX,
          peerPos: peerCenterX,
          snapPos: peerCenterX - nodeWidth / 2,
          guidePos: peerCenterX,
        },
        { myPos: currentX, peerPos: peer.x, snapPos: peer.x, guidePos: peer.x },
        {
          myPos: currentRightX,
          peerPos: peerRightX,
          snapPos: peerRightX - nodeWidth,
          guidePos: peerRightX,
        },
      ];

      for (const check of xChecks) {
        const dist = Math.abs(check.myPos - check.peerPos);
        if (dist < closestDistX) {
          closestDistX = dist;
          bestSnapX = check.snapPos;
          const minY = Math.min(currentY, peer.y) - 20;
          const maxY = Math.max(currentBottomY, peerBottomY) + 20;
          bestGuideX = {
            type: "vertical",
            pos: check.guidePos,
            start: minY,
            end: maxY,
            targetNodeId: peer.id,
          };
        }
      }

      // Y alignment checks (Center-to-Center, Top-to-Top, Bottom-to-Bottom)
      const yChecks = [
        {
          myPos: currentCenterY,
          peerPos: peerCenterY,
          snapPos: peerCenterY - nodeHeight / 2,
          guidePos: peerCenterY,
        },
        { myPos: currentY, peerPos: peer.y, snapPos: peer.y, guidePos: peer.y },
        {
          myPos: currentBottomY,
          peerPos: peerBottomY,
          snapPos: peerBottomY - nodeHeight,
          guidePos: peerBottomY,
        },
      ];

      for (const check of yChecks) {
        const dist = Math.abs(check.myPos - check.peerPos);
        if (dist < closestDistY) {
          closestDistY = dist;
          bestSnapY = check.snapPos;
          const minX = Math.min(currentX, peer.x) - 20;
          const maxX = Math.max(currentRightX, peerRightX) + 20;
          bestGuideY = {
            type: "horizontal",
            pos: check.guidePos,
            start: minX,
            end: maxX,
            targetNodeId: peer.id,
          };
        }
      }
    }

    if (bestSnapX !== null && closestDistX <= threshold) {
      finalX = bestSnapX;
      snappedX = true;
      if (bestGuideX) guides.push(bestGuideX);
    }

    if (bestSnapY !== null && closestDistY <= threshold) {
      finalY = bestSnapY;
      snappedY = true;
      if (bestGuideY) guides.push(bestGuideY);
    }
  }

  // Grid Snapping fallback if not aligned on an axis
  if (enableGrid && gridSize > 0) {
    if (!snappedX) {
      const nearestGridX = Math.round(currentX / gridSize) * gridSize;
      if (Math.abs(currentX - nearestGridX) <= threshold) {
        finalX = nearestGridX;
        snappedX = true;
      }
    }

    if (!snappedY) {
      const nearestGridY = Math.round(currentY / gridSize) * gridSize;
      if (Math.abs(currentY - nearestGridY) <= threshold) {
        finalY = nearestGridY;
        snappedY = true;
      }
    }
  }

  return {
    x: finalX,
    y: finalY,
    snappedX,
    snappedY,
    guides,
  };
}
