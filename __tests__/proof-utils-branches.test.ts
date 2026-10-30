// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  THEOREMS,
  applyRuleToAsts,
  areAstsEqual,
  canConnect,
  computeMagneticSnap,
  evaluateAst,
  evaluateAstWithTrace,
  exportProofToMarkdown,
  exportProofToMermaid,
  exportWorkspaceProof,
  extractVariables,
  formatFormula,
  generateTruthTable,
  getCompatibleTargets,
  getDeductionLedger,
  getExportFilename,
  getExportMimeType,
  getFallacyDiagnosis,
  getNextTacticHint,
  getSuggestion,
  isValidNode,
  parseFormula,
  pruneStepOrNode,
  scanApplicableRules,
  solveNextDeductionStep,
  type Edge,
  type ProofNode,
  type PropAst,
  type TheoremDefinition,
} from "@/lib/proof";

const P: PropAst = { type: "var", name: "P" };
const Q: PropAst = { type: "var", name: "Q" };
const R: PropAst = { type: "var", name: "R" };
const not = (operand: PropAst): PropAst => ({ type: "not", operand });
const imp = (left: PropAst, right: PropAst): PropAst => ({
  type: "implies",
  left,
  right,
});
const or = (left: PropAst, right: PropAst): PropAst => ({
  type: "or",
  left,
  right,
});
const and = (left: PropAst, right: PropAst): PropAst => ({
  type: "and",
  left,
  right,
});

const FULL_MP_EDGES: Edge[] = [
  { source: "A", target: "C" },
  { source: "B", target: "C" },
  { source: "C", target: "E" },
  { source: "D", target: "E" },
];

/** A structurally valid theorem with no node metadata, to exercise fallbacks. */
function bareTheorem(
  overrides: Partial<TheoremDefinition> = {}
): TheoremDefinition {
  return fromPartial<TheoremDefinition>({
    id: "custom",
    title: "Bare",
    ruleName: "Bare Rule (X ⊢ Y)",
    scenario: "none",
    targetNodeId: "E",
    intermediateNodeId: "C",
    intermediateRequires: ["A", "B"],
    conclusionRequires: ["C", "D"],
    validPairs: [],
    nodes: [],
    leanCode: "-- lean",
    latexCode: "% latex",
    ...overrides,
  });
}

function node(
  id: string,
  label: string,
  type: ProofNode["type"],
  extra: Partial<ProofNode> = {}
): ProofNode {
  return {
    id,
    label,
    type,
    description: `${id} description`,
    meaning: `${id} meaning`,
    x: 0,
    y: 0,
    ...extra,
  };
}

describe("parseFormula edge cases", () => {
  it("returns null for blank input and recognises bottom aliases", () => {
    expect(parseFormula("   ")).toBeNull();
    for (const alias of ["⊥", "FALSE", "bot"]) {
      expect(parseFormula(alias)).toEqual({ type: "bottom" });
    }
  });

  it("falls through when a binary operator has an empty side", () => {
    // "P <->" has no right operand, so it degrades to a bare identifier.
    expect(parseFormula("P <->")).toEqual({ type: "var", name: "P" });
    expect(parseFormula("-> Q")).toEqual({ type: "var", name: "Q" });
    expect(parseFormula("P |")).toEqual({ type: "var", name: "P" });
    expect(parseFormula("& Q")).toEqual({ type: "var", name: "Q" });
  });

  it("supports every alias of each connective", () => {
    expect(parseFormula("P ↔ Q")).toEqual({ type: "iff", left: P, right: Q });
    expect(parseFormula("P → Q")).toEqual(imp(P, Q));
    expect(parseFormula("P \\lor Q")).toEqual(or(P, Q));
    expect(parseFormula("P ∨ Q")).toEqual(or(P, Q));
    expect(parseFormula("P \\land Q")).toEqual(and(P, Q));
    expect(parseFormula("P ∧ Q")).toEqual(and(P, Q));
    expect(parseFormula("\\neg P")).toEqual(not(P));
    expect(parseFormula("¬P")).toEqual(not(P));
    expect(parseFormula("!P")).toEqual(not(P));
  });

  it("does not unwrap parentheses that are not a single group", () => {
    // "(P) & (Q)" starts and ends with parens but they close early.
    expect(parseFormula("(P) & (Q)")).toEqual(and(P, Q));
    expect(parseFormula("((P))")).toEqual(P);
  });

  it("returns null for input with no identifier characters", () => {
    expect(parseFormula("()")).toBeNull();
    expect(parseFormula("~")).toBeNull();
    expect(parseFormula("@#$")).toBeNull();
  });
});

describe("formatFormula, areAstsEqual and evaluation guards", () => {
  it("formats degenerate nodes defensively", () => {
    expect(formatFormula(null)).toBe("");
    expect(formatFormula(fromAny("P"))).toBe("");
    expect(formatFormula(fromAny({ type: "var" }))).toBe("");
    expect(formatFormula(fromAny({ type: "not" }))).toBe("¬");
    expect(formatFormula(not({ type: "bottom" }))).toBe("¬⊥");
    expect(formatFormula(fromAny({ type: "xor" }))).toBe("");
    expect(formatFormula(fromAny({ type: "and", left: P }))).toBe("P ∧ ");
  });

  it("parenthesises nested connectives only where precedence requires", () => {
    expect(formatFormula(imp(imp(P, Q), R))).toBe("(P → Q) → R");
    expect(formatFormula(or({ type: "iff", left: P, right: Q }, R))).toBe(
      "(P ↔ Q) ∨ R"
    );
    expect(formatFormula(and(or(P, Q), R))).toBe("(P ∨ Q) ∧ R");
    expect(formatFormula(and(imp(P, Q), R))).toBe("(P → Q) ∧ R");
    expect(formatFormula(or(and(P, Q), R))).toBe("P ∧ Q ∨ R");
    expect(formatFormula({ type: "iff", left: imp(P, Q), right: R })).toBe(
      "P → Q ↔ R"
    );
  });

  it("areAstsEqual handles missing nodes, type mismatch and unknown types", () => {
    expect(areAstsEqual(null, P)).toBe(false);
    expect(areAstsEqual(P, Q)).toBe(false);
    expect(areAstsEqual(P, not(P))).toBe(false);
    expect(areAstsEqual({ type: "bottom" }, { type: "bottom" })).toBe(true);
    expect(areAstsEqual(not(P), not(P))).toBe(true);
    expect(
      areAstsEqual(fromAny({ type: "xor" }), fromAny({ type: "xor" }))
    ).toBe(false);
    expect(
      areAstsEqual(
        { type: "iff", left: P, right: Q },
        {
          type: "iff",
          left: P,
          right: R,
        }
      )
    ).toBe(false);
  });

  it("extractVariables ignores nameless vars and non-object input", () => {
    expect(extractVariables(null)).toEqual([]);
    expect(extractVariables(fromAny({ type: "var", name: "" }))).toEqual([]);
    expect(extractVariables(and(not(Q), or(P, Q)))).toEqual(["P", "Q"]);
  });

  it("evaluateAst returns false for invalid nodes and over-deep recursion", () => {
    expect(evaluateAst(null)).toBe(false);
    expect(evaluateAst(fromAny({ type: "xor" }))).toBe(false);
    expect(evaluateAst(P, { P: true }, 501)).toBe(false);
    expect(evaluateAst({ type: "bottom" })).toBe(false);
    expect(evaluateAst({ type: "iff", left: P, right: Q }, {})).toBe(true);
  });

  it("evaluateAstWithTrace yields placeholder nodes for invalid input", () => {
    expect(evaluateAstWithTrace(null)).toEqual({
      ast: { type: "bottom" },
      label: "",
      value: false,
      children: [],
    });
    expect(evaluateAstWithTrace(fromAny({ type: "xor" })).label).toBe("");
    expect(evaluateAstWithTrace({ type: "bottom" })).toMatchObject({
      label: "⊥",
      value: false,
    });
    expect(evaluateAstWithTrace(fromAny({ type: "var", name: "" })).label).toBe(
      ""
    );
    const iff = evaluateAstWithTrace(
      { type: "iff", left: P, right: Q },
      { P: true }
    );
    expect(iff).toMatchObject({ operator: "↔", value: false });
    const trace = evaluateAstWithTrace(or(P, Q), { Q: true });
    expect(trace).toMatchObject({ operator: "∨", value: true });
  });
});

describe("generateTruthTable variable padding", () => {
  it("pads variable-free formulas with P and Q", () => {
    const res = generateTruthTable([], { label: "⊥", ast: { type: "bottom" } });
    expect(res.variables).toEqual(["P", "Q"]);
    // With no premises every row is a counterexample to ⊥.
    expect(res.truthTable.every((r) => r.isCounterexample)).toBe(true);
    expect(res.truthTable[0].premise1).toBe(false);
  });

  it("pads a lone P with Q, and a lone non-P variable with P", () => {
    expect(generateTruthTable([], { label: "P", ast: P }).variables).toEqual([
      "P",
      "Q",
    ]);
    expect(
      generateTruthTable([], { label: "X", ast: { type: "var", name: "X" } })
        .variables
    ).toEqual(["P", "X"]);
  });

  it("maps r/s columns for four variables and positional fallbacks", () => {
    const S: PropAst = { type: "var", name: "S" };
    const res = generateTruthTable([{ label: "p", ast: and(P, Q) }], {
      label: "c",
      ast: or(R, S),
    });
    expect(res.variables).toEqual(["P", "Q", "R", "S"]);
    expect(res.truthTable).toHaveLength(16);
    expect(res.truthTable[0]).toMatchObject({ r: true, s: true });

    const xy = generateTruthTable([], {
      label: "x",
      ast: and({ type: "var", name: "X" }, { type: "var", name: "Y" }),
    });
    expect(xy.truthTable[0].p).toBe(true);
    expect(xy.truthTable[0].r).toBeUndefined();
    expect(xy.truthTable.at(-1)!.q).toBe(false);
  });
});

describe("getSuggestion autocomplete", () => {
  // #2532: a whitespace-only suggestion made the proof console swallow Tab.
  it("suggests nothing after a bare connect or disconnect", () => {
    expect(getSuggestion("connect ")).toBe("");
    expect(getSuggestion("disconnect ")).toBe("");
  });

  it("returns empty for empty input and exact command names", () => {
    expect(getSuggestion("")).toBe("");
    expect(getSuggestion("connect")).toBe("");
    expect(getSuggestion("zzz")).toBe("");
  });

  it("completes connect/disconnect node ids", () => {
    expect(getSuggestion("connect A")).toBe("connect A ");
    expect(getSuggestion("connect a")).toBe("connect A ");
    expect(getSuggestion("connect Z")).toBe("");
    // A trailing space after a node id yields an empty third token: nothing to suggest.
    expect(getSuggestion("disconnect B ")).toBe("");
    expect(getSuggestion("connect A c")).toBe("connect A C");
    expect(getSuggestion("connect A C")).toBe("");
    expect(getSuggestion("connect A Z")).toBe("");
  });

  it("completes apply, theorem and switch arguments", () => {
    expect(getSuggestion("apply de")).toBe("apply demorgan");
    expect(getSuggestion("apply mp")).toBe("");
    expect(getSuggestion("apply zz")).toBe("");
    expect(getSuggestion("theorem pax")).toBe("theorem paxos");
    expect(getSuggestion("switch two")).toBe("switch two-phase-commit");
    expect(getSuggestion("switch mp")).toBe("");
  });

  it("completes inspect, export, simulate, prune and delete-step", () => {
    expect(getSuggestion("inspect e")).toBe("");
    expect(getSuggestion("inspect E")).toBe("");
    expect(getSuggestion("export lat")).toBe("export latex");
    expect(getSuggestion("export pdf")).toBe("");
    expect(getSuggestion("simulate lo")).toBe("simulate loop");
    expect(getSuggestion("simulate ")).toBe("simulate normal");
    expect(getSuggestion("simulate x ")).toBe("");
    expect(getSuggestion("simulate loop")).toBe("");
    expect(getSuggestion("prune c")).toBe("");
    expect(getSuggestion("delete-step 9")).toBe("");
  });
});

describe("theorem fallbacks for unknown ids", () => {
  const unknown = fromAny<"modus-ponens", string>("no-such-theorem");

  it("evaluateProofStatus and canConnect default to modus ponens", () => {
    expect(canConnect("A", "C", [], unknown)).toEqual(canConnect("A", "C", []));
    expect(getNextTacticHint(FULL_MP_EDGES, unknown).isCompleted).toBe(true);
    expect(getDeductionLedger([], unknown)[0].formula).toBe("P");
    expect(exportProofToMarkdown([], unknown)).toContain(
      "# Proof Workspace Export: Modus Ponens"
    );
    expect(exportProofToMermaid([], unknown)).toContain(
      "%% Formal Logic Proof Graph: Modus Ponens"
    );
    expect(getCompatibleTargets("A", unknown).map((t) => t.targetId)).toEqual([
      "C",
    ]);
    expect(pruneStepOrNode(3, FULL_MP_EDGES, unknown).success).toBe(true);
  });

  it("canConnect rejects self links, duplicates and invalid pairs", () => {
    expect(canConnect("a", "A", []).reason).toBe(
      "Cannot connect a node to itself."
    );
    expect(canConnect("C", "A", [{ source: "A", target: "C" }]).reason).toBe(
      "Node C and Node A are already connected."
    );
    expect(canConnect("A", "E", []).reason).toBe(
      "No valid deductive inference rule links Node A directly to Node E."
    );
  });
});

describe("getFallacyDiagnosis", () => {
  it("diagnoses custom connections from node ASTs", () => {
    const custom = bareTheorem({
      nodes: [
        node("A", "P", "premise", { ast: P }),
        node("E", "Q", "conclusion", { ast: Q }),
      ],
    });
    const diag = getFallacyDiagnosis("a", "e", [], custom);
    expect(diag.fallacyName).toBe("Unsupported custom connection");
    expect(diag.formalFormula).toBe("P ⊢ Q");
    expect(diag.counterexampleValuation).toEqual({ P: true, Q: false });
  });

  it("falls back to generic diagnoses when custom nodes lack ASTs", () => {
    const custom = bareTheorem({
      nodes: [node("A", "P", "premise"), node("E", "Q", "conclusion")],
    });
    expect(getFallacyDiagnosis("A", "E", [], custom).fallacyName).toBe(
      "Fallacy of Incompatible Terms (Non Sequitur)"
    );
  });

  it("names circular, consequent, antecedent and non-sequitur fallacies", () => {
    const circular = getFallacyDiagnosis("b", "B", []);
    expect(circular.fallacyName).toMatch(/Circular Reasoning/);
    expect(circular.counterexampleValuation).toEqual({ P: false, Q: false });
    expect(circular.truthTable.some((r) => r.isCounterexample)).toBe(true);

    for (const [s, t] of [
      ["C", "A"],
      ["E", "C"],
    ]) {
      const d = getFallacyDiagnosis(s, t, []);
      expect(d.fallacyName).toBe("Fallacy of Affirming the Consequent");
      expect(d.counterexampleValuation).toEqual({ P: false, Q: true });
    }

    const antecedent = getFallacyDiagnosis("A", "D", []);
    expect(antecedent.fallacyName).toBe("Fallacy of Denying the Antecedent");
    expect(antecedent.counterexampleValuation).toEqual({ P: false, Q: true });

    const nonSequitur = getFallacyDiagnosis("B", "E", []);
    expect(nonSequitur.formalFormula).toBe("Node B ⊬ Node E");
    expect(nonSequitur.counterexampleValuation).toEqual({ P: true, Q: false });
  });
});

describe("tactic hints and ledger fallbacks", () => {
  it("walks every hint stage for modus ponens", () => {
    expect(getNextTacticHint([]).suggestedSource).toBe("A");
    expect(
      getNextTacticHint([{ source: "A", target: "C" }]).suggestedSource
    ).toBe("B");
    const stage2 = getNextTacticHint([
      { source: "C", target: "A" },
      { source: "C", target: "B" },
    ]);
    expect(stage2).toMatchObject({ stepNumber: 2, suggestedSource: "C" });
    const stage2b = getNextTacticHint([
      { source: "A", target: "C" },
      { source: "B", target: "C" },
      { source: "E", target: "C" },
    ]);
    expect(stage2b).toMatchObject({ stepNumber: 2, suggestedSource: "D" });
  });

  it("uses id fallbacks when theorem nodes are missing", () => {
    const th = bareTheorem();
    const first = getNextTacticHint([], th);
    expect(first.title).toBe("Establish Premise A → Intermediate C");
    expect(first.suggestedRule).toBe("Bare Rule");

    const second = getNextTacticHint([{ source: "A", target: "C" }], th);
    expect(second.title).toBe("Establish Premise B → Intermediate C");

    const third = getNextTacticHint(
      [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
      ],
      th
    );
    expect(third.title).toBe("Link Derived Antecedent C → Goal E");
    expect(third.suggestedRule).toBe("Modus Ponens");

    const fourth = getNextTacticHint(
      [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
        { source: "C", target: "E" },
      ],
      th
    );
    expect(fourth.title).toBe("Link Conditional Premise D → Goal E");

    const done = getNextTacticHint(FULL_MP_EDGES, th);
    expect(done.hint).toBe(
      "All premises are satisfied. Target conclusion is proven with mathematical certainty."
    );
  });

  it("builds a ledger from default labels when nodes are missing", () => {
    const ledger = getDeductionLedger(FULL_MP_EDGES, bareTheorem());
    expect(ledger.map((s) => s.formula)).toEqual([
      "P",
      "P → Q",
      "Q",
      "Q → R",
      "R",
    ]);
    expect(ledger.map((s) => s.nodeId)).toEqual(["A", "B", "C", "D", "E"]);
    expect(ledger[2]).toMatchObject({ rule: "Bare Rule", isDeletable: true });
    expect(ledger[4]).toMatchObject({
      rule: "Modus Ponens",
      isProven: true,
      plainEnglish: "Target conclusion proven with mathematical certainty.",
    });
  });
});

describe("pruneStepOrNode", () => {
  it("rejects out-of-range steps and unknown nodes", () => {
    expect(pruneStepOrNode(9, FULL_MP_EDGES).reason).toBe(
      "Step 9 is out of bounds (valid steps: 1 to 5)."
    );
    expect(pruneStepOrNode("Z", FULL_MP_EDGES).reason).toBe(
      "Node 'Z' not found in active theorem 'Modus Ponens'."
    );
  });

  it("refuses to prune premises by step or node id", () => {
    for (const target of [1, 2, 4, "a", "B", "d"]) {
      const res = pruneStepOrNode(target, FULL_MP_EDGES);
      expect(res.success).toBe(false);
      expect(res.reason).toMatch(/foundational premise and immutable axiom/);
      expect(res.newEdges).toBe(FULL_MP_EDGES);
    }
  });

  it("prunes intermediate and goal nodes by step or id", () => {
    const step3 = pruneStepOrNode(" 3 ", FULL_MP_EDGES);
    expect(step3.prunedNodeId).toBe("C");
    expect(step3.prunedCount).toBe(3);
    expect(step3.reason).toBe("Pruned Step 3 (Q) and 3 dependent edge(s).");

    const byId = pruneStepOrNode("e", FULL_MP_EDGES);
    expect(byId.prunedStepNumber).toBe(5);
    expect(byId.newEdges).toEqual(FULL_MP_EDGES.slice(0, 2));

    const nothing = pruneStepOrNode(5, []);
    expect(nothing.success).toBe(true);
    expect(nothing.reason).toMatch(/had no active edges to prune\.$/);
  });

  it("falls back to default ids when the theorem omits them", () => {
    const th = bareTheorem({
      intermediateNodeId: "",
      targetNodeId: "",
      nodes: [
        node("C", "Lemma", "intermediate"),
        node("E", "Goal", "conclusion"),
        node("X", "Extra", "intermediate"),
      ],
    });
    expect(pruneStepOrNode(3, [], th).prunedNodeId).toBe("C");
    expect(pruneStepOrNode(5, [], th).prunedNodeId).toBe("E");
    expect(pruneStepOrNode("c", [], th).prunedStepNumber).toBe(3);
    expect(pruneStepOrNode("E", [], th).prunedStepNumber).toBe(5);
    // Non-standard derived nodes have no step number.
    const extra = pruneStepOrNode("x", [{ source: "X", target: "E" }], th);
    expect(extra.prunedStepNumber).toBeUndefined();
    expect(extra.reason).toBe("Pruned Step X (Extra) and 1 dependent edge(s).");
  });
});

describe("applyRuleToAsts", () => {
  it("validates premise counts for every rule", () => {
    const cases: [string, PropAst[]][] = [
      ["mp", [P]],
      ["mt", [P]],
      ["hs", [P]],
      ["ds", [P]],
      ["and_intro", [P]],
      ["res", [P]],
      ["demorgan", [P, Q]],
      ["and_elim", [P, Q]],
      ["raa", [P, Q]],
    ];
    for (const [rule, inputs] of cases) {
      const res = applyRuleToAsts(rule, inputs);
      expect(res.success).toBe(false);
      expect(res.explanation).toMatch(/require/i);
    }
  });

  it("matches reversed premise orders", () => {
    expect(applyRuleToAsts("modus-ponens", [imp(P, Q), P]).resultAst).toEqual(
      Q
    );
    expect(
      applyRuleToAsts("modus-tollens", [not(Q), imp(P, Q)]).resultAst
    ).toEqual(not(P));
    expect(
      applyRuleToAsts("hypothetical-syllogism", [imp(Q, R), imp(P, Q)])
        .resultAst
    ).toEqual(imp(P, R));
    expect(
      applyRuleToAsts("disjunctive-syllogism", [not(Q), or(P, Q)]).resultAst
    ).toEqual(P);
  });

  it("reports mismatched premise shapes", () => {
    expect(applyRuleToAsts("mp", [P, Q]).explanation).toBe(
      "Premises do not match Modus Ponens form (P and P → Q)."
    );
    expect(applyRuleToAsts("mt", [imp(P, Q), not(R)]).success).toBe(false);
    expect(applyRuleToAsts("hs", [imp(P, Q), imp(R, P)]).resultAst).toEqual(
      imp(R, Q)
    );
    expect(applyRuleToAsts("hs", [imp(P, Q), imp(R, R)]).success).toBe(false);
    expect(applyRuleToAsts("hs", [P, Q]).success).toBe(false);
    expect(applyRuleToAsts("ds", [or(P, Q), not(R)]).success).toBe(false);
    expect(applyRuleToAsts("ds", [P, Q]).success).toBe(false);
  });

  it("combines conjunctions and eliminates them", () => {
    expect(applyRuleToAsts("conjunction-intro", [P, Q]).resultAst).toEqual(
      and(P, Q)
    );
    expect(applyRuleToAsts("conjunction-elim", [and(P, Q)]).resultAst).toEqual(
      P
    );
    expect(applyRuleToAsts("and_elim", [P]).success).toBe(false);
  });

  it("resolves clauses into bottom, units and multi-literal resolvents", () => {
    expect(applyRuleToAsts("res", [P, not(P)]).resultAst).toEqual({
      type: "bottom",
    });
    expect(applyRuleToAsts("resolution", [not(P), or(P, Q)]).resultAst).toEqual(
      Q
    );
    expect(applyRuleToAsts("res", [or(P, Q), or(not(P), R)]).resultAst).toEqual(
      or(Q, R)
    );
    expect(applyRuleToAsts("res", [or(P, Q), R]).explanation).toBe(
      "No complementary literals found across clauses for Resolution."
    );
  });

  it("applies De Morgan to both forms and rejects others", () => {
    expect(applyRuleToAsts("demorgan", [not(and(P, Q))]).resultAst).toEqual(
      or(not(P), not(Q))
    );
    expect(
      applyRuleToAsts("de-morgans-laws", [not(or(P, Q))]).resultAst
    ).toEqual(and(not(P), not(Q)));
    expect(applyRuleToAsts("demorgan", [not(P)]).success).toBe(false);
    expect(applyRuleToAsts("demorgan", [P]).success).toBe(false);
  });

  it("applies reductio ad absurdum only to P → ⊥", () => {
    expect(
      applyRuleToAsts("reductio-ad-absurdum", [imp(P, { type: "bottom" })])
        .resultAst
    ).toEqual(not(P));
    expect(applyRuleToAsts("raa", [imp(P, Q)]).success).toBe(false);
  });

  it("reports unknown rules", () => {
    expect(applyRuleToAsts("Teleport", [P])).toEqual({
      success: false,
      explanation: "Unknown rule 'Teleport'.",
    });
  });
});

describe("scanApplicableRules", () => {
  const nodes: ProofNode[] = [
    node("A", "P", "premise"),
    node("B", "P -> Q", "premise"),
    node("C", "Q", "intermediate"),
    node("X", "@@@", "premise"),
  ];

  it("prompts for selection when nothing is selected", () => {
    const matches = scanApplicableRules(nodes, []);
    expect(matches.every((m) => !m.isApplicable)).toBe(true);
    expect(matches[0].explanation).toMatch(/Select \d premise node/);
  });

  it("flags unparseable selections", () => {
    const matches = scanApplicableRules(nodes, ["X"]);
    expect(matches[0].explanation).toBe(
      "Selected nodes contain invalid formula expressions."
    );
  });

  it("reports arity mismatches with singular/plural wording", () => {
    const one = scanApplicableRules(nodes, ["A"]);
    const mp = one.find((m) => m.ruleId === "mp")!;
    expect(mp.explanation).toMatch(/requires 2 premises, but 1 is selected\./);
    const two = scanApplicableRules(nodes, ["A", "B"]);
    const elim = two.find((m) => m.ruleId === "and_elim")!;
    expect(elim.explanation).toMatch(
      /requires 1 premise, but 2 are selected\./
    );
  });

  it("parses labels, tries reverse order, and recommends matching targets", () => {
    const matches = scanApplicableRules(nodes, ["B", "A"], "C");
    const mp = matches.find((m) => m.ruleId === "mp")!;
    expect(mp.isApplicable).toBe(true);
    expect(mp.resultFormula).toBe("Q");
    expect(mp.isRecommended).toBe(true);
  });

  it("recommends results already present on the canvas without a target", () => {
    const matches = scanApplicableRules(nodes, ["A", "B"]);
    expect(matches.find((m) => m.ruleId === "mp")!.isRecommended).toBe(true);
    const intro = matches.find((m) => m.ruleId === "and_intro")!;
    expect(intro.isApplicable).toBe(true);
    expect(intro.isRecommended).toBe(false);
  });

  it("ignores unknown selected ids and unknown targets", () => {
    const matches = scanApplicableRules(nodes, ["A", "ZZ"], "ZZ");
    expect(matches[0].explanation).toBe(
      "Selected nodes contain invalid formula expressions."
    );
  });
});

describe("solveNextDeductionStep", () => {
  it("reports an already discharged goal", () => {
    const nodes = [
      node("A", "P", "premise"),
      node("B", "P -> Q", "premise"),
      node("C", "Q", "conclusion"),
    ];
    const res = solveNextDeductionStep(
      nodes,
      [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
      ],
      "C"
    );
    expect(res).toEqual({
      success: false,
      message: "Goal already fully discharged (Q.E.D.)!",
    });
  });

  it("derives single-premise steps from node labels", () => {
    const nodes = [node("A", "P & Q", "premise"), node("C", "P", "conclusion")];
    const res = solveNextDeductionStep(nodes, [], "C");
    expect(res.success).toBe(true);
    expect(res.ruleId).toBe("and_elim");
    expect(res.newEdges).toEqual([
      { source: "A", target: "C", ruleApplied: res.newEdges![0].ruleApplied },
    ]);
  });

  it("prefers the goal over other derivable nodes", () => {
    const nodes = [
      node("A", "P", "premise"),
      node("B", "P -> Q", "premise"),
      node("X", "P & (P -> Q)", "intermediate"),
      node("C", "Q", "conclusion"),
    ];
    const res = solveNextDeductionStep(nodes, [], "C");
    expect(res.targetNodeId).toBe("C");
    expect(res.sourceNodeIds!.sort()).toEqual(["A", "B"]);
  });

  it("skips unparseable nodes and reports when nothing applies", () => {
    const nodes = [
      node("A", "@@@", "premise"),
      node("B", "R", "premise"),
      node("C", "Q", "conclusion"),
    ];
    const res = solveNextDeductionStep(nodes, [], "C");
    expect(res.success).toBe(false);
    expect(res.message).toBe(
      "No valid forward deduction step found for currently proven nodes."
    );
  });

  it("does not re-propose fully wired single-premise steps", () => {
    const nodes = [
      node("A", "P & Q", "premise"),
      node("Z", "R", "intermediate"),
      node("C", "P", "conclusion"),
    ];
    // C has an edge from A but also depends on unproven Z, so C is unproven,
    // yet the A -> C step already exists and must not be suggested again.
    const res = solveNextDeductionStep(
      nodes,
      [
        { source: "A", target: "C" },
        { source: "Z", target: "C" },
      ],
      "C"
    );
    expect(res.success).toBe(false);
  });

  it("propagates proof through intermediate nodes with incoming edges", () => {
    const nodes = [
      node("A", "P", "premise"),
      node("B", "P -> Q", "premise"),
      node("C", "Q", "intermediate"),
      node("D", "Q -> R", "premise"),
      node("E", "R", "conclusion"),
    ];
    const res = solveNextDeductionStep(
      nodes,
      [
        { source: "A", target: "C" },
        { source: "B", target: "C" },
      ],
      "E"
    );
    expect(res.success).toBe(true);
    expect(res.targetNodeId).toBe("E");
    expect(res.sourceNodeIds!.sort()).toEqual(["C", "D"]);
  });
});

describe("export helpers", () => {
  it("falls back to text/plain for unknown formats", () => {
    expect(getExportMimeType(fromAny("pdf"))).toBe("text/plain;charset=utf-8");
  });

  it("derives filenames from ids, titles and unknown formats", () => {
    expect(getExportFilename("lean")).toBe("proof-modus-ponens.lean");
    expect(getExportFilename(fromAny("pdf"), "resolution")).toBe(
      "proof-resolution.txt"
    );
    expect(
      getExportFilename(
        "markdown",
        fromAny<"modus-ponens", string>("Proof of Things!")
      )
    ).toBe("proof-of-things.md");
    expect(
      getExportFilename(
        "mermaid",
        fromPartial<TheoremDefinition>({ title: "Untitled" })
      )
    ).toBe("proof-untitled.mmd");
    expect(
      getExportFilename(
        "latex",
        fromPartial<TheoremDefinition>({ id: fromAny("!!!") })
      )
    ).toBe("proof-workspace.tex");
    expect(getExportFilename("latex", fromPartial<TheoremDefinition>({}))).toBe(
      "proof.tex"
    );
  });

  it("exportWorkspaceProof refuses the custom workspace and marks incomplete graphs", () => {
    expect(exportWorkspaceProof("lean", [], "custom")).toMatch(
      /^CUSTOM WORKSPACE UNAVAILABLE/
    );
    expect(exportWorkspaceProof("lean", [])).toMatch(/^-- INCOMPLETE/);
    expect(exportWorkspaceProof("latex", [])).toMatch(/^% INCOMPLETE/);
    expect(exportWorkspaceProof("lean", FULL_MP_EDGES)).toContain(
      "not checked by the Lean kernel"
    );
    expect(exportWorkspaceProof("latex", FULL_MP_EDGES)).toContain(
      "has not been independently checked"
    );
    expect(exportWorkspaceProof("markdown", FULL_MP_EDGES)).toContain(
      "✔ GRAPH COMPLETE"
    );
    expect(exportWorkspaceProof("mermaid", [])).toContain(
      "class Node_C pending;"
    );
  });

  it("renders custom mermaid graphs with proven and pending classes", () => {
    const th = bareTheorem({
      nodes: [
        node("A", 'Say "hi"', "premise"),
        node("C", "Lemma", "intermediate"),
        node("E", "Goal", "conclusion"),
      ],
    });
    const pending = exportProofToMermaid([], th);
    expect(pending).toContain("graph TD");
    expect(pending).toContain('Say \\"hi\\"');
    expect(pending).toContain("class Node_A proven;");
    expect(pending).toContain("class Node_C,Node_E pending;");

    const done = exportProofToMermaid(FULL_MP_EDGES, th);
    expect(done).toContain("class Node_A,Node_C,Node_E proven;");
    expect(done).not.toContain(" pending;\n");

    const noPremises = exportProofToMermaid(
      [],
      bareTheorem({ nodes: [node("C", "Lemma", "intermediate")] })
    );
    expect(noPremises).toContain("class Node_C pending;");
    expect(noPremises).not.toMatch(/class .* proven;/);
  });

  it("markdown export shows pending steps for an incomplete graph", () => {
    const md = exportProofToMarkdown([{ source: "A", target: "C" }]);
    expect(md).toContain("⏳ INCOMPLETE");
    expect(md).toContain("⏳ PENDING");
    expect(md).toContain("● GIVEN");
  });
});

describe("getCompatibleTargets", () => {
  it("returns nothing for unknown sources", () => {
    expect(getCompatibleTargets("Z")).toEqual([]);
  });

  it("omits already-connected targets", () => {
    expect(
      getCompatibleTargets("A", "modus-ponens", [{ source: "A", target: "C" }])
    ).toEqual([]);
  });

  it("derives symbols for unknown intermediate rules and defaults goal rules", () => {
    const th = bareTheorem({
      ruleName: "Quantum Entanglement (X ⊢ Y)",
      validPairs: [
        ["A", "C"],
        ["C", "E"],
      ],
      nodes: [
        node("A", "P", "premise"),
        node("C", "Q", "intermediate"),
        node("E", "R", "conclusion", { ruleUsed: "Not A Real Rule" }),
      ],
    });
    const [inter] = getCompatibleTargets("a", th);
    expect(inter).toMatchObject({
      targetId: "C",
      ruleId: "mp",
      ruleName: "Quantum Entanglement",
      ruleSymbol: "QE",
      badgeLabel: "QE Target ⊢ Q",
    });

    const [goal] = getCompatibleTargets("C", th);
    expect(goal.targetId).toBe("E");
    expect(goal.ruleId).toBe("mp");
    expect(goal.hint).toBe("Connect [C: Q] to [E: R] via Modus Ponens");
  });
});

describe("computeMagneticSnap", () => {
  it("snaps to grid when there are no peers", () => {
    const res = computeMagneticSnap(41, 59, 100, 40, []);
    expect(res).toEqual({
      x: 40,
      y: 60,
      snappedX: true,
      snappedY: true,
      guides: [],
    });
  });

  it("does not snap beyond the threshold or with the grid disabled", () => {
    const off = computeMagneticSnap(30, 30, 100, 40, [], {
      gridSize: 100,
      threshold: 5,
    });
    expect(off).toMatchObject({
      x: 30,
      y: 30,
      snappedX: false,
      snappedY: false,
    });

    const disabled = computeMagneticSnap(41, 59, 100, 40, [], {
      enableGrid: false,
    });
    expect(disabled.snappedX).toBe(false);
    const zeroGrid = computeMagneticSnap(41, 59, 100, 40, [], { gridSize: 0 });
    expect(zeroGrid.snappedY).toBe(false);
  });

  it("aligns to peer edges and centres, emitting guides", () => {
    const peer = { id: "p1", x: 200, y: 300, width: 100, height: 40 };
    const res = computeMagneticSnap(205, 1000, 100, 40, [peer], {
      enableGrid: false,
    });
    expect(res.x).toBe(200);
    expect(res.snappedX).toBe(true);
    expect(res.snappedY).toBe(false);
    expect(res.guides).toEqual([
      {
        type: "vertical",
        pos: 250,
        start: 280,
        end: 1060,
        targetNodeId: "p1",
      },
    ]);

    // Right-edge and bottom-edge alignment with a differently sized peer.
    const wide = { id: "p2", x: 0, y: 0, width: 300, height: 100 };
    const edge = computeMagneticSnap(198, 62, 100, 40, [wide], {
      enableGrid: false,
    });
    expect(edge.x).toBe(200);
    expect(edge.y).toBe(60);
    expect(edge.guides.map((g) => g.type)).toEqual(["vertical", "horizontal"]);
  });

  it("ignores alignment when disabled and falls back to the grid", () => {
    const peer = { id: "p1", x: 203, y: 303 };
    const res = computeMagneticSnap(205, 305, 100, 40, [peer], {
      enableAlignment: false,
    });
    expect(res).toMatchObject({ x: 200, y: 300, guides: [] });
  });
});

describe("misc", () => {
  it("isValidNode rejects empty ids and accepts case-insensitive ids", () => {
    expect(isValidNode("")).toBe(false);
    expect(isValidNode("j")).toBe(true);
    expect(isValidNode("K")).toBe(false);
  });

  it("every built-in theorem exposes a modus-ponens shaped graph", () => {
    for (const th of Object.values(THEOREMS)) {
      expect(th.intermediateRequires).toHaveLength(2);
    }
  });
});
