import { clamp } from "@/lib/utils";
import {
  applyRuleToAsts,
  areAstsEqual,
  exportProofToJson,
  extractVariables,
  formatFormula,
  generateSandboxLean4Code,
  generateTruthTable,
  INFERENCE_RULES,
  THEOREMS,
  type Edge,
  type FallacyDiagnosis,
  type FallacyFormulaAst,
  type ProofNode,
  type ProofWorkspaceSnapshot,
  type PropAst,
  type TheoremDefinition,
  type TheoremId,
} from "@/lib/proof";

/** Maximum UTF-8 byte size accepted when importing a `.proof.json` workspace file. */
export const MAX_PROOF_JSON_BYTES = 65_536;

/** Maximum number of proof nodes permitted in a sandbox or imported workspace graph. */
export const MAX_SANDBOX_NODES = 40;

/** Maximum character length permitted for a shareable URL hash payload. */
export const MAX_PROOF_HASH_LENGTH = 2048;

const NODE_ID_PATTERN = /^[A-Za-z0-9_]{1,32}$/;

const LATEX_SPECIAL_CHARS: Readonly<Record<string, string>> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "#": "\\#",
  "^": "\\textasciicircum{}",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "%": "\\%",
};

function escapeLatexText(text: string): string {
  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/[\\{}$&#^_~%]/g, (ch) => LATEX_SPECIAL_CHARS[ch] ?? ch);
}

function formatLatexChild(
  child: PropAst,
  parentType: "and" | "or" | "implies" | "iff"
): string {
  const needsParens =
    (parentType === "implies" &&
      (child.type === "implies" || child.type === "iff")) ||
    (parentType === "or" &&
      (child.type === "implies" || child.type === "iff")) ||
    (parentType === "and" &&
      (child.type === "or" ||
        child.type === "implies" ||
        child.type === "iff"));
  return needsParens
    ? `(${formatLatexFormula(child)})`
    : formatLatexFormula(child);
}

function formatLatexFormula(ast: PropAst): string {
  switch (ast.type) {
    case "bottom":
      return "\\bot";
    case "var":
      return escapeLatexText(ast.name);
    case "not":
      if (ast.operand.type === "var" || ast.operand.type === "bottom") {
        return `\\neg ${formatLatexFormula(ast.operand)}`;
      }
      return `\\neg(${formatLatexFormula(ast.operand)})`;
    case "and":
      return `${formatLatexChild(ast.left, "and")} \\land ${formatLatexChild(ast.right, "and")}`;
    case "or":
      return `${formatLatexChild(ast.left, "or")} \\lor ${formatLatexChild(ast.right, "or")}`;
    case "implies":
      return `${formatLatexChild(ast.left, "implies")} \\to ${formatLatexChild(ast.right, "implies")}`;
    case "iff":
      return `${formatLatexChild(ast.left, "iff")} \\leftrightarrow ${formatLatexChild(ast.right, "iff")}`;
  }
}

/** Parses bounded propositional syntax without discarding invalid characters. */
export function parseCustomFormula(input: string): PropAst {
  if (!input.trim() || input.length > 256)
    throw new Error("Enter a formula of 1–256 characters.");
  const tokens =
    input.match(/<->|->|&&|\|\||[()¬~!∧&∨|→↔⊥]|[A-Za-z][A-Za-z0-9_]*|\S/g) ??
    [];
  let index = 0;
  function primary(): PropAst {
    const token = tokens[index++];
    if (["¬", "~", "!"].includes(token))
      return { type: "not", operand: primary() };
    if (token === "(") {
      const ast = binary(0);
      if (tokens[index++] !== ")")
        throw new Error("Close each opening parenthesis with ).");
      return ast;
    }
    if (token === "⊥" || token === "false") return { type: "bottom" };
    if (token && /^[A-Za-z][A-Za-z0-9_]*$/.test(token))
      return { type: "var", name: token };
    throw new Error(
      "Expected a proposition or parenthesized formula. Use ->, &, | and ~ for logic operators."
    );
  }
  const levels: { tokens: string[]; type: "iff" | "implies" | "or" | "and" }[] =
    [
      { tokens: ["<->", "↔"], type: "iff" },
      { tokens: ["->", "→"], type: "implies" },
      { tokens: ["|", "||", "∨"], type: "or" },
      { tokens: ["&", "&&", "∧"], type: "and" },
    ];
  function binary(level: number): PropAst {
    if (level === levels.length) return primary();
    const left = binary(level + 1);
    if (levels[level].tokens.includes(tokens[index])) {
      index++;
      return { type: levels[level].type, left, right: binary(level) };
    }
    return left;
  }
  const ast = binary(0);
  if (index !== tokens.length)
    throw new Error(
      `Unexpected token '${tokens[index]}'. Separate propositions with a logic operator.`
    );
  return ast;
}

/** Builds the workspace's two-stage inference graph from validated visitor formulas. */
export function createCustomTheorem(
  premises: string[],
  goal: string
): TheoremDefinition {
  if (premises.length !== 3) throw new Error("Enter three premises.");
  const inputs = [...premises, goal].map((formula, i) => {
    try {
      return parseCustomFormula(formula);
    } catch (error) {
      throw new Error(
        `${i === 3 ? "Goal" : `Premise ${i + 1}`}: ${error instanceof Error ? error.message : "Invalid formula."}`
      );
    }
  });
  const variables = Array.from(new Set(inputs.flatMap(extractVariables)));
  if (variables.length > 6)
    throw new Error(
      "Use at most six distinct propositions for bounded truth-table evaluation."
    );
  const rules = INFERENCE_RULES.filter((rule) => rule.arity === 2);
  for (let first = 0; first < 3; first++) {
    for (let second = 0; second < 3; second++) {
      if (first === second) continue;
      const remaining = 3 - first - second;
      for (const rule of rules) {
        const middle = applyRuleToAsts(rule.id, [
          inputs[first],
          inputs[second],
        ]).resultAst;
        if (!middle) continue;
        for (const finalRule of rules) {
          const conclusion = applyRuleToAsts(finalRule.id, [
            middle,
            inputs[remaining],
          ]).resultAst;
          if (!conclusion || !areAstsEqual(conclusion, inputs[3])) continue;
          const labels = [
            premises[first].trim(),
            premises[second].trim(),
            formatFormula(middle),
            premises[remaining].trim(),
            goal.trim(),
          ];
          const asts = [
            inputs[first],
            inputs[second],
            middle,
            inputs[remaining],
            inputs[3],
          ];
          const ids = ["A", "B", "C", "D", "E"];
          const leanFormula = (ast: PropAst) =>
            formatFormula(ast)
              .replace(/[A-Za-z][A-Za-z0-9_]*/g, (name) => `«${name}»`)
              .replace(/⊥/g, "False");
          const hypothesisNames = [1, 2, 3].map((index) => {
            let name = `h${index}`;
            while (variables.includes(name)) name += "_";
            return name;
          });
          return {
            id: "custom",
            title: "Custom Proof",
            subtitle: `${rule.name} then ${finalRule.name}`,
            category: "Custom Studio",
            ruleName: rule.name,
            scenario: "Visitor-authored propositions",
            goalDescription: `Derive ${goal.trim()} from the submitted premises.`,
            nodes: ids.map((id, i) => ({
              id,
              label: labels[i],
              ast: asts[i],
              type:
                i === 4 ? "conclusion" : i === 2 ? "intermediate" : "premise",
              ruleUsed:
                i === 4 ? finalRule.name : i === 2 ? rule.name : undefined,
              description: labels[i],
              meaning:
                i === 2 || i === 4
                  ? "Derived from submitted premises"
                  : "Submitted premise",
              x: [120, 120, 430, 430, 730][i],
              y: [100, 310, 200, 410, 260][i],
            })),
            initialEdges: [],
            intermediateNodeId: "C",
            targetNodeId: "E",
            intermediateRequires: ["A", "B"],
            conclusionRequires: ["C", "D"],
            validPairs: [
              ["A", "C"],
              ["B", "C"],
              ["C", "E"],
              ["D", "E"],
            ],
            simulationSteps: [
              `Parsed premises: ${premises.join("; ")}`,
              `Applied ${rule.name}: ${labels[2]}`,
              `Applied ${finalRule.name}: ${goal.trim()}`,
              "Local custom graph validated; no Lean kernel verification was performed.",
            ],
            leanCode: `import Mathlib\n\ntheorem custom_proof (${variables.map((name) => `«${name}»`).join(" ")} : Prop)\n  (${hypothesisNames[0]} : ${leanFormula(inputs[first])}) (${hypothesisNames[1]} : ${leanFormula(inputs[second])})\n  (${hypothesisNames[2]} : ${leanFormula(inputs[remaining])}) : ${leanFormula(inputs[3])} := by\n  tauto`,
            latexCode: `\\begin{prooftree}\n\\AxiomC{$${formatLatexFormula(inputs[first])}$}\n\\AxiomC{$${formatLatexFormula(inputs[second])}$}\n\\RightLabel{${rule.symbol}}\n\\BinaryInfC{$${formatLatexFormula(middle)}$}\n\\AxiomC{$${formatLatexFormula(inputs[remaining])}$}\n\\RightLabel{${finalRule.symbol}}\n\\BinaryInfC{$${formatLatexFormula(inputs[3])}$}\n\\end{prooftree}`,
          };
        }
      }
    }
  }
  throw new Error(
    "This workspace supports two binary inference steps using three premises (MP, MT, HS, DS, resolution or conjunction). Try A; A -> B; B -> C with goal C, or revise the premises to fit that shape."
  );
}

/** Builds a single validated sandbox proof node from user input. */
export function buildSandboxNode(params: {
  id: string;
  label: string;
  type: "premise" | "intermediate" | "conclusion";
  x: number;
  y: number;
  ruleUsed?: string;
}): ProofNode {
  const ast = parseCustomFormula(params.label);
  const formatted = formatFormula(ast);
  const roleLabel =
    params.type === "premise"
      ? "Sandbox premise"
      : params.type === "conclusion"
        ? "Sandbox target goal"
        : params.ruleUsed
          ? `Derived via ${params.ruleUsed}`
          : "Derived intermediate step";
  return {
    id: params.id,
    label: formatted,
    ast,
    type: params.type,
    ruleUsed: params.ruleUsed,
    description: `${roleLabel}: ${formatted}`,
    meaning: roleLabel,
    x: Math.round(params.x),
    y: Math.round(params.y),
  };
}

/** Creates starter nodes for visitors who choose the quick-start sandbox example. */
export function createStarterSandboxNodes(): ProofNode[] {
  return [
    buildSandboxNode({ id: "P1", label: "P", type: "premise", x: 100, y: 90 }),
    buildSandboxNode({
      id: "P2",
      label: "P -> Q",
      type: "premise",
      x: 100,
      y: 230,
    }),
    buildSandboxNode({
      id: "P3",
      label: "Q -> R",
      type: "premise",
      x: 340,
      y: 310,
    }),
    buildSandboxNode({
      id: "G1",
      label: "R",
      type: "conclusion",
      x: 600,
      y: 200,
    }),
  ];
}

/** Builds an open freeform sandbox `TheoremDefinition` from arbitrary validated nodes and edges. */
export function createSandboxTheorem(
  nodes: ProofNode[] = [],
  edges: Edge[] = []
): TheoremDefinition {
  const normalizedNodes = nodes.map((node) => {
    const ast = node.ast ?? parseCustomFormula(node.label);
    return {
      ...node,
      ast,
    };
  });

  const premises = normalizedNodes.filter((n) => n.type === "premise");
  const intermediates = normalizedNodes.filter(
    (n) => n.type === "intermediate"
  );
  const goals = normalizedNodes.filter((n) => n.type === "conclusion");

  const goalSummary =
    goals.length > 0
      ? `Derive ${goals.map((g) => g.label).join(" ∧ ")} from active sandbox premises.`
      : "Place premise and goal formulas on the canvas, then apply tactics freely.";

  const simulationSteps: string[] =
    normalizedNodes.length === 0
      ? ["Sandbox canvas is empty. Add premises and a goal to simulate steps."]
      : [
          `Loaded ${premises.length} sandbox premise(s): ${premises.map((p) => p.label).join("; ") || "none"}`,
          ...intermediates.map(
            (step) =>
              `Evaluated intermediate node ${step.id} (${step.label})${step.ruleUsed ? ` via ${step.ruleUsed}` : ""}`
          ),
          ...(goals.length > 0
            ? [
                `Target goal(s): ${goals.map((g) => `${g.id} (${g.label})`).join(", ")}`,
              ]
            : [
                "No explicit target goal node; forward exploration mode active.",
              ]),
          "Sandbox AST graph simulation completed locally without an external prover runtime.",
        ];

  const latexPremises = premises
    .map((p) => `\\AxiomC{$${formatLatexFormula(p.ast!)}$}`)
    .join("\n");
  const latexGoal =
    goals.length > 0
      ? `$${goals.map((g) => formatLatexFormula(g.ast!)).join(" \\land ")}$`
      : "$\\top$";
  const latexCode =
    premises.length === 0
      ? `\\begin{prooftree}\n\\AxiomC{${latexGoal}}\n\\end{prooftree}`
      : premises.length === 1
        ? `\\begin{prooftree}\n${latexPremises}\n\\UnaryInfC{${latexGoal}}\n\\end{prooftree}`
        : premises.length === 2
          ? `\\begin{prooftree}\n${latexPremises}\n\\BinaryInfC{${latexGoal}}\n\\end{prooftree}`
          : `% Premises: ${premises.map((p) => `$${formatLatexFormula(p.ast!)}$`).join(", ")}\n\\begin{prooftree}\n\\AxiomC{$${premises.map((p) => formatLatexFormula(p.ast!)).join(" \\land ")}$}\n\\UnaryInfC{${latexGoal}}\n\\end{prooftree}`;

  return {
    id: "custom",
    isSandbox: true,
    title: "Sandbox Proof",
    subtitle: "Freeform Tactic Exploration",
    category: "Custom Studio",
    ruleName: "Sandbox Mode · Open Tactic Canvas",
    scenario:
      "Open forward-chaining sandbox for propositional tactics, countermodel truth tables, and portable workspace snapshots.",
    goalDescription: goalSummary,
    targetNodeId: goals[0]?.id ?? "",
    intermediateNodeId: intermediates[0]?.id ?? "",
    intermediateRequires: ["", ""],
    conclusionRequires: ["", ""],
    nodes: normalizedNodes,
    initialEdges: edges,
    validPairs: [],
    simulationSteps,
    leanCode: generateSandboxLean4Code(normalizedNodes, edges),
    latexCode,
  };
}

/** Outcome of an on-demand truth-table countermodel check on active sandbox formulas. */
export type SandboxCountermodelResult =
  | {
      status: "countermodel";
      diagnosis: FallacyDiagnosis;
    }
  | {
      status: "valid";
      variables: string[];
      valuationCount: number;
      formalFormula: string;
    }
  | {
      status: "error";
      message: string;
    };

/** Evaluates active sandbox premises against active sandbox goals for falsifying valuations. */
export function evaluateSandboxCountermodel(
  nodes: ProofNode[]
): SandboxCountermodelResult {
  const premiseNodes = nodes.filter((n) => n.type === "premise");
  const goalNodes = nodes.filter((n) => n.type === "conclusion");

  if (goalNodes.length === 0) {
    return {
      status: "error",
      message: "Add at least one Goal node before running Check Countermodel.",
    };
  }

  let premises: FallacyFormulaAst[];
  let goalAsts: { label: string; ast: PropAst }[];
  try {
    premises = premiseNodes.map((node, index) => {
      const ast = node.ast ?? parseCustomFormula(node.label);
      return {
        label: `Premise ${index + 1}: ${formatFormula(ast)}`,
        ast,
        description: node.description || `Sandbox premise ${node.id}`,
      };
    });
    goalAsts = goalNodes.map((node) => {
      const ast = node.ast ?? parseCustomFormula(node.label);
      return { label: formatFormula(ast), ast };
    });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Invalid formula in sandbox graph.",
    };
  }

  let combinedGoalAst = goalAsts[0].ast;
  for (let i = 1; i < goalAsts.length; i++) {
    combinedGoalAst = {
      type: "and",
      left: combinedGoalAst,
      right: goalAsts[i].ast,
    };
  }
  const goalLabel =
    goalAsts.length === 1
      ? goalAsts[0].label
      : goalAsts.map((g) => `(${g.label})`).join(" ∧ ");

  const conclusion: {
    label: string;
    ast: PropAst;
    description: string;
  } = {
    label: `Goal: ${goalLabel}`,
    ast: combinedGoalAst,
    description:
      goalNodes.length === 1
        ? `Target goal Node ${goalNodes[0].id}`
        : `Combined sandbox target goals (${goalNodes.map((g) => g.id).join(", ")})`,
  };

  const variableSet = new Set<string>();
  premises.forEach((p) =>
    extractVariables(p.ast).forEach((v) => variableSet.add(v))
  );
  extractVariables(conclusion.ast).forEach((v) => variableSet.add(v));
  if (variableSet.size > 6) {
    return {
      status: "error",
      message:
        "Use at most six distinct propositions for bounded truth-table countermodel checks.",
    };
  }

  const { truthTable, variables, counterexampleValuation } = generateTruthTable(
    premises,
    conclusion
  );

  const lhs =
    premiseNodes.length > 0
      ? premiseNodes
          .map((p) => formatFormula(p.ast ?? parseCustomFormula(p.label)))
          .join(", ")
      : "∅";

  if (counterexampleValuation) {
    const valuationSummary = Object.entries(counterexampleValuation)
      .map(([name, val]) => `${name} = ${val ? "T" : "F"}`)
      .join(", ");
    return {
      status: "countermodel",
      diagnosis: {
        fallacyName: "Countermodel Found (Unentailed Goal)",
        formalFormula: `${lhs} ⊬ ${goalLabel}`,
        plainEnglish: `Valuation (${valuationSummary}) satisfies every active premise while evaluating the target goal (${goalLabel}) to FALSE. No sound sequence of inference rules can derive this goal without stronger premises.`,
        softwareAnalogy:
          "Invariant violation under an admissible state assignment: test preconditions hold, yet the postcondition fails on a reachable input combination.",
        premises,
        conclusion,
        variables,
        truthTable,
        counterexampleValuation,
      },
    };
  }

  return {
    status: "valid",
    variables,
    valuationCount: truthTable.length,
    formalFormula: `${lhs} ⊨ ${goalLabel}`,
  };
}

/** Validated result of importing a `.proof.json` workspace file. */
export interface ParsedProofWorkspace {
  mode: "sandbox" | "guided";
  theoremId: TheoremId;
  title: string;
  nodes: ProofNode[];
  edges: Edge[];
  theorem: TheoremDefinition;
}

/** Serializes the active workspace graph (merging any dragged node offsets) to `.proof.json`. */
export function serializeProofWorkspaceJson(
  theorem: TheoremDefinition,
  edges: Edge[],
  nodeOffsets: Record<string, { x: number; y: number }> = {}
): string {
  const positionedNodes = theorem.nodes.map((node) => {
    const off = nodeOffsets[node.id];
    return off
      ? {
          ...node,
          x: Math.round(node.x + off.x),
          y: Math.round(node.y + off.y),
        }
      : node;
  });
  return exportProofToJson(edges, { ...theorem, nodes: positionedNodes });
}

function validateImportedGraph(nodes: ProofNode[], edges: Edge[]): void {
  const outgoing = new Map<string, string[]>();
  const premiseIds = new Set<string>();
  const normalizedIds = new Set<string>();
  for (const node of nodes) {
    const normalizedId = node.id.toUpperCase();
    if (normalizedIds.has(normalizedId)) {
      throw new Error(`Duplicate node id '${node.id}' in workspace.`);
    }
    normalizedIds.add(normalizedId);
    outgoing.set(node.id, []);
    if (node.type === "premise") premiseIds.add(node.id);
  }

  for (const edge of edges) {
    if (premiseIds.has(edge.target)) {
      throw new Error(
        `Premise '${edge.target}' cannot receive incoming edges.`
      );
    }
    outgoing.get(edge.source)?.push(edge.target);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new Error(`Workspace contains a dependency cycle at node '${id}'.`);
    }

    visiting.add(id);
    for (const target of outgoing.get(id) ?? []) visit(target);
    visiting.delete(id);
    visited.add(id);
  }

  for (const node of nodes) visit(node.id);
}

/** Parses and validates a `.proof.json` payload, including its dependency graph. */
export function parseProofWorkspaceJson(
  rawInput: string | Uint8Array
): ParsedProofWorkspace {
  const byteLength =
    rawInput instanceof Uint8Array
      ? rawInput.byteLength
      : new TextEncoder().encode(rawInput).byteLength;

  if (byteLength > MAX_PROOF_JSON_BYTES) {
    throw new Error(
      `Workspace file exceeds the 64 KB import limit (${byteLength} bytes).`
    );
  }

  const rawText =
    rawInput instanceof Uint8Array
      ? new TextDecoder("utf-8", { fatal: true }).decode(rawInput)
      : rawInput;

  if (!rawText.trim()) {
    throw new Error("Workspace file is empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Invalid .proof.json file: malformed JSON syntax.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid .proof.json file: expected a workspace object.");
  }

  const record = parsed as Partial<ProofWorkspaceSnapshot> &
    Record<string, unknown>;
  if (record.version !== 1) {
    throw new Error(
      "Unsupported .proof.json schema version (expected version 1)."
    );
  }
  if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) {
    throw new Error("Invalid .proof.json file: missing nodes or edges arrays.");
  }
  if (record.nodes.length > MAX_SANDBOX_NODES) {
    throw new Error(
      `Workspace file exceeds the ${MAX_SANDBOX_NODES}-node import limit (${record.nodes.length} nodes).`
    );
  }

  const seenNodeIds = new Set<string>();
  const nodes: ProofNode[] = record.nodes.map((rawNode, index) => {
    if (!rawNode || typeof rawNode !== "object") {
      throw new Error(`Node at index ${index} must be an object.`);
    }
    const item = rawNode as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!NODE_ID_PATTERN.test(id)) {
      throw new Error(
        `Node at index ${index} has invalid id '${id}'. Use 1-32 alphanumeric or underscore characters.`
      );
    }
    if (seenNodeIds.has(id)) {
      throw new Error(`Duplicate node id '${id}' in workspace file.`);
    }
    seenNodeIds.add(id);

    const type = item.type;
    if (
      type !== "premise" &&
      type !== "intermediate" &&
      type !== "conclusion"
    ) {
      throw new Error(`Node '${id}' has unsupported type '${String(type)}'.`);
    }

    if (typeof item.label !== "string") {
      throw new Error(`Node '${id}' is missing a formula string.`);
    }
    let ast: PropAst;
    try {
      ast = parseCustomFormula(item.label);
    } catch (error) {
      throw new Error(
        `Node '${id}': ${error instanceof Error ? error.message : "Invalid formula."}`
      );
    }

    const rawX = Number(item.x);
    const rawY = Number(item.y);
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
      throw new Error(`Node '${id}' has non-finite canvas coordinates.`);
    }
    const x = clamp(Math.round(rawX), -2000, 4000);
    const y = clamp(Math.round(rawY), -2000, 4000);
    const ruleUsed =
      typeof item.ruleUsed === "string" && item.ruleUsed.trim()
        ? item.ruleUsed.trim().slice(0, 64)
        : undefined;

    return {
      id,
      label: formatFormula(ast),
      ast,
      type,
      x,
      y,
      ruleUsed,
      description: `${type === "premise" ? "Sandbox premise" : type === "conclusion" ? "Sandbox target goal" : "Derived step"}: ${formatFormula(ast)}`,
      meaning:
        type === "premise"
          ? "Imported premise"
          : type === "conclusion"
            ? "Imported target goal"
            : ruleUsed
              ? `Derived via ${ruleUsed}`
              : "Imported intermediate step",
    };
  });

  const edgeKeys = new Set<string>();
  const edges: Edge[] = [];
  for (let i = 0; i < record.edges.length; i++) {
    const rawEdge = record.edges[i];
    if (!rawEdge || typeof rawEdge !== "object") {
      throw new Error(`Edge at index ${i} must be an object.`);
    }
    const e = rawEdge as unknown as Record<string, unknown>;
    const source = typeof e.source === "string" ? e.source.trim() : "";
    const target = typeof e.target === "string" ? e.target.trim() : "";
    if (!seenNodeIds.has(source) || !seenNodeIds.has(target)) {
      throw new Error(
        `Edge at index ${i} references unknown node '${!seenNodeIds.has(source) ? source : target}'.`
      );
    }
    if (source === target) {
      throw new Error(
        `Edge at index ${i} cannot connect node '${source}' to itself.`
      );
    }
    const key = `${source}->${target}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    const ruleApplied =
      typeof e.ruleApplied === "string" && e.ruleApplied.trim()
        ? e.ruleApplied.trim().slice(0, 32)
        : undefined;
    edges.push({
      source,
      target,
      ...(ruleApplied ? { ruleApplied } : {}),
    });
  }

  const mode = record.mode === "guided" ? "guided" : "sandbox";
  const rawThId =
    typeof record.theoremId === "string" ? record.theoremId : "custom";
  const theoremId: TheoremId = Object.hasOwn(THEOREMS, rawThId)
    ? (rawThId as TheoremId)
    : "custom";
  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim().slice(0, 120)
      : "Sandbox Proof";

  validateImportedGraph(nodes, edges);
  const theorem = createSandboxTheorem(nodes, edges);
  return {
    mode,
    theoremId,
    title,
    nodes,
    edges,
    theorem: { ...theorem, title },
  };
}

type CompactSandboxTupleNode =
  | [string, string, "p" | "i" | "c", number, number]
  | [string, string, "p" | "i" | "c", number, number, string];

type CompactSandboxTupleEdge = [string, string] | [string, string, string];

interface CompactSandboxPayload {
  n: CompactSandboxTupleNode[];
  e: CompactSandboxTupleEdge[];
}

/** Encodes a sandbox graph into a compact JSON string suitable for URL hash storage. */
export function encodeSandboxHash(nodes: ProofNode[], edges: Edge[]): string {
  const payload: CompactSandboxPayload = {
    n: nodes.map((node) => {
      const code =
        node.type === "premise" ? "p" : node.type === "conclusion" ? "c" : "i";
      const x = Math.round(node.x);
      const y = Math.round(node.y);
      return node.ruleUsed
        ? [node.id, node.label, code, x, y, node.ruleUsed]
        : [node.id, node.label, code, x, y];
    }),
    e: edges.map((edge) =>
      edge.ruleApplied
        ? [edge.source, edge.target, edge.ruleApplied]
        : [edge.source, edge.target]
    ),
  };
  return JSON.stringify(payload);
}

/** Decodes and validates a compact sandbox hash payload, returning null if malformed or out of bounds. */
export function decodeSandboxHash(
  raw: string | null | undefined
): { nodes: ProofNode[]; edges: Edge[]; theorem: TheoremDefinition } | null {
  if (!raw || raw.length > MAX_PROOF_HASH_LENGTH) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Partial<CompactSandboxPayload>;
    if (!Array.isArray(obj.n) || !Array.isArray(obj.e)) return null;
    if (obj.n.length > MAX_SANDBOX_NODES) return null;

    const seenIds = new Set<string>();
    const nodes: ProofNode[] = [];
    for (const tuple of obj.n) {
      if (!Array.isArray(tuple) || tuple.length < 5) return null;
      const [id, label, code, x, y, ruleUsed] = tuple;
      if (
        typeof id !== "string" ||
        !NODE_ID_PATTERN.test(id) ||
        seenIds.has(id)
      ) {
        return null;
      }
      if (typeof label !== "string") return null;
      if (code !== "p" && code !== "i" && code !== "c") return null;
      if (typeof x !== "number" || !Number.isFinite(x)) return null;
      if (typeof y !== "number" || !Number.isFinite(y)) return null;
      const type =
        code === "p" ? "premise" : code === "c" ? "conclusion" : "intermediate";
      seenIds.add(id);
      nodes.push(
        buildSandboxNode({
          id,
          label,
          type,
          x,
          y,
          ruleUsed: typeof ruleUsed === "string" ? ruleUsed : undefined,
        })
      );
    }

    const edges: Edge[] = [];
    const seenEdges = new Set<string>();
    for (const tuple of obj.e) {
      if (!Array.isArray(tuple) || tuple.length < 2) return null;
      const [source, target, ruleApplied] = tuple;
      if (
        typeof source !== "string" ||
        typeof target !== "string" ||
        source === target ||
        !seenIds.has(source) ||
        !seenIds.has(target)
      ) {
        return null;
      }
      const key = `${source}->${target}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      edges.push({
        source,
        target,
        ...(typeof ruleApplied === "string" && ruleApplied
          ? { ruleApplied }
          : {}),
      });
    }

    validateImportedGraph(nodes, edges);
    return { nodes, edges, theorem: createSandboxTheorem(nodes, edges) };
  } catch {
    return null;
  }
}

function normalizeEdgeKeySet(edges: Edge[]): string {
  return edges
    .map((e) => `${e.source}>${e.target}`)
    .sort()
    .join(",");
}

/** Encodes guided theorem edges compactly, returning null when identical to the theorem's initial edges. */
export function encodeGuidedEdgesHash(
  edges: Edge[],
  initialEdges: Edge[]
): string | null {
  if (normalizeEdgeKeySet(edges) === normalizeEdgeKeySet(initialEdges)) {
    return null;
  }
  if (edges.length === 0) {
    return "none";
  }
  return edges
    .map((e) =>
      e.ruleApplied
        ? `${e.source}>${e.target}:${e.ruleApplied}`
        : `${e.source}>${e.target}`
    )
    .join(",");
}

/** Decodes guided theorem edges from the URL hash, returning null when the hash omits an edge override. */
export function decodeGuidedEdgesHash(
  raw: string | null | undefined,
  theorem: TheoremDefinition
): Edge[] | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (raw.length > MAX_PROOF_HASH_LENGTH) return null;
  if (raw === "none") return [];

  const validIds = new Set(theorem.nodes.map((n) => n.id));
  const result: Edge[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [pairPart, rulePart] = trimmed.split(":");
    const [source, target] = (pairPart ?? "").split(">");
    if (
      !source ||
      !target ||
      source === target ||
      !validIds.has(source) ||
      !validIds.has(target)
    ) {
      return null;
    }
    const key = `${source}>${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      source,
      target,
      ...(rulePart ? { ruleApplied: rulePart } : {}),
    });
  }
  return result;
}

/** Builds a candidate URL hash string and checks whether it fits within the 2048-character ceiling. */
export function buildProofShareHash(
  entries: Record<string, string | null | undefined>
): { hash: string; exceedsLimit: boolean; length: number } {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== null && value !== undefined && value !== "") {
      sp.set(key, value);
    }
  }
  const serialized = sp.toString();
  const hash = serialized ? `#${serialized}` : "";
  return {
    hash,
    exceedsLimit: hash.length > MAX_PROOF_HASH_LENGTH,
    length: hash.length,
  };
}
