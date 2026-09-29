import {
  applyRuleToAsts,
  areAstsEqual,
  extractVariables,
  formatFormula,
  INFERENCE_RULES,
  type PropAst,
  type TheoremDefinition,
} from "./proof-utils";

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
          const latexFormula = (ast: PropAst) =>
            formatFormula(ast)
              .replace(/_/g, "\\_")
              .replace(/→/g, "\\to")
              .replace(/↔/g, "\\leftrightarrow")
              .replace(/∧/g, "\\land")
              .replace(/∨/g, "\\lor")
              .replace(/¬/g, "\\neg")
              .replace(/⊥/g, "\\bot");
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
            latexCode: `\\begin{prooftree}\n\\AxiomC{$${latexFormula(inputs[first])}$}\n\\AxiomC{$${latexFormula(inputs[second])}$}\n\\RightLabel{${rule.symbol}}\n\\BinaryInfC{$${latexFormula(middle)}$}\n\\AxiomC{$${latexFormula(inputs[remaining])}$}\n\\RightLabel{${finalRule.symbol}}\n\\BinaryInfC{$${latexFormula(inputs[3])}$}\n\\end{prooftree}`,
          };
        }
      }
    }
  }
  throw new Error(
    "This workspace supports two binary inference steps using three premises (MP, MT, HS, DS, resolution or conjunction). Try A; A -> B; B -> C with goal C, or revise the premises to fit that shape."
  );
}
