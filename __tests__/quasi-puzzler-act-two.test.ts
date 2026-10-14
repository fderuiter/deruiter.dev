// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ACT_ONE_CAPSTONE_LEVEL_ID,
  ACT_TWO_FIRST_CHAPTER,
  cloneAST,
  generateLeanProofScript,
  instantiatePattern,
  isActTwoUnlocked,
  isLevelLocked,
  isProofComplete,
  matchPattern,
  occursFree,
  parseFormula,
  parseGameProgress,
  parseHypotheses,
  puzzleLevels,
  renderASTString,
  stripForalls,
  substituteVariable,
  tacticDefs,
  withUnlockedChapter,
  type ASTNode,
  type LevelScore,
} from "@/lib/quasi-perfect";

const f = (text: string) => parseFormula(text, "t");
const named = (name: string, text: string): ASTNode => ({
  ...f(text),
  metadata: { name },
});
const show = (node: ASTNode | undefined) => (node ? renderASTString(node) : "");

describe("parser: quantifiers, ≤ and function application (#2091)", () => {
  it("parses ∀ and ∃ with the body running to the end", () => {
    const node = f("∀ n, n + 0 = n");
    expect(node.type).toBe("Forall");
    expect(node.value).toBe("n");
    expect(node.children?.[0].type).toBe("Equality");
    expect(renderASTString(node)).toBe("∀ n, n + 0 = n");
    expect(renderASTString(f("∃ x, x + 4 = 7"))).toBe("∃ x, x + 4 = 7");
  });

  it("nests one binder per name and accepts ASCII spellings", () => {
    const node = f("forall a b, a + b = b + a");
    expect(node.type).toBe("Forall");
    expect(node.children?.[0].type).toBe("Forall");
    expect(renderASTString(node)).toBe("∀ a, ∀ b, a + b = b + a");
    expect(f("exists x, x = 1").type).toBe("Exists");
  });

  it("brackets a quantifier used as an operand", () => {
    expect(renderASTString(f("(∀ n, P) → Q"))).toBe("(∀ n, P) → Q");
  });

  it("parses ≤, ≥, <, > and their ASCII forms as inequalities", () => {
    expect(f("a <= b").value).toBe("≤");
    expect(f("a ≥ b").value).toBe("≥");
    expect(f("a < b").type).toBe("Inequality");
    expect(f("a > b").value).toBe(">");
    expect(renderASTString(f("n + 1 ≤ 2 ^ n"))).toBe("n + 1 ≤ 2 ^ n");
  });

  it("parses function application, including σ", () => {
    const node = f("σ(n) = 2 * n + 1");
    expect(node.children?.[0]).toMatchObject({ type: "Function", value: "σ" });
    expect(f("g(a, b)").children).toHaveLength(2);
  });

  it("reports a missing comma or bound variable", () => {
    expect(() => f("∀ n n = n")).toThrow(/Expected ','/);
    expect(() => f("∀ , n")).toThrow(/variable name/);
  });

  it("keeps a binder's comma inside one hypothesis", () => {
    const hyps = parseHypotheses("h: ∀ m, m + 0 = m, g: a = b");
    expect(hyps.map((h) => h.metadata?.name)).toEqual(["h", "g"]);
    expect(renderASTString(hyps[0])).toBe("∀ m, m + 0 = m");
  });
});

describe("substitution and matching", () => {
  it("substitutes free occurrences only, with fresh ids", () => {
    const body = f("x + (∀ x, x = 1)");
    const out = substituteVariable(body, "x", f("3"));
    expect(renderASTString(out)).toBe("3 + (∀ x, x = 1)");
    const twice = substituteVariable(f("x + x"), "x", f("k + 1"));
    const [l, r] = twice.children!;
    expect(l.id).not.toBe(r.id);
  });

  it("matches a pattern consistently and instantiates it", () => {
    const pattern = f("a * (b + c)");
    const bindings = new Map<string, ASTNode>();
    expect(
      matchPattern(
        pattern,
        f("2 * (S(k) + (k + 1))"),
        new Set(["a", "b", "c"]),
        bindings
      )
    ).toBe(true);
    expect(show(bindings.get("b"))).toBe("S(k)");
    expect(
      renderASTString(instantiatePattern(f("a * b + a * c"), bindings))
    ).toBe("2 * S(k) + 2 * (k + 1)");
    // The same hole must match the same term twice.
    expect(matchPattern(f("m + m"), f("n + 1"), new Set(["m"]))).toBe(false);
  });

  it("instantiates simultaneously, so a matched name is not rewritten again", () => {
    const bindings = new Map<string, ASTNode>([
      ["a", f("b")],
      ["b", f("c")],
    ]);
    expect(renderASTString(instantiatePattern(f("a + b"), bindings))).toBe(
      "b + c"
    );
  });

  it("strips leading binders and tracks free variables", () => {
    const { variables, body } = stripForalls(f("∀ a b, a + b = b + a"));
    expect(variables).toEqual(["a", "b"]);
    expect(renderASTString(body)).toBe("a + b = b + a");
    expect(occursFree(f("∀ n, n = m"), "n")).toBe(false);
    expect(occursFree(f("∀ n, n = m"), "m")).toBe(true);
  });

  it("treats x ≤ x as closed, like rfl, but not x < x", () => {
    expect(isProofComplete(f("c ≤ c"))).toBe(true);
    expect(isProofComplete(f("c ≥ c"))).toBe(true);
    expect(isProofComplete(f("c < c"))).toBe(false);
    expect(isProofComplete(f("c ≤ d"))).toBe(false);
  });
});

describe("intro on ∀ and the use tactic", () => {
  it("intro fixes the bound variable", () => {
    const goal = f("∀ n, n + 0 = n");
    const res = tacticDefs.intro.execute(goal, goal, []);
    expect(res.success).toBe(true);
    expect(show(res.newAST)).toBe("n + 0 = n");
    expect(res.leanProofStep).toBe("intro n");
  });

  it("intro on an implication is unchanged", () => {
    const goal = f("P → P");
    const res = tacticDefs.intro.execute(goal, goal, [], "h");
    expect(res.leanProofStep).toBe("intro h");
    expect(res.newHypotheses?.[0].metadata?.name).toBe("h");
  });

  it("use substitutes the witness and leaves the claim", () => {
    const goal = f("∃ x, x + 4 = 7");
    const res = tacticDefs.use.execute(goal, goal, [], "3");
    expect(res.success).toBe(true);
    expect(show(res.newAST)).toBe("3 + 4 = 7");
    expect(res.leanProofStep).toBe("use 3");
    expect(res.ramConsumed).toBe(tacticDefs.use.baseRamCost);
  });

  it("use closes a claim that holds by rfl", () => {
    const goal = f("∃ b, b = a + 1");
    const res = tacticDefs.use.execute(goal, goal, [], "a + 1");
    expect(res.isProofComplete).toBe(true);
    expect(res.leanProofStep).toBe("use a + 1");
  });

  it("a wrong witness leaves a false goal norm_num cannot close", () => {
    const goal = f("∃ x, x + 4 = 7");
    const res = tacticDefs.use.execute(goal, goal, [], "4");
    const after = res.newAST!;
    expect(tacticDefs.norm_num.execute(after, after, []).success).toBe(false);
  });

  it("use fails without an ∃ goal or a witness", () => {
    const eq = f("x = x");
    expect(tacticDefs.use.execute(eq, eq, [], "1").success).toBe(false);
    const ex = f("∃ x, x = 1");
    const res = tacticDefs.use.execute(ex, ex, []);
    expect(res.success).toBe(false);
    expect(res.ramConsumed).toBe(tacticDefs.use.failureCost);
  });
});

describe("induction", () => {
  it("splits ∀ n into a base case and a step case with ih", () => {
    const goal = f("∀ n, 0 + n = n");
    const res = tacticDefs.induction.execute(goal, goal, []);
    expect(res.success).toBe(true);
    const [base, step] = res.newSubGoals!;
    expect(show(base.goal)).toBe("0 + 0 = 0");
    expect(show(step.goal)).toBe("0 + (k + 1) = k + 1");
    const ih = step.hypotheses.find((h) => h.metadata?.name === "ih");
    expect(show(ih)).toBe("0 + k = k");
    expect(base.hypotheses.some((h) => h.metadata?.name === "ih")).toBe(false);
    expect(res.leanProofStep).toBe("intro n; induction' n with k ih");
  });

  it("picks a step variable that is not already in use", () => {
    const goal = f("∀ n, n + k = k + n");
    const res = tacticDefs.induction.execute(goal, goal, []);
    expect(show(res.newSubGoals![1].goal)).toBe("m + 1 + k = k + (m + 1)");
  });

  it("works on a named free variable, and fails on anything else", () => {
    const goal = f("n + 0 = n");
    const named = tacticDefs.induction.execute(goal, goal, [], "n");
    expect(named.success).toBe(true);
    expect(named.leanProofStep).toBe("induction' n with k ih");
    expect(tacticDefs.induction.execute(goal, goal, []).success).toBe(false);
  });
});

describe("rw and exact with ∀ lemmas", () => {
  it("rw instantiates the lemma at the selected sub-term", () => {
    const goal = f("2 * S(k + 1) = 0");
    const target = goal.children![0].children![1];
    const lemma = named("S_succ", "∀ m, S(m + 1) = S(m) + (m + 1)");
    const res = tacticDefs.rw.execute(target, goal, [lemma], "S_succ");
    expect(res.success).toBe(true);
    expect(show(res.newAST)).toBe("2 * (S(k) + (k + 1)) = 0");
    expect(res.leanProofStep).toBe("rw [S_succ]");
  });

  it("rw rewrites right to left when only the right side matches", () => {
    const goal = f("n + n = 4");
    const lemma = named("two_mul", "∀ m, 2 * m = m + m");
    const res = tacticDefs.rw.execute(
      goal.children![0],
      goal,
      [lemma],
      "two_mul"
    );
    expect(show(res.newAST)).toBe("2 * n = 4");
    expect(res.leanProofStep).toBe("rw [← two_mul]");
  });

  it("rw refuses a side that is a bare variable", () => {
    const goal = f("0 + 0 = 0");
    const lemma = named("add_zero", "∀ m, m + 0 = m");
    const res = tacticDefs.rw.execute(goal, goal, [lemma], "add_zero");
    expect(res.success).toBe(false);
    expect(res.ramConsumed).toBe(tacticDefs.rw.failureCost);
  });

  it("exact closes an instance and names the arguments", () => {
    const goal = f("n + 0 = n");
    const lemma = named("add_zero", "∀ m, m + 0 = m");
    const res = tacticDefs.exact.execute(goal, goal, [lemma], "add_zero");
    expect(res.isProofComplete).toBe(true);
    expect(res.leanProofStep).toBe("exact add_zero n");
    const wrong = f("n + 1 = n");
    expect(
      tacticDefs.exact.execute(wrong, wrong, [lemma], "add_zero").success
    ).toBe(false);
  });
});

describe("trans and gcongr", () => {
  const h1 = named("h1", "a ≤ b");
  const h3 = named("h3", "c ≤ d");

  it("trans moves the left end with a hypothesis that starts there", () => {
    const goal = f("a ≤ d");
    const res = tacticDefs.trans.execute(goal, goal, [h1, h3], "h1");
    expect(show(res.newAST)).toBe("b ≤ d");
    expect(res.leanProofStep).toBe("apply le_trans h1");
  });

  it("trans moves the right end with a hypothesis that ends there", () => {
    const goal = f("b ≤ d");
    const res = tacticDefs.trans.execute(goal, goal, [h1, h3], "h3");
    expect(show(res.newAST)).toBe("b ≤ c");
    expect(res.leanProofStep).toBe("refine le_trans ?_ h3");
  });

  it("trans instantiates a quantified bound", () => {
    const goal = f("k + 1 + 1 ≤ 2 * 2 ^ k");
    const lemma = named("succ_le_double", "∀ m, m + 1 + 1 ≤ 2 * (m + 1)");
    const res = tacticDefs.trans.execute(goal, goal, [lemma], "succ_le_double");
    expect(show(res.newAST)).toBe("2 * (k + 1) ≤ 2 * 2 ^ k");
    expect(res.leanProofStep).toBe("apply le_trans (succ_le_double k)");
  });

  it("trans fails when no end matches or the goal is not ≤", () => {
    const goal = f("x ≤ y");
    expect(tacticDefs.trans.execute(goal, goal, [h1], "h1").success).toBe(
      false
    );
    const eq = f("a = d");
    expect(tacticDefs.trans.execute(eq, eq, [h1], "h1").success).toBe(false);
  });

  it("gcongr reduces to the one difference and closes it by assumption", () => {
    const goal = f("x + 1 ≤ y + 1");
    const open = tacticDefs.gcongr.execute(goal, goal, []);
    expect(show(open.newAST)).toBe("x ≤ y");
    expect(open.isProofComplete).toBe(false);
    const closed = tacticDefs.gcongr.execute(goal, goal, [named("h", "x ≤ y")]);
    expect(closed.isProofComplete).toBe(true);
    expect(closed.leanProofStep).toBe("gcongr");
  });

  it("gcongr descends through nested monotone positions", () => {
    const goal = f("n + 1 + 1 ≤ n + n + 1");
    expect(show(tacticDefs.gcongr.execute(goal, goal, []).newAST)).toBe(
      "1 ≤ n"
    );
  });

  it("gcongr refuses σ, subtrahends, two differences and unrelated sides", () => {
    for (const text of [
      "σ(a) ≤ σ(b)",
      "c - a ≤ c - b",
      "a + b ≤ c + d",
      "a ≤ b * 2",
    ]) {
      const goal = f(text);
      expect(tacticDefs.gcongr.execute(goal, goal, []).success).toBe(false);
    }
  });
});

describe("every new tactic has a card definition and a Lean line", () => {
  it.each(["use", "induction", "trans", "gcongr"] as const)("%s", (id) => {
    const def = tacticDefs[id];
    expect(def.id).toBe(id);
    expect(def.baseRamCost).toBeGreaterThan(0);
    expect(def.failureCost).toBeGreaterThan(0);
    expect(def.description.length).toBeGreaterThan(20);
  });

  it("the Act 2 Lean script lists the steps under the theorem", () => {
    const level = puzzleLevels.find((l) => l.id === 19)!;
    const script = generateLeanProofScript(
      level,
      [
        {
          id: "1",
          tacticId: "intro",
          leanLine: "intro n",
          explanation: "",
          goalBefore: "",
          goalAfter: "",
        },
        {
          id: "2",
          tacticId: "exact",
          leanLine: "exact add_zero n",
          explanation: "",
          goalBefore: "",
          goalAfter: "",
        },
      ],
      true
    );
    expect(script).toContain(
      `theorem for_every_number ${level.leanTypeSignature} := by`
    );
    expect(script).toContain("  intro n\n  exact add_zero n");
  });
});

describe("Act 2 levels", () => {
  const actTwo = puzzleLevels.filter((l) => l.chapter >= ACT_TWO_FIRST_CHAPTER);

  it("adds twelve levels in four chapters after the Act 1 capstone", () => {
    expect(actTwo.map((l) => l.id)).toEqual([
      19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    ]);
    expect(new Set(actTwo.map((l) => l.chapter))).toEqual(
      new Set([4, 5, 6, 7])
    );
    expect(puzzleLevels.slice(0, 18).every((l) => l.chapter <= 3)).toBe(true);
  });

  it("keeps node ids unique within each level", () => {
    for (const level of actTwo) {
      const ids: string[] = [];
      const walk = (n: ASTNode) => {
        ids.push(n.id);
        n.children?.forEach(walk);
      };
      walk(level.goal);
      level.hypotheses.forEach(walk);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("states every level with hints, a briefing and named hypotheses", () => {
    for (const level of actTwo) {
      expect(level.hints).toHaveLength(3);
      expect(level.educationalConcept.summary.length).toBeGreaterThan(40);
      expect(level.availableTactics).toContain("sorry");
      expect(level.availableTactics.length).toBeLessThanOrEqual(8);
      for (const h of level.hypotheses) expect(h.metadata?.name).toBeTruthy();
      expect(cloneAST(level.goal)).toEqual(level.goal);
    }
  });
});

describe("Act 2 unlock (#2091)", () => {
  const score = (usedSorry: boolean): LevelScore => ({
    levelId: ACT_ONE_CAPSTONE_LEVEL_ID,
    completed: true,
    usedSorry,
    remainingRam: 7,
    stars: usedSorry ? 0 : 3,
    morality: usedSorry ? -100 : 100,
    timestamp: 1,
  });
  const act2 = { chapter: 4 };
  const act1 = { chapter: 3 };

  it("is locked on a fresh save and Act 1 never is", () => {
    const fresh = parseGameProgress(null);
    expect(isActTwoUnlocked(fresh)).toBe(false);
    expect(isLevelLocked(fresh, act2)).toBe(true);
    expect(isLevelLocked(fresh, act1)).toBe(false);
  });

  it("opens from an old save whose capstone was proved honestly", () => {
    const raw = JSON.stringify({
      completedLevels: { 18: score(false) },
      currentLevelIndex: 17,
    });
    const progress = parseGameProgress(raw);
    expect(progress.completedLevels[18]).toEqual(score(false));
    expect(progress.unlockedChapter).toBeUndefined();
    expect(isActTwoUnlocked(progress)).toBe(true);
  });

  it("stays shut when the capstone was admitted with sorry", () => {
    const progress = parseGameProgress(
      JSON.stringify({ completedLevels: { 18: score(true) } })
    );
    expect(isActTwoUnlocked(progress)).toBe(false);
    expect(withUnlockedChapter(progress)).toBe(progress);
  });

  it("records unlockedChapter once, and honours it on its own", () => {
    const base = parseGameProgress(
      JSON.stringify({ completedLevels: { 18: score(false) } })
    );
    const opened = withUnlockedChapter(base);
    expect(opened.unlockedChapter).toBe(4);
    expect(withUnlockedChapter(opened)).toBe(opened);
    expect(isActTwoUnlocked({ completedLevels: {}, unlockedChapter: 4 })).toBe(
      true
    );
    expect(
      isActTwoUnlocked({
        completedLevels: {},
        unlockedChapter: "4" as unknown as number,
      })
    ).toBe(false);
  });
});
