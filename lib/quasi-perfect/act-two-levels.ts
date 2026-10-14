import { parseFormula } from "./compiler";
import type { ASTNode, PuzzlerLevelDef } from "./types";

/**
 * Act 2 of the campaign (#2091): quantifiers, induction, ≤ chains and a
 * second number-theory arc. Every level is hand-written; the formulas are
 * parsed once at load with fixed id prefixes, so the levels are the same on
 * every load.
 */

function goal(text: string, prefix: string): ASTNode {
  return parseFormula(text, prefix);
}

function hyp(name: string, text: string, prefix: string): ASTNode {
  const node = parseFormula(text, prefix);
  node.metadata = { ...(node.metadata ?? {}), name };
  return node;
}

const QUANTIFIERS = "Quantifiers";
const INDUCTION = "Induction";
const CHAINS = "Inequality Chains";
const ALMOST_PERFECT = "Almost Perfect Numbers";

export const actTwoLevels: PuzzlerLevelDef[] = [
  // =========================================================================
  // CHAPTER 4: Quantifiers
  // =========================================================================
  {
    id: 19,
    chapter: 4,
    chapterTitle: QUANTIFIERS,
    title: "For Every Number",
    subtitle: "Level 19 · ∀ Introduction",
    description:
      "Prove ∀ n, n + 0 = n from the lemma add_zero : ∀ m, m + 0 = m by fixing an arbitrary n and instantiating the lemma.",
    initialRam: 10,
    goldRamTarget: 7,
    silverRamTarget: 4,
    hypotheses: [hyp("add_zero", "∀ m, m + 0 = m", "l19-h")],
    goal: goal("∀ n, n + 0 = n", "l19-g"),
    availableTactics: [
      "intro",
      { id: "exact", hypothesis: "add_zero", labelOverride: "exact add_zero" },
      { id: "rw", hypothesis: "add_zero", labelOverride: "rw [add_zero]" },
      "sorry",
    ],
    hints: [
      "To prove a statement for every n, pick an arbitrary n and prove it for that one.",
      "'intro' on the ∀ goal fixes n and leaves n + 0 = n.",
      "Then 'exact add_zero' closes it: the lemma with m := n is exactly the goal.",
    ],
    leanTheoremName: "for_every_number",
    leanTypeSignature:
      "(add_zero : ∀ m : Nat, m + 0 = m) : ∀ n : Nat, n + 0 = n",
    educationalConcept: {
      title: "Universal Quantification (∀ intro, ∀ elim)",
      summary:
        "A proof of ∀ n, P n is a function: give it any n and it returns a proof of P n. `intro n` starts building that function; applying a ∀ lemma to a term (`add_zero n`) uses one.",
      mathNotation: "(∀ m, m + 0 = m) ⟹ ∀ n, n + 0 = n",
      mathIntuition:
        "A claim about every number cannot be checked number by number. Instead you reason about an arbitrary n, one you know nothing special about, so the argument works for all of them at once.",
      leanAnalogy:
        "`intro n` turns the goal `∀ n, n + 0 = n` into `n + 0 = n` with `n : Nat` in context. `exact add_zero n` supplies the lemma at m := n.",
      tacticalObjective:
        "Play 'intro' on the ∀ goal, then 'exact add_zero' (3 GB in total).",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/quantifiers_and_equality.html",
      realWorldApplication:
        "Verified compilers state optimisation rules for every input program, then instantiate them at the program being compiled.",
    },
  },
  {
    id: 20,
    chapter: 4,
    chapterTitle: QUANTIFIERS,
    title: "A Witness Appears",
    subtitle: "Level 20 · ∃ Introduction",
    description:
      "Prove ∃ x, x + 4 = 7 by naming the right witness and checking the arithmetic that is left.",
    initialRam: 12,
    goldRamTarget: 7,
    silverRamTarget: 3,
    hypotheses: [],
    goal: goal("∃ x, x + 4 = 7", "l20-g"),
    availableTactics: [
      { id: "use", hypothesis: "3", labelOverride: "use 3" },
      { id: "use", hypothesis: "4", labelOverride: "use 4" },
      "norm_num",
      "decide",
      "sorry",
    ],
    hints: [
      "To prove that something exists, produce it.",
      "Which x makes x + 4 = 7 true? Only one of the two witnesses works.",
      "Play 'use 3', then 'norm_num' to check 3 + 4 = 7.",
    ],
    leanTheoremName: "a_witness_appears",
    leanTypeSignature: ": ∃ x : Nat, x + 4 = 7",
    educationalConcept: {
      title: "Existential Quantification (use)",
      summary:
        "A constructive proof of ∃ x, P x is a pair: a witness w and a proof of P w. `use w` supplies the witness and leaves P w as the goal.",
      mathNotation: "P(3) ⟹ ∃ x, P(x)",
      mathIntuition:
        "Existence proofs in constructive logic carry their evidence. A wrong witness is not a small error: with use 4 the goal becomes 4 + 4 = 7, which is false and cannot be proved.",
      leanAnalogy:
        "`use 3` is Mathlib's tactic for `refine ⟨3, ?_⟩`; it also tries `rfl` on what is left. Here `norm_num` then checks 3 + 4 = 7.",
      tacticalObjective: "Play 'use 3', then 'norm_num' (5 GB in total).",
      leanDocUrl:
        "https://leanprover-community.github.io/mathlib4_docs/Mathlib/Tactic/Use.html",
      realWorldApplication:
        "Test-case generators and SMT solvers answer satisfiability queries by returning a concrete model: the witness.",
    },
  },
  {
    id: 21,
    chapter: 4,
    chapterTitle: QUANTIFIERS,
    title: "Every Number Has a Successor",
    subtitle: "Level 21 · ∀∃ Alternation",
    description:
      "Prove ∀ a, ∃ b, b = a + 1: fix a, then choose a witness that depends on it.",
    initialRam: 10,
    goldRamTarget: 6,
    silverRamTarget: 3,
    hypotheses: [],
    goal: goal("∀ a, ∃ b, b = a + 1", "l21-g"),
    availableTactics: [
      "intro",
      { id: "use", hypothesis: "a + 1", labelOverride: "use a + 1" },
      { id: "use", hypothesis: "a", labelOverride: "use a" },
      "rfl",
      "sorry",
    ],
    hints: [
      "The order of quantifiers matters: b may depend on a, because a is chosen first.",
      "'intro' fixes a. The witness for b can then mention a.",
      "Play 'intro', then 'use a + 1'. The goal a + 1 = a + 1 closes by rfl on its own.",
    ],
    leanTheoremName: "every_number_has_a_successor",
    leanTypeSignature: ": ∀ a : Nat, ∃ b : Nat, b = a + 1",
    educationalConcept: {
      title: "Quantifier Alternation (∀ then ∃)",
      summary:
        "In ∀ a, ∃ b, P a b the witness b is a function of a. Swap the quantifiers to ∃ b, ∀ a and you claim one b works for every a, which is false here.",
      mathNotation: "∀ a, ∃ b, b = a + 1",
      mathIntuition:
        "Think of it as a game: an opponent picks a, then you answer with b. You win because you see a before you answer, so b = a + 1 is always available.",
      leanAnalogy:
        "`intro a` then `use a + 1`. Mathlib's `use` tries `rfl` afterwards, which closes `a + 1 = a + 1`.",
      tacticalObjective:
        "Play 'intro', then 'use a + 1' (4 GB in total). 'use a' leaves a = a + 1, which is false.",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/quantifiers_and_equality.html",
      realWorldApplication:
        "Liveness properties in protocol verification (every request eventually gets a response) are ∀∃ statements.",
    },
  },

  // =========================================================================
  // CHAPTER 5: Induction
  // =========================================================================
  {
    id: 22,
    chapter: 5,
    chapterTitle: INDUCTION,
    title: "Base and Step",
    subtitle: "Level 22 · Mathematical Induction",
    description:
      "Prove ∀ n, 0 + n = n. Addition recurses on its right argument, so 0 + n needs induction on n.",
    initialRam: 18,
    goldRamTarget: 7,
    silverRamTarget: 3,
    hypotheses: [
      hyp("add_zero", "∀ m, m + 0 = m", "l22-h1"),
      hyp("add_succ", "∀ a b, a + (b + 1) = a + b + 1", "l22-h2"),
    ],
    goal: goal("∀ n, 0 + n = n", "l22-g"),
    availableTactics: [
      "induction",
      { id: "rw", hypothesis: "add_zero", labelOverride: "rw [add_zero]" },
      { id: "rw", hypothesis: "add_succ", labelOverride: "rw [add_succ]" },
      { id: "rw", hypothesis: "ih", labelOverride: "rw [ih]" },
      "norm_num",
      "sorry",
    ],
    hints: [
      "Induction proves P 0, then proves P (k + 1) assuming P k.",
      "'induction' splits the goal. In the base case, rewrite 0 + 0 with add_zero.",
      "In the step case, rewrite 0 + (k + 1) with add_succ, then 0 + k with the hypothesis ih.",
    ],
    leanTheoremName: "zero_add_by_induction",
    leanTypeSignature:
      "(add_zero : ∀ m : Nat, m + 0 = m) (add_succ : ∀ a b : Nat, a + (b + 1) = a + b + 1) : ∀ n : Nat, 0 + n = n",
    educationalConcept: {
      title: "Induction over ℕ",
      summary:
        "Every natural number is 0 or k + 1 for a smaller k. So to prove P n for all n it is enough to prove P 0 (the base case) and P k → P (k + 1) (the step).",
      mathNotation: "P(0) ∧ (∀ k, P(k) → P(k + 1)) ⟹ ∀ n, P(n)",
      mathIntuition:
        "n + 0 = n holds by definition of addition, but 0 + n = n does not: the definition recurses on the right argument. That asymmetry is why this innocent-looking fact needs induction.",
      leanAnalogy:
        "`induction' n with k ih` leaves two goals: `0 + 0 = 0` and `0 + (k + 1) = k + 1` with `ih : 0 + k = k`. Lean's core library proves `Nat.zero_add` exactly this way.",
      tacticalObjective:
        "Play 'induction'; close the base with rw [add_zero]; close the step with rw [add_succ] and rw [ih] (11 GB).",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/induction_and_recursion.html",
      realWorldApplication:
        "Loop invariants in program verification are induction proofs: true before the first iteration, preserved by each one.",
    },
  },
  {
    id: 23,
    chapter: 5,
    chapterTitle: INDUCTION,
    title: "Gauss's Schoolroom Sum",
    subtitle: "Level 23 · Induction with Rewriting",
    description:
      "S(n) is the sum 0 + 1 + … + n. Prove ∀ n, 2 · S(n) = n(n + 1), the formula Gauss is said to have found as a schoolboy.",
    initialRam: 28,
    goldRamTarget: 8,
    silverRamTarget: 4,
    hypotheses: [
      hyp("S_zero", "S(0) = 0", "l23-h1"),
      hyp("S_succ", "∀ m, S(m + 1) = S(m) + (m + 1)", "l23-h2"),
      hyp("mul_add", "∀ a b c, a * (b + c) = a * b + a * c", "l23-h3"),
    ],
    goal: goal("∀ n, 2 * S(n) = n * (n + 1)", "l23-g"),
    availableTactics: [
      "induction",
      { id: "rw", hypothesis: "S_zero", labelOverride: "rw [S_zero]" },
      { id: "rw", hypothesis: "S_succ", labelOverride: "rw [S_succ]" },
      { id: "rw", hypothesis: "mul_add", labelOverride: "rw [mul_add]" },
      { id: "rw", hypothesis: "ih", labelOverride: "rw [ih]" },
      "norm_num",
      "ring",
      "sorry",
    ],
    hints: [
      "Induct on n. The base case is pure arithmetic once S(0) is unfolded.",
      "In the step, unfold S(k + 1) with S_succ, then distribute 2 · (S(k) + (k + 1)) with mul_add so that 2 · S(k) appears.",
      "Rewrite 2 · S(k) with ih, and 'ring' closes k(k + 1) + 2(k + 1) = (k + 1)(k + 2).",
    ],
    leanTheoremName: "gauss_sum",
    leanTypeSignature:
      "(S : Nat → Nat) (S_zero : S 0 = 0) (S_succ : ∀ m, S (m + 1) = S m + (m + 1)) (mul_add : ∀ a b c : Nat, a * (b + c) = a * b + a * c) : ∀ n, 2 * S n = n * (n + 1)",
    educationalConcept: {
      title: "Induction Meets Algebra",
      summary:
        "Most induction steps have the same shape: unfold the definition at k + 1, rearrange until the k case appears, replace it with the induction hypothesis, and finish with algebra.",
      mathNotation:
        "2·S(k + 1) = 2·S(k) + 2(k + 1) = k(k + 1) + 2(k + 1) = (k + 1)(k + 2)",
      mathIntuition:
        "The induction hypothesis is about 2 · S(k), so the step is a hunt for that exact term. Distributing the 2 is what makes it appear.",
      leanAnalogy:
        "After `induction' n with k ih`, the step is `rw [S_succ, mul_add, ih]; ring`. Each rewrite here is one card.",
      tacticalObjective:
        "induction; rw [S_zero] and norm_num for the base; rw [S_succ], rw [mul_add], rw [ih] and ring for the step (20 GB).",
      leanDocUrl: "https://en.wikipedia.org/wiki/Triangular_number",
      realWorldApplication:
        "Cost analysis of nested loops: a loop whose i-th pass does i units of work does n(n + 1)/2 in total.",
    },
  },
  {
    id: 24,
    chapter: 5,
    chapterTitle: INDUCTION,
    title: "Powers Outrun Counting",
    subtitle: "Level 24 · Induction on an Inequality",
    description:
      "Prove ∀ n, n + 1 ≤ 2ⁿ (that is, 2ⁿ ≥ n + 1): doubling grows at least as fast as adding one.",
    initialRam: 22,
    goldRamTarget: 7,
    silverRamTarget: 3,
    hypotheses: [
      hyp("pow_succ", "∀ m, 2 ^ (m + 1) = 2 * 2 ^ m", "l24-h1"),
      hyp("succ_le_double", "∀ m, m + 1 + 1 ≤ 2 * (m + 1)", "l24-h2"),
    ],
    goal: goal("∀ n, n + 1 ≤ 2 ^ n", "l24-g"),
    availableTactics: [
      "induction",
      "norm_num",
      { id: "rw", hypothesis: "pow_succ", labelOverride: "rw [pow_succ]" },
      {
        id: "trans",
        hypothesis: "succ_le_double",
        labelOverride: "trans [succ_le_double]",
      },
      "gcongr",
      "sorry",
    ],
    hints: [
      "Induct on n. The base case 0 + 1 ≤ 2⁰ is arithmetic.",
      "In the step, rewrite 2^(k + 1) as 2 · 2^k, then chain through 2 · (k + 1) with succ_le_double.",
      "'gcongr' reduces 2 · (k + 1) ≤ 2 · 2^k to k + 1 ≤ 2^k, which is ih, so it closes the goal.",
    ],
    leanTheoremName: "succ_le_two_pow",
    leanTypeSignature:
      "(pow_succ : ∀ m : Nat, 2 ^ (m + 1) = 2 * 2 ^ m) (succ_le_double : ∀ m : Nat, m + 1 + 1 ≤ 2 * (m + 1)) : ∀ n : Nat, n + 1 ≤ 2 ^ n",
    educationalConcept: {
      title: "Inductive Inequalities and Monotonicity",
      summary:
        "An inequality step usually chains: (k + 1) + 1 ≤ 2(k + 1) ≤ 2 · 2^k. The first link is a small fact; the second is the induction hypothesis multiplied by 2, which `gcongr` handles.",
      mathNotation: "(k + 1) + 1 ≤ 2(k + 1) ≤ 2 · 2^k = 2^(k + 1)",
      mathIntuition:
        "This is Bernoulli's inequality at base 2. Exponential growth beats linear growth, and induction makes that precise one doubling at a time.",
      leanAnalogy:
        "`gcongr` (generalized congruence) proves 2 * a ≤ 2 * b from a ≤ b, and tries `assumption` on what remains, so `ih` closes it.",
      tacticalObjective:
        "induction; norm_num for the base; rw [pow_succ], trans [succ_le_double] and gcongr for the step (15 GB).",
      leanDocUrl:
        "https://leanprover-community.github.io/mathlib4_docs/Mathlib/Tactic/GCongr/Core.html",
      realWorldApplication:
        "Hash table and dynamic array growth: doubling capacity keeps amortized insertion cost constant because 2^k outpaces k.",
    },
  },

  // =========================================================================
  // CHAPTER 6: Inequality Chains
  // =========================================================================
  {
    id: 25,
    chapter: 6,
    chapterTitle: CHAINS,
    title: "Three Rungs",
    subtitle: "Level 25 · ≤ Transitivity",
    description:
      "Prove a ≤ d from a ≤ b, b ≤ c and c ≤ d by climbing the chain one rung at a time.",
    initialRam: 12,
    goldRamTarget: 7,
    silverRamTarget: 3,
    hypotheses: [
      hyp("h1", "a ≤ b", "l25-h1"),
      hyp("h2", "b ≤ c", "l25-h2"),
      hyp("h3", "c ≤ d", "l25-h3"),
    ],
    goal: goal("a ≤ d", "l25-g"),
    availableTactics: [
      { id: "trans", hypothesis: "h1", labelOverride: "trans [h1]" },
      { id: "trans", hypothesis: "h2", labelOverride: "trans [h2]" },
      { id: "exact", hypothesis: "h3", labelOverride: "exact h3" },
      "linarith",
      "sorry",
    ],
    hints: [
      "≤ is transitive: a ≤ b and b ≤ d give a ≤ d.",
      "'trans [h1]' moves the left end of the goal from a to b.",
      "Play 'trans [h1]', 'trans [h2]', then 'exact h3'.",
    ],
    leanTheoremName: "three_rungs",
    leanTypeSignature:
      "(a b c d : Nat) (h1 : a ≤ b) (h2 : b ≤ c) (h3 : c ≤ d) : a ≤ d",
    educationalConcept: {
      title: "Transitivity of ≤ (le_trans)",
      summary:
        "`le_trans : a ≤ b → b ≤ c → a ≤ c`. Applied backwards to a goal a ≤ d with h1 : a ≤ b, it leaves b ≤ d. Repeat until a hypothesis matches.",
      mathNotation: "a ≤ b ≤ c ≤ d ⟹ a ≤ d",
      mathIntuition:
        "A chain of inequalities is how most estimates in analysis are written. Each rung is easy; the conclusion only compares the two ends.",
      leanAnalogy:
        "`apply le_trans h1` turns `a ≤ d` into `b ≤ d`. Mathlib's `calc` block writes the same chain as a table of steps.",
      tacticalObjective:
        "trans [h1], trans [h2], exact h3 (5 GB). 'linarith' also works, at 8 GB.",
      leanDocUrl:
        "https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/Basic.html",
      realWorldApplication:
        "Worst-case execution time analysis bounds a task by chaining per-stage bounds.",
    },
  },
  {
    id: 26,
    chapter: 6,
    chapterTitle: CHAINS,
    title: "Mixed Chain",
    subtitle: "Level 26 · ≤ with = Links",
    description:
      "Prove a ≤ d when the middle link is an equation: a ≤ b, b = c, c ≤ d.",
    initialRam: 12,
    goldRamTarget: 7,
    silverRamTarget: 3,
    hypotheses: [
      hyp("h1", "a ≤ b", "l26-h1"),
      hyp("h2", "b = c", "l26-h2"),
      hyp("h3", "c ≤ d", "l26-h3"),
    ],
    goal: goal("a ≤ d", "l26-g"),
    availableTactics: [
      { id: "trans", hypothesis: "h1", labelOverride: "trans [h1]" },
      { id: "trans", hypothesis: "h3", labelOverride: "trans [h3]" },
      { id: "rw", hypothesis: "h2", labelOverride: "rw [h2]" },
      { id: "exact", hypothesis: "h3", labelOverride: "exact h3" },
      "sorry",
    ],
    hints: [
      "An equation in a chain is a free rung: rewrite across it.",
      "'trans [h1]' leaves b ≤ d. Rewrite b with h2.",
      "Play 'trans [h1]', select b and 'rw [h2]', then 'exact h3'.",
    ],
    leanTheoremName: "mixed_chain",
    leanTypeSignature:
      "(a b c d : Nat) (h1 : a ≤ b) (h2 : b = c) (h3 : c ≤ d) : a ≤ d",
    educationalConcept: {
      title: "Rewriting Inside an Inequality",
      summary:
        "`rw` works in any goal, not only equations: rewriting b to c in b ≤ d gives c ≤ d. After a rewrite Lean tries `rfl`, and since ≤ is reflexive that also closes a goal like c ≤ c.",
      mathNotation: "a ≤ b = c ≤ d ⟹ a ≤ d",
      mathIntuition:
        "Chains in textbooks mix = and ≤ freely. Every = link is a substitution, and every ≤ link is a transitivity step.",
      leanAnalogy:
        "`apply le_trans h1; rw [h2]; exact h3`. In a `calc` block the same chain reads `a ≤ b := h1`, `_ = c := h2`, `_ ≤ d := h3`.",
      tacticalObjective:
        "trans [h1], rw [h2], exact h3 (5 GB). There is a second route that ends on c ≤ c.",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/quantifiers_and_equality.html#calculational-proofs",
      realWorldApplication:
        "Numerical analysis error bounds mix exact identities with estimates in one chain.",
    },
  },
  {
    id: 27,
    chapter: 6,
    chapterTitle: CHAINS,
    title: "Monotone Ladder",
    subtitle: "Level 27 · Generalized Congruence",
    description:
      "Prove x + 1 ≤ z from x ≤ y and y + 1 ≤ z: chain to y + 1, then cancel the shared + 1.",
    initialRam: 12,
    goldRamTarget: 7,
    silverRamTarget: 3,
    hypotheses: [
      hyp("h1", "x ≤ y", "l27-h1"),
      hyp("h2", "y + 1 ≤ z", "l27-h2"),
    ],
    goal: goal("x + 1 ≤ z", "l27-g"),
    availableTactics: [
      { id: "trans", hypothesis: "h2", labelOverride: "trans [h2]" },
      "gcongr",
      "linarith",
      "sorry",
    ],
    hints: [
      "h2 ends where the goal ends, at z, so it can be the last rung.",
      "'trans [h2]' leaves x + 1 ≤ y + 1. Both sides share '+ 1'.",
      "'gcongr' strips the shared + 1 to x ≤ y, which is h1, and closes the goal.",
    ],
    leanTheoremName: "monotone_ladder",
    leanTypeSignature:
      "(x y z : Nat) (h1 : x ≤ y) (h2 : y + 1 ≤ z) : x + 1 ≤ z",
    educationalConcept: {
      title: "Monotonicity (gcongr)",
      summary:
        "Addition and multiplication on ℕ are monotone: a ≤ b gives a + c ≤ b + c and c · a ≤ c · b. `gcongr` finds the one place where the two sides differ and reduces the goal to that comparison.",
      mathNotation: "x ≤ y ⟹ x + 1 ≤ y + 1 ≤ z",
      mathIntuition:
        "Most steps in an estimate are 'the same expression, with one part made bigger'. Monotonicity is the rule that licenses them.",
      leanAnalogy:
        "`refine le_trans ?_ h2` leaves `x + 1 ≤ y + 1`; `gcongr` reduces it to `x ≤ y` and closes it with `h1` by assumption.",
      tacticalObjective:
        "trans [h2], then gcongr (5 GB). 'linarith' does it in one card for 8 GB.",
      leanDocUrl:
        "https://leanprover-community.github.io/mathlib4_docs/Mathlib/Tactic/GCongr/Core.html",
      realWorldApplication:
        "Abstract interpretation uses monotone transfer functions so that bounds on inputs give bounds on outputs.",
    },
  },

  // =========================================================================
  // CHAPTER 7: Almost Perfect Numbers
  // =========================================================================
  {
    id: 28,
    chapter: 7,
    chapterTitle: ALMOST_PERFECT,
    title: "An Abundant Witness",
    subtitle: "Level 28 · ∃ with Divisor Sums",
    description:
      "Prove that some n has σ(n) > 2n, stated as ∃ n, 2n + 1 ≤ σ(n). Choose between 6 and 12.",
    initialRam: 14,
    goldRamTarget: 7,
    silverRamTarget: 3,
    hypotheses: [
      hyp("h6", "σ(6) = 12", "l28-h1"),
      hyp("h12", "σ(12) = 28", "l28-h2"),
    ],
    goal: goal("∃ n, 2 * n + 1 ≤ σ(n)", "l28-g"),
    availableTactics: [
      { id: "use", hypothesis: "12", labelOverride: "use 12" },
      { id: "use", hypothesis: "6", labelOverride: "use 6" },
      { id: "rw", hypothesis: "h12", labelOverride: "rw [h12]" },
      { id: "rw", hypothesis: "h6", labelOverride: "rw [h6]" },
      "norm_num",
      "decide",
      "sorry",
    ],
    hints: [
      "6 is perfect (σ(6) = 12 = 2 · 6) and 12 is abundant (σ(12) = 28 > 24).",
      "A perfect number misses 2n + 1 ≤ σ(n) by one, so only 12 works.",
      "Play 'use 12', rewrite σ(12) with h12, then 'norm_num' checks 25 ≤ 28.",
    ],
    leanTheoremName: "exists_abundant",
    leanTypeSignature:
      "(σ : Nat → Nat) (h6 : σ 6 = 12) (h12 : σ 12 = 28) : ∃ n, 2 * n + 1 ≤ σ n",
    educationalConcept: {
      title: "Abundant, Perfect and Deficient Numbers",
      summary:
        "Compare σ(n) with 2n: below it n is deficient, equal it is perfect, above it is abundant. 12 is the smallest abundant number: 1 + 2 + 3 + 4 + 6 + 12 = 28.",
      mathNotation: "σ(12) = 28 > 24 = 2 · 12",
      mathIntuition:
        "Existence claims in number theory are often settled by a single example. Choosing it well is the whole proof.",
      leanAnalogy:
        "`use 12; rw [h12]; norm_num`. With Mathlib's real `Nat.sigma`, `decide` could even compute σ(12) itself.",
      tacticalObjective: "use 12, rw [h12], norm_num (7 GB).",
      leanDocUrl: "https://en.wikipedia.org/wiki/Abundant_number",
      realWorldApplication:
        "Counterexample search in automated reasoning: one concrete witness refutes a universal claim.",
    },
  },
  {
    id: 29,
    chapter: 7,
    chapterTitle: ALMOST_PERFECT,
    title: "The Quasiperfect Floor",
    subtitle: "Level 29 · Rewrite, then Compare",
    description:
      "For a quasiperfect n ≥ 1 (σ(n) = 2n + 1), prove n + 1 + 1 ≤ σ(n): its proper divisors sum to more than n.",
    initialRam: 14,
    goldRamTarget: 7,
    silverRamTarget: 3,
    hypotheses: [
      hyp("h_def", "σ(n) = 2 * n + 1", "l29-h1"),
      hyp("two_mul", "∀ m, 2 * m = m + m", "l29-h2"),
      hyp("h_pos", "1 ≤ n", "l29-h3"),
    ],
    goal: goal("n + 1 + 1 ≤ σ(n)", "l29-g"),
    availableTactics: [
      { id: "rw", hypothesis: "h_def", labelOverride: "rw [h_def]" },
      { id: "rw", hypothesis: "two_mul", labelOverride: "rw [two_mul]" },
      "gcongr",
      { id: "exact", hypothesis: "h_pos", labelOverride: "exact h_pos" },
      "sorry",
    ],
    hints: [
      "Replace σ(n) by its definition first.",
      "Write 2 · n as n + n with two_mul, so both sides read (n + _) + 1.",
      "'gcongr' finds the one difference, 1 ≤ n, and closes it with h_pos.",
    ],
    leanTheoremName: "quasiperfect_floor",
    leanTypeSignature:
      "(σ : Nat → Nat) (n : Nat) (h_def : σ n = 2 * n + 1) (two_mul : ∀ m : Nat, 2 * m = m + m) (h_pos : 1 ≤ n) : n + 1 + 1 ≤ σ n",
    educationalConcept: {
      title: "Shaping a Goal for Monotonicity",
      summary:
        "`gcongr` needs both sides to share a pattern. Rewriting is how you make them line up: after two_mul, (n + 1) + 1 and (n + n) + 1 differ only in 1 versus n.",
      mathNotation: "n + 1 + 1 ≤ n + n + 1 = 2n + 1 = σ(n)",
      mathIntuition:
        "The proper divisors of a quasiperfect n sum to n + 1, so σ(n) ≥ n + 2 whenever n ≥ 1. Small as it is, bounds like this are the raw material of the search for quasiperfect numbers, none of which has ever been found.",
      leanAnalogy:
        "`rw [h_def, two_mul]; gcongr` — gcongr closes the leftover `1 ≤ n` with `h_pos` by assumption.",
      tacticalObjective:
        "rw [h_def], rw [two_mul] on 2 · n, then gcongr (7 GB).",
      leanDocUrl: "https://en.wikipedia.org/wiki/Quasiperfect_number",
      realWorldApplication:
        "Search-space pruning: lower bounds proved once let a computer search skip whole ranges of candidates.",
    },
  },
  {
    id: 30,
    chapter: 7,
    chapterTitle: ALMOST_PERFECT,
    title: "The Almost Perfect Capstone",
    subtitle: "Level 30 (Act 2 Capstone) · σ(2ⁿ) = 2ⁿ⁺¹ − 1",
    description:
      "Prove ∀ n, σ(2ⁿ) + 1 = 2ⁿ⁺¹ by induction: every power of two is almost perfect, the mirror image of a quasiperfect number.",
    initialRam: 24,
    goldRamTarget: 8,
    silverRamTarget: 4,
    hypotheses: [
      hyp("σ_base", "σ(2 ^ 0) = 1", "l30-h1"),
      hyp(
        "σ_step",
        "∀ m, σ(2 ^ (m + 1)) + 1 = σ(2 ^ m) + 1 + 2 ^ (m + 1)",
        "l30-h2"
      ),
      hyp(
        "pow_double",
        "∀ m, 2 ^ (m + 1) + 2 ^ (m + 1) = 2 ^ (m + 1 + 1)",
        "l30-h3"
      ),
    ],
    goal: goal("∀ n, σ(2 ^ n) + 1 = 2 ^ (n + 1)", "l30-g"),
    availableTactics: [
      "induction",
      { id: "rw", hypothesis: "σ_base", labelOverride: "rw [σ_base]" },
      { id: "rw", hypothesis: "σ_step", labelOverride: "rw [σ_step]" },
      { id: "rw", hypothesis: "ih", labelOverride: "rw [ih]" },
      {
        id: "rw",
        hypothesis: "pow_double",
        labelOverride: "rw [pow_double]",
      },
      "norm_num",
      "simp",
      "sorry",
    ],
    hints: [
      "The divisors of 2^(k + 1) are the divisors of 2^k plus one new one, 2^(k + 1). σ_step says exactly that.",
      "Base: rw [σ_base] and norm_num. Step: rewrite σ(2^(k + 1)) + 1 with σ_step so that σ(2^k) + 1 appears.",
      "Then rw [ih] turns it into 2^(k + 1) + 2^(k + 1), and rw [pow_double] makes both sides 2^(k + 2).",
    ],
    leanTheoremName: "almost_perfect_pow_two",
    leanTypeSignature:
      "(σ : Nat → Nat) (σ_base : σ (2 ^ 0) = 1) (σ_step : ∀ m, σ (2 ^ (m + 1)) + 1 = σ (2 ^ m) + 1 + 2 ^ (m + 1)) (pow_double : ∀ m : Nat, 2 ^ (m + 1) + 2 ^ (m + 1) = 2 ^ (m + 1 + 1)) : ∀ n, σ (2 ^ n) + 1 = 2 ^ (n + 1)",
    educationalConcept: {
      title: "Almost Perfect Numbers",
      summary:
        "A number is almost perfect when σ(n) = 2n − 1, one short of perfect, just as a quasiperfect number is one over. Every power of two is almost perfect, and no other almost perfect number is known.",
      mathNotation: "σ(2ⁿ) = 1 + 2 + 4 + … + 2ⁿ = 2ⁿ⁺¹ − 1",
      mathIntuition:
        "The divisors of 2ⁿ are the powers 1, 2, …, 2ⁿ, a geometric series. Induction adds one term at a time: the running total plus one always equals the next power of two.",
      leanAnalogy:
        "After `induction' n with k ih`, the step is `rw [σ_step, ih, pow_double]`; the base is `rw [σ_base]; norm_num`. Stating the sum with + 1 on the left avoids ℕ's truncated subtraction.",
      tacticalObjective:
        "induction; rw [σ_base], norm_num; rw [σ_step], rw [ih], rw [pow_double] (16 GB) to complete Act 2.",
      leanDocUrl: "https://en.wikipedia.org/wiki/Almost_perfect_number",
      realWorldApplication:
        "Binary arithmetic: 2ⁿ⁺¹ − 1 is the all-ones bit mask of width n + 1, the largest unsigned value that fits.",
    },
  },
];
