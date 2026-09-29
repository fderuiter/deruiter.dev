import { PuzzlerLevelDef } from "./types";

export const puzzleLevels: PuzzlerLevelDef[] = [
  // =========================================================================
  // CHAPTER 1: Equational Reasoning & Term Rewriting
  // =========================================================================
  {
    id: 1,
    chapter: 1,
    chapterTitle: "Equational Reasoning",
    title: "The Identity Crisis",
    subtitle: "Level 1 · Reflexivity",
    description:
      "Prove that an arbitrary variable equals itself (x = x) using the fundamental Law of Identity.",
    initialRam: 16,
    goldRamTarget: 15,
    silverRamTarget: 8,
    hypotheses: [],
    goal: {
      id: "eq-lvl1",
      type: "Equality",
      value: "=",
      children: [
        { id: "var-x1", type: "Variable", value: "x" },
        { id: "var-x2", type: "Variable", value: "x" },
      ],
    },
    availableTactics: ["rfl", "sorry"],
    hints: [
      "Every mathematical object is equal to itself by the Law of Identity.",
      "The equality AST node has identical Left-Hand and Right-Hand sides.",
      "Apply the 'rfl' (reflexivity) tactic to immediately close the goal.",
    ],
    leanTheoremName: "identity_crisis",
    leanTypeSignature: "(x : Nat) : x = x",
    educationalConcept: {
      title: "The Reflexivity Axiom (rfl)",
      summary:
        "In Type Theory, reflexivity is the canonical constructor of equality (`Eq.refl`). If two expressions evaluate to definitionally equal terms, `rfl` closes the goal in O(1) step.",
      mathNotation: "∀ x, x = x",
      mathIntuition:
        "Why does x = x matter? In formal logic, identity is the bedrock of all computation. Before you can transform expressions, your system must agree that identical symbols represent identical mathematical objects.",
      leanAnalogy:
        "In Lean 4, `rfl` is syntactic shorthand for `exact Eq.refl x`. The Lean kernel verifies that both sides reduce to the exact same normal form.",
      tacticalObjective:
        "Click the 'rfl' tactic card to discharge the identity goal in 1 step.",
      leanDocUrl:
        "https://leanprover-community.github.io/mathlib4_docs/Init/Core.html#Eq.refl",
      realWorldApplication:
        "Hardware microcode verification: verifying registers contain expected unchanged states after identity operations.",
    },
  },
  {
    id: 2,
    chapter: 1,
    chapterTitle: "Equational Reasoning",
    title: "The Mirror Law",
    subtitle: "Level 2 · Symmetry & Transposition",
    description:
      "Given hypothesis h: a = b, prove that equality is symmetric (b = a).",
    initialRam: 16,
    goldRamTarget: 14,
    silverRamTarget: 8,
    hypotheses: [
      {
        id: "hyp-h-symm",
        type: "Equality",
        value: "=",
        metadata: { name: "h" },
        children: [
          { id: "var-a-h-symm", type: "Variable", value: "a" },
          { id: "var-b-h-symm", type: "Variable", value: "b" },
        ],
      },
    ],
    goal: {
      id: "eq-lvl2-symm",
      type: "Equality",
      value: "=",
      children: [
        { id: "var-b-goal-symm", type: "Variable", value: "b" },
        { id: "var-a-goal-symm", type: "Variable", value: "a" },
      ],
    },
    availableTactics: [
      "symm",
      { id: "rw", hypothesis: "h", labelOverride: "rw [h]" },
      "rfl",
      "sorry",
    ],
    hints: [
      "Equality is a symmetric binary relation: if a = b, then b = a.",
      "You can use 'symm' to flip the goal (b = a ⟹ a = b) and then rewrite with 'h', or rewrite directly.",
      "Apply 'symm', then select the sub-term 'a' (not the whole equality) and apply 'rw [h]'. The goal becomes b = b and closes automatically, so 'rfl' is not needed.",
    ],
    leanTheoremName: "mirror_law",
    leanTypeSignature: "(a b : Nat) (h : a = b) : b = a",
    educationalConcept: {
      title: "Symmetry of Equality (symm)",
      summary:
        "Equivalence relations require reflexivity, symmetry, and transitivity. The `symm` tactic swaps the LHS and RHS of an equality goal (`Eq.symm`).",
      mathNotation: "(a = b) ⟹ (b = a)",
      mathIntuition:
        "In everyday math, we treat a = b and b = a as interchangeable. But formal proof assistants distinguish directed equality. `symm` explicitly mirrors the relation.",
      leanAnalogy:
        "In Lean 4, `symm` applies `Eq.symm`, transforming the goal `b = a` into `a = b` so that direct left-to-right hypotheses can match.",
      tacticalObjective:
        "Use 'symm' to swap the goal sides, then select the sub-term 'a' and rewrite with hypothesis 'h'. The goal becomes b = b and closes automatically (rw tries rfl), so no separate 'rfl' is needed.",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/tactics.html#the-rewrite-tactic",
      realWorldApplication:
        "Database query optimizers: normalizing join conditions (`A.id = B.id` vs `B.id = A.id`) for hash-join indexing.",
    },
  },
  {
    id: 3,
    chapter: 1,
    chapterTitle: "Equational Reasoning",
    title: "The Transitivity Chain",
    subtitle: "Level 3 · Multi-Step Rewriting",
    description:
      "Prove a = c using hypotheses h1: a = b and h2: b = c via Leibniz's rule of substitution.",
    initialRam: 16,
    goldRamTarget: 11,
    silverRamTarget: 6,
    hypotheses: [
      {
        id: "hyp-h1-lvl3",
        type: "Equality",
        value: "=",
        metadata: { name: "h1" },
        children: [
          { id: "var-a-h1-lvl3", type: "Variable", value: "a" },
          { id: "var-b-h1-lvl3", type: "Variable", value: "b" },
        ],
      },
      {
        id: "hyp-h2-lvl3",
        type: "Equality",
        value: "=",
        metadata: { name: "h2" },
        children: [
          { id: "var-b-h2-lvl3", type: "Variable", value: "b" },
          { id: "var-c-h2-lvl3", type: "Variable", value: "c" },
        ],
      },
    ],
    goal: {
      id: "eq-lvl3-trans",
      type: "Equality",
      value: "=",
      children: [
        { id: "var-a-goal-lvl3", type: "Variable", value: "a" },
        { id: "var-c-goal-lvl3", type: "Variable", value: "c" },
      ],
    },
    availableTactics: [
      { id: "rw", hypothesis: "h1", labelOverride: "rw [h1]" },
      { id: "rw", hypothesis: "h2", labelOverride: "rw [h2]" },
      "rfl",
      "sorry",
    ],
    hints: [
      "Use active hypotheses in your context to replace subterms.",
      "Target variable 'a' in the goal and rewrite it using hypothesis 'h1'.",
      "Then rewrite 'b' using 'h2' and close the resulting 'c = c' with 'rfl'.",
    ],
    leanTheoremName: "transitivity_chain",
    leanTypeSignature: "(a b c : Nat) (h1 : a = b) (h2 : b = c) : a = c",
    educationalConcept: {
      title: "Leibniz's Indiscernibility of Identicals (rw)",
      summary:
        "The `rw` (rewrite) tactic substitutes sub-terms in the goal using an equality hypothesis `h : x = y`. It enables equational reasoning chains step-by-step.",
      mathNotation: "(a = b) ∧ (b = c) ⟹ a = c",
      mathIntuition:
        "If two terms are equal, anything true about one is true about the other. Rewriting is the mechanical engine of algebra: replacing equals with equals.",
      leanAnalogy:
        "`rw [h1]` finds the first subterm matching `a` and replaces it with `b`. Applying `rw [h2]` then turns `b` into `c`, leaving `c = c` for `rfl`.",
      tacticalObjective:
        "Chain `rw [h1]` followed by `rw [h2]` and finish with `rfl`.",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/tactics.html#the-rewrite-tactic",
      realWorldApplication:
        "Compilers use rewrite rules in peephole optimizers to replace expensive instruction sequences with cheaper equivalents.",
    },
  },
  {
    id: 4,
    chapter: 1,
    chapterTitle: "Equational Reasoning",
    title: "Associative Grouping",
    subtitle: "Level 4 · Algebraic Law Targeting",
    description:
      "Prove (a + b) + c = a + (b + c) using the associativity lemma 'add_assoc'.",
    initialRam: 14,
    goldRamTarget: 11,
    silverRamTarget: 6,
    hypotheses: [
      {
        id: "hyp-add-assoc",
        type: "Equality",
        value: "=",
        metadata: { name: "add_assoc" },
        children: [
          {
            id: "expr-assoc-lhs",
            type: "Operator",
            value: "+",
            children: [
              {
                id: "expr-ab-assoc",
                type: "Operator",
                value: "+",
                children: [
                  { id: "v-a-assoc", type: "Variable", value: "a" },
                  { id: "v-b-assoc", type: "Variable", value: "b" },
                ],
              },
              { id: "v-c-assoc", type: "Variable", value: "c" },
            ],
          },
          {
            id: "expr-assoc-rhs",
            type: "Operator",
            value: "+",
            children: [
              { id: "v-a-assoc2", type: "Variable", value: "a" },
              {
                id: "expr-bc-assoc",
                type: "Operator",
                value: "+",
                children: [
                  { id: "v-b-assoc2", type: "Variable", value: "b" },
                  { id: "v-c-assoc2", type: "Variable", value: "c" },
                ],
              },
            ],
          },
        ],
      },
    ],
    goal: {
      id: "eq-lvl4-assoc",
      type: "Equality",
      value: "=",
      children: [
        {
          id: "expr-goal-lhs-assoc",
          type: "Operator",
          value: "+",
          children: [
            {
              id: "expr-ab-goal",
              type: "Operator",
              value: "+",
              children: [
                { id: "v-a-g", type: "Variable", value: "a" },
                { id: "v-b-g", type: "Variable", value: "b" },
              ],
            },
            { id: "v-c-g", type: "Variable", value: "c" },
          ],
        },
        {
          id: "expr-goal-rhs-assoc",
          type: "Operator",
          value: "+",
          children: [
            { id: "v-a-g2", type: "Variable", value: "a" },
            {
              id: "expr-bc-goal",
              type: "Operator",
              value: "+",
              children: [
                { id: "v-b-g2", type: "Variable", value: "b" },
                { id: "v-c-g2", type: "Variable", value: "c" },
              ],
            },
          ],
        },
      ],
    },
    availableTactics: [
      { id: "rw", hypothesis: "add_assoc", labelOverride: "rw [add_assoc]" },
      "rfl",
      "simp",
      "sorry",
    ],
    hints: [
      "Associativity allows regrouping parentheses without changing the evaluation outcome.",
      "The Left-Hand Side is `(a + b) + c` and the Right-Hand Side is `a + (b + c)`.",
      "Apply `rw [add_assoc]` on the LHS and close with `rfl`.",
    ],
    leanTheoremName: "addition_associativity",
    leanTypeSignature: "(a b c : Nat) : (a + b) + c = a + (b + c)",
    educationalConcept: {
      title: "Semigroup Associativity & Tree Rotation",
      summary:
        "In an algebraic semigroup or monoid, binary operators can regroup freely. In AST terms, associativity corresponds to a tree rotation around operator nodes.",
      mathNotation: "(a + b) + c = a + (b + c)",
      mathIntuition:
        "When evaluating syntax trees, expressions are nested binary trees. Associativity restructures the evaluation order without altering the underlying sum.",
      leanAnalogy:
        "Lean 4’s standard library theorem `Nat.add_assoc` provides the exact rewrite rule used by term simplifiers.",
      tacticalObjective:
        "Apply `rw [add_assoc]` to normalize the tree grouping, then close with `rfl`.",
      leanDocUrl:
        "https://leanprover-community.github.io/mathlib4_docs/Init/Data/Nat/Basic.html#Nat.add_assoc",
      realWorldApplication:
        "SIMD parallel vectorization: regrouping operations across GPU compute lanes for lock-free parallel reductions.",
    },
  },
  {
    id: 5,
    chapter: 1,
    chapterTitle: "Equational Reasoning",
    title: "Memory Economics",
    subtitle: "Level 5 · RAM Optimization",
    description:
      "Prove x + 0 = x. Notice that 'simp' searches all algebraic rules and burns 6 GB, whereas 'rw [add_zero]' costs only 2 GB.",
    initialRam: 7,
    goldRamTarget: 4,
    silverRamTarget: 1,
    hypotheses: [
      {
        id: "hyp-add-zero-lvl5",
        type: "Equality",
        value: "=",
        metadata: { name: "add_zero" },
        children: [
          {
            id: "expr-x-plus-zero-lvl5",
            type: "Operator",
            value: "+",
            children: [
              { id: "var-x-h-lvl5", type: "Variable", value: "x" },
              { id: "const-0-h-lvl5", type: "Constant", value: 0 },
            ],
          },
          { id: "var-x-rhs-lvl5", type: "Variable", value: "x" },
        ],
      },
    ],
    goal: {
      id: "eq-lvl5-mem",
      type: "Equality",
      value: "=",
      children: [
        {
          id: "expr-x-plus-0-lvl5",
          type: "Operator",
          value: "+",
          children: [
            { id: "var-x-goal-lvl5", type: "Variable", value: "x" },
            { id: "const-0-goal-lvl5", type: "Constant", value: 0 },
          ],
        },
        { id: "var-x-target-lvl5", type: "Variable", value: "x" },
      ],
    },
    availableTactics: [
      { id: "rw", hypothesis: "add_zero", labelOverride: "rw [add_zero]" },
      "simp",
      "rfl",
      "sorry",
    ],
    hints: [
      "Broad simplifiers like 'simp' traverse the entire lemma library and use significant memory.",
      "A specific rewrite lemma `rw [add_zero]` directly targets the addition identity.",
      "Apply `rw [add_zero]` (2 GB) followed by `rfl` (1 GB) for total 3 GB consumption (Gold!).",
    ],
    leanTheoremName: "add_zero_identity",
    leanTypeSignature: "(x : Nat) : x + 0 = x",
    educationalConcept: {
      title: "Simplifier vs Targeted Rewriting",
      summary:
        "`simp` is a confluent term-rewriting engine maintaining thousands of simplification lemmas. While convenient, large automation tactics consume substantial language server memory.",
      mathNotation: "x + 0 = x",
      mathIntuition:
        "Automation is powerful, but indiscriminate automation incurs severe computation overhead. Lean proof engineers always favor fast targeted rewrites over heavy solvers in critical paths.",
      leanAnalogy:
        "`simp` runs a knuth-bendix congruence closure loop over all marked `@[simp]` lemmas, whereas `rw [add_zero]` does a direct single-pass replacement.",
      tacticalObjective:
        "Choose `rw [add_zero]` over `simp` to preserve your RAM budget and earn 3 Gold Stars.",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/tactics.html#the-simplifier",
      realWorldApplication:
        "Automated test generation & formal verification pipelines benchmark proof scripts to avoid Out-Of-Memory (OOM) failures in CI/CD.",
    },
  },
  {
    id: 6,
    chapter: 1,
    chapterTitle: "Equational Reasoning",
    title: "Ring Axioms & Expansion",
    subtitle: "Level 6 · Algebraic Polynomial Normalization",
    description:
      "Prove (a + b)² = a² + 2ab + b² in commutative semirings using the algebraic 'ring' decision procedure.",
    initialRam: 14,
    goldRamTarget: 9,
    silverRamTarget: 4,
    hypotheses: [],
    goal: {
      id: "eq-lvl6-ring",
      type: "Equality",
      value: "=",
      children: [
        {
          id: "expr-sq-lhs-lvl6",
          type: "Operator",
          value: "^",
          children: [
            {
              id: "expr-a-plus-b-lvl6",
              type: "Operator",
              value: "+",
              children: [
                { id: "var-a-ring-lvl6", type: "Variable", value: "a" },
                { id: "var-b-ring-lvl6", type: "Variable", value: "b" },
              ],
            },
            { id: "const-2-pow-lvl6", type: "Constant", value: 2 },
          ],
        },
        {
          id: "expr-sq-rhs-lvl6",
          type: "Operator",
          value: "+",
          children: [
            {
              id: "expr-a2-plus-2ab-lvl6",
              type: "Operator",
              value: "+",
              children: [
                {
                  id: "expr-a2-lvl6",
                  type: "Operator",
                  value: "^",
                  children: [
                    { id: "var-a-rhs1-lvl6", type: "Variable", value: "a" },
                    { id: "const-2-rhs1-lvl6", type: "Constant", value: 2 },
                  ],
                },
                {
                  id: "expr-2ab-lvl6",
                  type: "Operator",
                  value: "*",
                  children: [
                    {
                      id: "expr-2a-lvl6",
                      type: "Operator",
                      value: "*",
                      children: [
                        { id: "c2-rhs-lvl6", type: "Constant", value: 2 },
                        { id: "var-a-rhs2-lvl6", type: "Variable", value: "a" },
                      ],
                    },
                    { id: "var-b-rhs2-lvl6", type: "Variable", value: "b" },
                  ],
                },
              ],
            },
            {
              id: "expr-b2-lvl6",
              type: "Operator",
              value: "^",
              children: [
                { id: "var-b-rhs3-lvl6", type: "Variable", value: "b" },
                { id: "const-2-rhs3-lvl6", type: "Constant", value: 2 },
              ],
            },
          ],
        },
      ],
    },
    availableTactics: ["ring", "simp", "sorry"],
    hints: [
      "Commutative rings satisfy associativity, commutativity, and distributivity.",
      "The equation is the classic binomial theorem expansion for power 2.",
      "Apply 'ring' to transform both sides into canonical polynomials and verify identity.",
    ],
    leanTheoremName: "binomial_expansion",
    leanTypeSignature: "(a b : Nat) : (a + b)^2 = a^2 + 2 * a * b + b^2",
    educationalConcept: {
      title: "Ring Normalization (ring)",
      summary:
        "The `ring` tactic in Lean/Coq implements Buchberger's algorithm and Gröbner bases for commutative semirings, reducing polynomials to canonical monomial normal forms.",
      mathNotation: "(a + b)² = a² + 2ab + b²",
      mathIntuition:
        "Instead of dozens of manual associativity and commutativity rewrites, a decision procedure transforms any polynomial expression into a canonical sum of monomials and checks equality.",
      leanAnalogy:
        "`ring` is an algorithmically complete decision procedure for the theory of commutative rings. It expands, rearranges, and normalizes polynomials instantaneously.",
      tacticalObjective:
        "Deploy the 'ring' tactic to normalize both polynomials and close Chapter 1.",
      leanDocUrl:
        "https://leanprover-community.github.io/mathlib4_docs/Mathlib/Tactic/Ring.html",
      realWorldApplication:
        "Cryptographic protocol verification (e.g. elliptic curve group laws and RSA polynomial expansions).",
    },
  },

  // =========================================================================
  // CHAPTER 2: Propositional Logic & Natural Deduction
  // =========================================================================
  {
    id: 7,
    chapter: 2,
    chapterTitle: "Propositional Logic",
    title: "The Deduction Theorem",
    subtitle: "Level 7 · Implication Introduction",
    description:
      "Prove the fundamental tautology P → P by introducing the antecedent into your hypothesis context.",
    initialRam: 14,
    goldRamTarget: 10,
    silverRamTarget: 5,
    hypotheses: [],
    goal: {
      id: "imp-lvl7",
      type: "Implication",
      value: "→",
      children: [
        { id: "var-P1-lvl7", type: "Variable", value: "P" },
        { id: "var-P2-lvl7", type: "Variable", value: "P" },
      ],
    },
    availableTactics: ["intro", "exact", "rfl", "sorry"],
    hints: [
      "To prove an implication P → Q, assume P as a hypothesis and deduce Q.",
      "Use 'intro h' on the implication arrow to unpack hypothesis 'h : P'.",
      "With 'h : P' in your hypotheses and goal 'P', use 'exact h' to close the proof.",
    ],
    leanTheoremName: "implication_self",
    leanTypeSignature: "(P : Prop) : P → P",
    educationalConcept: {
      title: "Implication Introduction (intro)",
      summary:
        "In Natural Deduction, the →-Intro rule states that if assuming P allows deriving Q, then P → Q is proven. In Curry-Howard, this is lambda abstraction `(λ h : P => h)`.",
      mathNotation: "Γ ∪ {P} ⊢ Q  ⟹  Γ ⊢ P → Q",
      mathIntuition:
        "How do you prove 'If it rains, then the ground is wet'? You assume it is raining, and under that assumption, prove the ground is wet. `intro` moves assumptions from the goal into your context.",
      leanAnalogy:
        "Under the Curry-Howard isomorphism, propositions are types and proofs are programs. `intro` introduces an argument parameter to a lambda function.",
      tacticalObjective:
        "Execute `intro h` to move `P` into your hypothesis context, then `exact h` to close the goal.",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/tactics.html#the-intro-tactic",
      realWorldApplication:
        "Functional programming: creating higher-order functions that accept input arguments.",
    },
  },
  {
    id: 8,
    chapter: 2,
    chapterTitle: "Propositional Logic",
    title: "Modus Ponens in Action",
    subtitle: "Level 8 · Backwards Goal Reasoning",
    description:
      "Prove proposition Q using hypotheses h_imp: P → Q and h_p: P via backwards reasoning.",
    initialRam: 14,
    goldRamTarget: 9,
    silverRamTarget: 4,
    hypotheses: [
      {
        id: "hyp-imp-lvl8",
        type: "Implication",
        value: "→",
        metadata: { name: "h_imp" },
        children: [
          { id: "var-P-imp-lvl8", type: "Variable", value: "P" },
          { id: "var-Q-imp-lvl8", type: "Variable", value: "Q" },
        ],
      },
      {
        id: "hyp-p-lvl8",
        type: "Variable",
        value: "P",
        metadata: { name: "h_p" },
      },
    ],
    goal: {
      id: "goal-Q-lvl8",
      type: "Variable",
      value: "Q",
    },
    availableTactics: [
      { id: "apply", hypothesis: "h_imp", labelOverride: "apply h_imp" },
      { id: "exact", hypothesis: "h_p", labelOverride: "exact h_p" },
      "sorry",
    ],
    hints: [
      "Modus Ponens allows deriving Q from P → Q and P.",
      "In interactive theorem provers, 'apply h_imp' works backwards: to prove Q, it suffices to prove P.",
      "After applying h_imp, close the resulting goal P with 'exact h_p'.",
    ],
    leanTheoremName: "modus_ponens_demo",
    leanTypeSignature: "(P Q : Prop) (h_imp : P → Q) (h_p : P) : Q",
    educationalConcept: {
      title: "Modus Ponens & Backwards Reasoning (apply)",
      summary:
        "The `apply` tactic implements backward chaining: given a goal Q and a lemma `h : P → Q`, it turns the goal into P. Under Curry-Howard, this is function application `h(h_p)`.",
      mathNotation: "(P → Q) ∧ P ⟹ Q",
      mathIntuition:
        "Backward reasoning asks: 'What premise would allow me to conclude Q?' If you know P implies Q, you reduce the problem of proving Q down to the simpler problem of proving P.",
      leanAnalogy:
        "`apply h_imp` inspects the return type of `h_imp`. Matching `Q`, it replaces the target goal with the function's domain argument `P`.",
      tacticalObjective:
        "Apply `apply h_imp` to reduce the goal to `P`, then close with `exact h_p`.",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/tactics.html#the-apply-tactic",
      realWorldApplication:
        "Automated logic synthesis, expert systems, and deductive database query planning (Datalog/Prolog).",
    },
  },
  {
    id: 9,
    chapter: 2,
    chapterTitle: "Propositional Logic",
    title: "Conjunction Synthesis",
    subtitle: "Level 9 · Conjunction Introduction",
    description:
      "Prove P ∧ Q given hypotheses h_p: P and h_q: Q by splitting the conjunction into two independent subgoals.",
    initialRam: 16,
    goldRamTarget: 12,
    silverRamTarget: 6,
    hypotheses: [
      {
        id: "hyp-p-conj",
        type: "Variable",
        value: "P",
        metadata: { name: "h_p" },
      },
      {
        id: "hyp-q-conj",
        type: "Variable",
        value: "Q",
        metadata: { name: "h_q" },
      },
    ],
    goal: {
      id: "goal-conj-lvl9",
      type: "Conjunction",
      value: "∧",
      children: [
        { id: "var-p-goal-c", type: "Variable", value: "P" },
        { id: "var-q-goal-c", type: "Variable", value: "Q" },
      ],
    },
    availableTactics: [
      "split",
      { id: "exact", hypothesis: "h_p", labelOverride: "exact h_p" },
      { id: "exact", hypothesis: "h_q", labelOverride: "exact h_q" },
      "sorry",
    ],
    hints: [
      "To prove a conjunction (A ∧ B), you must construct proofs for both A and B.",
      "The 'split' tactic (constructor) breaks the goal 'P ∧ Q' into two subgoals: 'Left Branch: P' and 'Right Branch: Q'.",
      "Discharge the first subgoal with 'exact h_p' and the second with 'exact h_q'.",
    ],
    leanTheoremName: "and_intro_demo",
    leanTypeSignature: "(P Q : Prop) (h_p : P) (h_q : Q) : P ∧ Q",
    educationalConcept: {
      title: "Conjunction Introduction (split / constructor)",
      summary:
        "In type theory, conjunction `P ∧ Q` is a product type `And P Q` (equivalent to a 2-element tuple/struct). The `split` tactic creates subgoals for each constructor argument.",
      mathNotation: "P, Q ⊢ P ∧ Q",
      mathIntuition:
        "To assert that two statements are both true, you must provide independent evidence for each. `split` decomposes the multi-part claim into distinct verification tasks.",
      leanAnalogy:
        "In Lean 4, `split` or `constructor` invokes `And.intro : P → Q → P ∧ Q`, requiring you to fulfill both parameters.",
      tacticalObjective:
        "Split the conjunction goal into 2 subgoals and close each using the matching hypothesis.",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/tactics.html#the-constructor-tactic",
      realWorldApplication:
        "Multi-factor authentication & invariant validation: verifying both identity and access permission simultaneously.",
    },
  },
  {
    id: 10,
    chapter: 2,
    chapterTitle: "Propositional Logic",
    title: "Hypothetical Syllogism",
    subtitle: "Level 10 · Implication Transitivity",
    description:
      "Prove proposition R given hypotheses h1: P → Q, h2: Q → R, and h_p: P.",
    initialRam: 16,
    goldRamTarget: 9,
    silverRamTarget: 4,
    hypotheses: [
      {
        id: "hyp-p-to-q",
        type: "Implication",
        value: "→",
        metadata: { name: "h1" },
        children: [
          { id: "var-p-h1", type: "Variable", value: "P" },
          { id: "var-q-h1", type: "Variable", value: "Q" },
        ],
      },
      {
        id: "hyp-q-to-r",
        type: "Implication",
        value: "→",
        metadata: { name: "h2" },
        children: [
          { id: "var-q-h2", type: "Variable", value: "Q" },
          { id: "var-r-h2", type: "Variable", value: "R" },
        ],
      },
      {
        id: "hyp-p-syl",
        type: "Variable",
        value: "P",
        metadata: { name: "h_p" },
      },
    ],
    goal: {
      id: "goal-r-syl",
      type: "Variable",
      value: "R",
    },
    availableTactics: [
      { id: "apply", hypothesis: "h2", labelOverride: "apply h2" },
      { id: "apply", hypothesis: "h1", labelOverride: "apply h1" },
      { id: "exact", hypothesis: "h_p", labelOverride: "exact h_p" },
      "sorry",
    ],
    hints: [
      "To prove R, use 'apply h2' to reduce the goal to Q.",
      "Then apply 'h1' to reduce Q down to P.",
      "Finally, close the goal P with 'exact h_p'.",
    ],
    leanTheoremName: "hypothetical_syllogism",
    leanTypeSignature: "(P Q R : Prop) (h1 : P → Q) (h2 : Q → R) (h_p : P) : R",
    educationalConcept: {
      title: "Chaining Deductions & Function Composition",
      summary:
        "Hypothetical Syllogism establishes transitivity of implication. Under Curry-Howard, this represents function composition `h2(h1(h_p))`.",
      mathNotation: "(P → Q) ∧ (Q → R) ∧ P ⟹ R",
      mathIntuition:
        "Chained rules represent computational pipelines. If step 1 transforms P to Q and step 2 transforms Q to R, providing P yields R.",
      leanAnalogy:
        "In Lean 4, backwards application via `apply` chains the calls in reverse order, asking for prerequisite inputs step by step.",
      tacticalObjective:
        "Chain `apply h2` ⟹ `apply h1` ⟹ `exact h_p` to solve the syllogism.",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/tactics.html#the-apply-tactic",
      realWorldApplication:
        "Static type inference and promise chaining in compiler pipelines (`Promise.then` workflows).",
    },
  },
  {
    id: 11,
    chapter: 2,
    chapterTitle: "Propositional Logic",
    title: "Disjunction Splitting",
    subtitle: "Level 11 · Case Analysis & Multi-Goal Branches",
    description:
      "Prove that logical OR is commutative (P ∨ Q → Q ∨ P) by splitting on cases.",
    initialRam: 18,
    goldRamTarget: 11,
    silverRamTarget: 5,
    hypotheses: [
      {
        id: "hyp-disj-lvl11",
        type: "Disjunction",
        value: "∨",
        metadata: { name: "h_or" },
        children: [
          { id: "disj-P-lvl11", type: "Variable", value: "P" },
          { id: "disj-Q-lvl11", type: "Variable", value: "Q" },
        ],
      },
    ],
    goal: {
      id: "goal-disj-target-lvl11",
      type: "Disjunction",
      value: "∨",
      children: [
        { id: "var-Q-out-lvl11", type: "Variable", value: "Q" },
        { id: "var-P-out-lvl11", type: "Variable", value: "P" },
      ],
    },
    availableTactics: [
      "cases",
      "left",
      "right",
      { id: "exact", hypothesis: "h_left", labelOverride: "exact h_left" },
      { id: "exact", hypothesis: "h_right", labelOverride: "exact h_right" },
      "sorry",
    ],
    hints: [
      "A disjunctive hypothesis (P ∨ Q) requires proving the goal in both possible cases.",
      "Apply 'cases' on hypothesis h_or to branch into Case 1 (h_left: P) and Case 2 (h_right: Q).",
      "In Case 1, use 'right' then 'exact h_left'. In Case 2, use 'left' then 'exact h_right'.",
    ],
    leanTheoremName: "or_commutative",
    leanTypeSignature: "(P Q : Prop) (h_or : P ∨ Q) : Q ∨ P",
    educationalConcept: {
      title: "Disjunction Elimination & Case Splits (cases)",
      summary:
        "In intuitionistic type theory, disjunction `P ∨ Q` is an inductive sum type (`Or.inl` / `Or.inr`). The `cases` tactic performs pattern matching, creating two independent proof branches.",
      mathNotation: "(P ∨ Q) ⟹ (Q ∨ P)",
      mathIntuition:
        "When you know at least one of two possibilities holds, you must show that your conclusion follows regardless of which branch is active.",
      leanAnalogy:
        "`cases h_or` matches on the inductive datatype `Or`, binding the payload `h_left : P` in the first branch and `h_right : Q` in the second branch. Then `left` or `right` applies `Or.inl` or `Or.inr`.",
      tacticalObjective:
        "Split the disjunction using 'cases', select the matching disjunct with 'right' or 'left', then close with 'exact'.",
      leanDocUrl:
        "https://lean-lang.org/theorem_proving_in_lean4/tactics.html#the-cases-tactic",
      realWorldApplication:
        "Exhaustive pattern matching in safe programming languages (Rust, Haskell, Swift) ensuring no missing enum variants.",
    },
  },
  {
    id: 12,
    chapter: 2,
    chapterTitle: "Propositional Logic",
    title: "Decidable Computation",
    subtitle: "Level 12 · Computational Reflection",
    description:
      "Prove the compound proposition (2 * 3 = 6) ∧ (10 > 5) via computational normalizer 'norm_num'.",
    initialRam: 12,
    goldRamTarget: 8,
    silverRamTarget: 4,
    hypotheses: [],
    goal: {
      id: "goal-conj-lvl12",
      type: "Conjunction",
      value: "∧",
      children: [
        {
          id: "eq-2x3-6-lvl12",
          type: "Equality",
          value: "=",
          children: [
            {
              id: "mult-2-3-lvl12",
              type: "Operator",
              value: "*",
              children: [
                { id: "c2-lvl12", type: "Constant", value: 2 },
                { id: "c3-lvl12", type: "Constant", value: 3 },
              ],
            },
            { id: "c6-lvl12", type: "Constant", value: 6 },
          ],
        },
        {
          id: "ineq-10-5-lvl12",
          type: "Inequality",
          value: ">",
          children: [
            { id: "c10-lvl12", type: "Constant", value: 10 },
            { id: "c5-lvl12", type: "Constant", value: 5 },
          ],
        },
      ],
    },
    availableTactics: ["norm_num", "decide", "simp", "sorry"],
    hints: [
      "Propositions with concrete numbers and boolean operators are completely decidable by evaluation.",
      "The conjunction connects two arithmetic facts: 2*3=6 and 10>5.",
      "Use 'norm_num' or 'decide' to evaluate both sides to True computationally.",
    ],
    leanTheoremName: "computational_conjunction",
    leanTypeSignature: ": (2 * 3 = 6) ∧ (10 > 5)",
    educationalConcept: {
      title: "Computational Reflection & norm_num",
      summary:
        "`norm_num` evaluates numerical operations (add, mul, div, pow, comparisons) by computing normalization proofs inside the logic kernel, reducing runtime proof size.",
      mathNotation: "(2 × 3 = 6) ∧ (10 > 5) ≡ True",
      mathIntuition:
        "Why construct axiomatic deduction steps when a computer can simply compute the answer? If a proposition contains only finite numbers and decidable operators, computation is proof.",
      leanAnalogy:
        "Lean 4's `decide` tactic checks if the type class instance `Decidable P` is available and runs the evaluator in the kernel to produce a reflexive proof `of_decide_eq_true rfl`.",
      tacticalObjective:
        "Invoke 'norm_num' or 'decide' to computationally reduce the arithmetic conjunction to True.",
      leanDocUrl:
        "https://leanprover-community.github.io/mathlib4_docs/Mathlib/Tactic/NormNum/Core.html",
      realWorldApplication:
        "Smart contracts and arithmetic circuits in zero-knowledge proofs (zk-SNARKs) verifying numerical integrity.",
    },
  },

  // =========================================================================
  // CHAPTER 3: Presburger Systems & Quasiperfect Number Theory
  // =========================================================================
  {
    id: 13,
    chapter: 3,
    chapterTitle: "Quasiperfect Number Theory",
    title: "Presburger Systems",
    subtitle: "Level 13 · Linear Integer Arithmetic",
    description:
      "Prove 3x + 2y ≤ 5x + y given 0 ≤ x and y ≤ 2x using linear decision procedures.",
    initialRam: 14,
    goldRamTarget: 4,
    silverRamTarget: 2,
    hypotheses: [
      {
        id: "hyp-hx-lvl13",
        type: "Inequality",
        value: "≤",
        metadata: { name: "hx" },
        children: [
          { id: "const-0-hx-lvl13", type: "Constant", value: 0 },
          { id: "var-x-hx-lvl13", type: "Variable", value: "x" },
        ],
      },
      {
        id: "hyp-hy-lvl13",
        type: "Inequality",
        value: "≤",
        metadata: { name: "hy" },
        children: [
          { id: "var-y-hy-lvl13", type: "Variable", value: "y" },
          {
            id: "expr-2x-hy-lvl13",
            type: "Operator",
            value: "*",
            children: [
              { id: "const-2-hy-lvl13", type: "Constant", value: 2 },
              { id: "var-x-hy2-lvl13", type: "Variable", value: "x" },
            ],
          },
        ],
      },
    ],
    goal: {
      id: "ineq-lvl13",
      type: "Inequality",
      value: "≤",
      children: [
        {
          id: "expr-lhs-lvl13",
          type: "Operator",
          value: "+",
          children: [
            {
              id: "term-3x-lvl13",
              type: "Operator",
              value: "*",
              children: [
                { id: "c3-lvl13", type: "Constant", value: 3 },
                { id: "vx-lvl13", type: "Variable", value: "x" },
              ],
            },
            {
              id: "term-2y-lvl13",
              type: "Operator",
              value: "*",
              children: [
                { id: "c2-lvl13", type: "Constant", value: 2 },
                { id: "vy-lvl13", type: "Variable", value: "y" },
              ],
            },
          ],
        },
        {
          id: "expr-rhs-lvl13",
          type: "Operator",
          value: "+",
          children: [
            {
              id: "term-5x-lvl13",
              type: "Operator",
              value: "*",
              children: [
                { id: "c5-lvl13", type: "Constant", value: 5 },
                { id: "vx2-lvl13", type: "Variable", value: "x" },
              ],
            },
            { id: "term-y-alone-lvl13", type: "Variable", value: "y" },
          ],
        },
      ],
    },
    availableTactics: ["omega", "linarith", "simp", "sorry"],
    hints: [
      "Integer inequalities with linear coefficients can be closed via Presburger decision procedures.",
      "The inequality is equivalent to 2y - y ≤ 5x - 3x, which simplifies to y ≤ 2x.",
      "Apply 'omega' or 'linarith' to solve the system automatically.",
    ],
    leanTheoremName: "linear_presburger_bound",
    leanTypeSignature:
      "(x y : Int) (hx : 0 ≤ x) (hy : y ≤ 2 * x) : 3 * x + 2 * y ≤ 5 * x + y",
    educationalConcept: {
      title: "Presburger Arithmetic (omega)",
      summary:
        "Mojżesz Presburger proved that the first-order theory of natural numbers with addition and equality is decidable. The `omega` tactic in Lean 4 solves integer linear systems efficiently.",
      mathNotation: "∀ x y ∈ ℤ, (0 ≤ x ∧ y ≤ 2x) ⟹ 3x + 2y ≤ 5x + y",
      mathIntuition:
        "Linear integer arithmetic does not allow multiplication between variables (which makes systems undecidable via Gödel's Incompleteness). Pure linear systems are always decidable in polynomial time.",
      leanAnalogy:
        "Lean 4’s `omega` uses the Omega Test algorithm, performing Fourier-Motzkin elimination and integer shadow projections to find contradiction certificates.",
      tacticalObjective:
        "Apply 'omega' or 'linarith' to close the linear inequality in a single step.",
      leanDocUrl:
        "https://leanprover-community.github.io/mathlib4_docs/Mathlib/Tactic/Omega.html",
      realWorldApplication:
        "Array bounds checking and buffer overflow prevention in verified compiler optimization (LLVM / CompCert).",
    },
  },
  {
    id: 14,
    chapter: 3,
    chapterTitle: "Quasiperfect Number Theory",
    title: "Bounded Transitivity",
    subtitle: "Level 14 · Linear Combinations",
    description:
      "Prove a ≤ c given hypotheses h1: a ≤ b and h2: b ≤ c using linear combination procedures.",
    initialRam: 14,
    goldRamTarget: 6,
    silverRamTarget: 2,
    hypotheses: [
      {
        id: "hyp-le1-lvl14",
        type: "Inequality",
        value: "≤",
        metadata: { name: "h1" },
        children: [
          { id: "var-a-le1", type: "Variable", value: "a" },
          { id: "var-b-le1", type: "Variable", value: "b" },
        ],
      },
      {
        id: "hyp-le2-lvl14",
        type: "Inequality",
        value: "≤",
        metadata: { name: "h2" },
        children: [
          { id: "var-b-le2", type: "Variable", value: "b" },
          { id: "var-c-le2", type: "Variable", value: "c" },
        ],
      },
    ],
    goal: {
      id: "ineq-lvl14-ac",
      type: "Inequality",
      value: "≤",
      children: [
        { id: "var-a-goal14", type: "Variable", value: "a" },
        { id: "var-c-goal14", type: "Variable", value: "c" },
      ],
    },
    availableTactics: ["linarith", "omega", "sorry"],
    hints: [
      "Linear arithmetic combines active hypotheses with non-negative multipliers.",
      "Adding (b - a ≥ 0) and (c - b ≥ 0) yields (c - a ≥ 0), proving a ≤ c.",
      "Apply 'linarith' to automatically discover the linear combination.",
    ],
    leanTheoremName: "le_transitivity",
    leanTypeSignature: "(a b c : Int) (h1 : a ≤ b) (h2 : b ≤ c) : a ≤ c",
    educationalConcept: {
      title: "Linear Arithmetic Solvers (linarith)",
      summary:
        "`linarith` (linear arithmetic) proves linear real, rational, and integer contradictions by synthesizing Farkas' Lemma certificates.",
      mathNotation: "(a ≤ b) ∧ (b ≤ c) ⟹ a ≤ c",
      mathIntuition:
        "Inequality systems can be solved by viewing them as half-spaces in vector geometry. If the target inequality's negation creates an empty polytope, the theorem is proven.",
      leanAnalogy:
        "`linarith` calls a simplex-based linear programming routine to compute positive coefficients that sum hypotheses into a contradiction.",
      tacticalObjective:
        "Invoke 'linarith' to solve the inequality transitivity.",
      leanDocUrl:
        "https://leanprover-community.github.io/mathlib4_docs/Mathlib/Tactic/Linarith.html",
      realWorldApplication:
        "Static analysis in safety-critical avionics: proving flight control variables stay within physical actuators' safe operating envelopes.",
    },
  },
  {
    id: 15,
    chapter: 3,
    chapterTitle: "Quasiperfect Number Theory",
    title: "Divisor Function Primer",
    subtitle: "Level 15 · Prime Sum of Divisors",
    description:
      "Prove σ(p) = p + 1 for prime p using the divisor summation hypothesis h_prime.",
    initialRam: 14,
    goldRamTarget: 11,
    silverRamTarget: 6,
    hypotheses: [
      {
        id: "hyp-prime-sig",
        type: "Equality",
        value: "=",
        metadata: { name: "h_prime" },
        children: [
          {
            id: "fn-sig-prime",
            type: "Function",
            value: "σ",
            children: [{ id: "var-p-prime", type: "Variable", value: "p" }],
          },
          {
            id: "expr-p-plus-1",
            type: "Operator",
            value: "+",
            children: [
              { id: "var-p-rhs-pr", type: "Variable", value: "p" },
              { id: "c1-prime", type: "Constant", value: 1 },
            ],
          },
        ],
      },
    ],
    goal: {
      id: "goal-lvl15-prime",
      type: "Equality",
      value: "=",
      children: [
        {
          id: "fn-sig-goal15",
          type: "Function",
          value: "σ",
          children: [{ id: "var-p-g15", type: "Variable", value: "p" }],
        },
        {
          id: "expr-p1-goal15",
          type: "Operator",
          value: "+",
          children: [
            { id: "var-p-g15b", type: "Variable", value: "p" },
            { id: "c1-g15", type: "Constant", value: 1 },
          ],
        },
      ],
    },
    availableTactics: [
      { id: "rw", hypothesis: "h_prime", labelOverride: "rw [h_prime]" },
      "rfl",
      "simp",
      "sorry",
    ],
    hints: [
      "The sum of positive divisors function σ(n) sums all d such that d | n.",
      "For any prime p, its only positive divisors are 1 and p, hence σ(p) = p + 1.",
      "Apply `rw [h_prime]` on the LHS, then close the goal with 'rfl'.",
    ],
    leanTheoremName: "sigma_prime_identity",
    leanTypeSignature: "(p : Nat) (h_prime : σ(p) = p + 1) : σ(p) = p + 1",
    educationalConcept: {
      title: "The Divisor Function σ(n)",
      summary:
        "In analytic number theory, the divisor function σ_k(n) = ∑_{d|n} d^k. For k=1, σ(n) is the sum of all positive divisors of n.",
      mathNotation: "p ∈ Prime ⟹ σ(p) = 1 + p",
      mathIntuition:
        "The divisor function is multiplicative: σ(ab) = σ(a)σ(b) when gcd(a,b) = 1. Studying σ(n) unlocks the secrets of perfect, abundant, deficient, and quasiperfect numbers.",
      leanAnalogy:
        "In Mathlib, `Nat.sigma` is defined as a sum over the finset `Nat.divisors n`. For primes, `Nat.Prime.divisors` evaluates to `{1, p}`.",
      tacticalObjective:
        "Rewrite σ(p) using hypothesis 'h_prime' and finish with 'rfl'.",
      leanDocUrl:
        "https://leanprover-community.github.io/mathlib4_docs/Mathlib/NumberTheory/ArithmeticFunction.html",
      realWorldApplication:
        "Public-key cryptography: RSA key generation relies on Euler's totient function φ(n) and divisor arithmetic on large semiprimes.",
    },
  },
  {
    id: 16,
    chapter: 3,
    chapterTitle: "Quasiperfect Number Theory",
    title: "Cattaneo's Abundancy",
    subtitle: "Level 16 · Sum of Divisors & Quasiperfect Numbers",
    description:
      "Prove σ(n) > 2n using the quasiperfect definition hypothesis h_def: σ(n) = 2n + 1 and positivity.",
    initialRam: 14,
    goldRamTarget: 9,
    silverRamTarget: 4,
    hypotheses: [
      {
        id: "hyp-quasi-def-lvl16",
        type: "Equality",
        value: "=",
        metadata: { name: "h_def" },
        children: [
          {
            id: "fn-sigma-lvl16",
            type: "Function",
            value: "σ",
            children: [{ id: "var-n-sig-lvl16", type: "Variable", value: "n" }],
          },
          {
            id: "expr-2n-plus-1-lvl16",
            type: "Operator",
            value: "+",
            children: [
              {
                id: "expr-2n-lvl16",
                type: "Operator",
                value: "*",
                children: [
                  { id: "c2-lvl16", type: "Constant", value: 2 },
                  { id: "var-n-lvl16", type: "Variable", value: "n" },
                ],
              },
              { id: "c1-lvl16", type: "Constant", value: 1 },
            ],
          },
        ],
      },
    ],
    goal: {
      id: "goal-sigma-gt-2n-lvl16",
      type: "Inequality",
      value: ">",
      children: [
        {
          id: "fn-sigma-goal-lvl16",
          type: "Function",
          value: "σ",
          children: [{ id: "var-n-goal16", type: "Variable", value: "n" }],
        },
        {
          id: "expr-2n-goal-lvl16",
          type: "Operator",
          value: "*",
          children: [
            { id: "c2-goal16", type: "Constant", value: 2 },
            { id: "var-n-goal16b", type: "Variable", value: "n" },
          ],
        },
      ],
    },
    availableTactics: [
      { id: "rw", hypothesis: "h_def", labelOverride: "rw [h_def]" },
      "linarith",
      "simp",
      "sorry",
    ],
    hints: [
      "A number n is quasiperfect if the sum of all its positive divisors σ(n) equals 2n + 1.",
      "Rewrite σ(n) in the goal using hypothesis 'h_def'.",
      "After rewriting to '2n + 1 > 2n', apply 'linarith' or 'simp' to complete the proof.",
    ],
    leanTheoremName: "quasiperfect_strict_abundancy",
    leanTypeSignature: "(n : Nat) (h_def : σ(n) = 2 * n + 1) : σ(n) > 2 * n",
    educationalConcept: {
      title: "Quasiperfect Numbers & Cattaneo's Conjecture",
      summary:
        "In number theory, a quasiperfect number has σ(n) = 2n + 1. Peter Cattaneo asked in 1951 whether any quasiperfect numbers exist. If one exists, it must be an odd perfect square > 10³⁵ with at least 7 distinct prime factors. None have ever been found!",
      mathNotation: "σ(n) = 2n + 1 ⟹ σ(n) > 2n",
      mathIntuition:
        "Perfect numbers satisfy σ(n) = 2n (like 6 and 28). Quasiperfect numbers overshoot perfection by exactly 1: σ(n) = 2n + 1. Because 2n + 1 > 2n, every quasiperfect number is strictly abundant.",
      leanAnalogy:
        "After rewriting σ(n) with `h_def`, the goal becomes `2*n + 1 > 2*n`, a linear inequality readily discharged by `linarith`.",
      tacticalObjective:
        "Rewrite σ(n) with `rw [h_def]` and close with `linarith`.",
      leanDocUrl: "https://en.wikipedia.org/wiki/Quasiperfect_number",
      realWorldApplication:
        "Number theoretic cryptography, partition theory, and distribution of abundant numbers.",
    },
  },
  {
    id: 17,
    chapter: 3,
    chapterTitle: "Quasiperfect Number Theory",
    title: "Aliquot Sum Partition",
    subtitle: "Level 17 · Proper Divisor Sum Identity",
    description:
      "Prove that the aliquot sum s(n) = σ(n) - n equals n + 1 for quasiperfect numbers.",
    initialRam: 16,
    goldRamTarget: 10,
    silverRamTarget: 5,
    hypotheses: [
      {
        id: "hyp-sig-ali",
        type: "Equality",
        value: "=",
        metadata: { name: "h_def" },
        children: [
          {
            id: "fn-sig-ali",
            type: "Function",
            value: "σ",
            children: [{ id: "var-n-ali", type: "Variable", value: "n" }],
          },
          {
            id: "expr-2n1-ali",
            type: "Operator",
            value: "+",
            children: [
              {
                id: "expr-2n-ali",
                type: "Operator",
                value: "*",
                children: [
                  { id: "c2-ali", type: "Constant", value: 2 },
                  { id: "var-n-ali2", type: "Variable", value: "n" },
                ],
              },
              { id: "c1-ali", type: "Constant", value: 1 },
            ],
          },
        ],
      },
    ],
    goal: {
      id: "goal-aliquot-lvl17",
      type: "Equality",
      value: "=",
      children: [
        {
          id: "expr-sig-minus-n",
          type: "Operator",
          value: "-",
          children: [
            {
              id: "fn-sig-g17",
              type: "Function",
              value: "σ",
              children: [{ id: "vn-g17", type: "Variable", value: "n" }],
            },
            { id: "vn-sub17", type: "Variable", value: "n" },
          ],
        },
        {
          id: "expr-n-plus-1-g17",
          type: "Operator",
          value: "+",
          children: [
            { id: "vn-rhs17", type: "Variable", value: "n" },
            { id: "c1-rhs17", type: "Constant", value: 1 },
          ],
        },
      ],
    },
    availableTactics: [
      { id: "rw", hypothesis: "h_def", labelOverride: "rw [h_def]" },
      "ring",
      "simp",
      "sorry",
    ],
    hints: [
      "The aliquot sum s(n) is the sum of all proper divisors of n, defined as s(n) = σ(n) - n.",
      "First rewrite σ(n) on the LHS using hypothesis 'h_def'.",
      "Then apply 'ring' to simplify (2n + 1) - n into n + 1.",
    ],
    leanTheoremName: "quasiperfect_aliquot_sum",
    leanTypeSignature:
      "(n : Nat) (h_def : σ(n) = 2 * n + 1) : σ(n) - n = n + 1",
    educationalConcept: {
      title: "The Aliquot Sum s(n) = σ(n) - n",
      summary:
        "In classical Greek number theory, integers were classified by their aliquot sum: deficient (s(n) < n), perfect (s(n) = n), or abundant (s(n) > n). For quasiperfect numbers, s(n) = n + 1.",
      mathNotation: "s(n) = σ(n) - n = (2n + 1) - n = n + 1",
      mathIntuition:
        "While a perfect number's proper divisors sum to itself, a quasiperfect number's proper divisors sum to the very next consecutive integer. This tight boundary makes their existence deeply constrained.",
      leanAnalogy:
        "Combining domain rewrites (`rw [h_def]`) with polynomial normalization (`ring`) bridges arithmetic definitions and algebraic canonical forms.",
      tacticalObjective:
        "Rewrite σ(n) with hypothesis 'h_def', then normalize with 'ring'.",
      leanDocUrl: "https://en.wikipedia.org/wiki/Aliquot_sum",
      realWorldApplication:
        "Aliquot sequence iteration, dynamical systems in discrete mathematics, and cryptography.",
    },
  },
  {
    id: 18,
    chapter: 3,
    chapterTitle: "Quasiperfect Number Theory",
    title: "The Quasiperfect Capstone",
    subtitle: "Level 18 (Grand Capstone) · Quadratic Verification",
    description:
      "Verify that for a quasiperfect number, (σ(n) - 1) + n² = (n + 1)² - 1 by chaining rewrites and polynomial ring normalization.",
    initialRam: 20,
    goldRamTarget: 13,
    silverRamTarget: 6,
    hypotheses: [
      {
        id: "hyp-sig-cap-lvl18",
        type: "Equality",
        value: "=",
        metadata: { name: "h_sig" },
        children: [
          {
            id: "fn-sig-cap-lvl18",
            type: "Function",
            value: "σ",
            children: [{ id: "var-n-cap-lvl18", type: "Variable", value: "n" }],
          },
          {
            id: "expr-2n1-cap-lvl18",
            type: "Operator",
            value: "+",
            children: [
              {
                id: "expr-2n-c-lvl18",
                type: "Operator",
                value: "*",
                children: [
                  { id: "c2-c-lvl18", type: "Constant", value: 2 },
                  { id: "var-n-c-lvl18", type: "Variable", value: "n" },
                ],
              },
              { id: "c1-c-lvl18", type: "Constant", value: 1 },
            ],
          },
        ],
      },
    ],
    goal: {
      id: "goal-capstone-lvl18",
      type: "Equality",
      value: "=",
      children: [
        {
          id: "lhs-cap-lvl18",
          type: "Operator",
          value: "+",
          children: [
            {
              id: "sig-minus-1-lvl18",
              type: "Operator",
              value: "-",
              children: [
                {
                  id: "fn-sig-lhs-lvl18",
                  type: "Function",
                  value: "σ",
                  children: [
                    { id: "vn-lhs-lvl18", type: "Variable", value: "n" },
                  ],
                },
                { id: "c1-lhs-lvl18", type: "Constant", value: 1 },
              ],
            },
            {
              id: "n-sq-lhs-lvl18",
              type: "Operator",
              value: "^",
              children: [
                { id: "vn-sq-lvl18", type: "Variable", value: "n" },
                { id: "c2-sq-lvl18", type: "Constant", value: 2 },
              ],
            },
          ],
        },
        {
          id: "rhs-cap-lvl18",
          type: "Operator",
          value: "-",
          children: [
            {
              id: "n-plus-1-sq-lvl18",
              type: "Operator",
              value: "^",
              children: [
                {
                  id: "n-plus-1-lvl18",
                  type: "Operator",
                  value: "+",
                  children: [
                    { id: "vn-rhs-lvl18", type: "Variable", value: "n" },
                    { id: "c1-rhs-lvl18", type: "Constant", value: 1 },
                  ],
                },
                { id: "c2-rhs-pow-lvl18", type: "Constant", value: 2 },
              ],
            },
            { id: "c1-rhs-sub-lvl18", type: "Constant", value: 1 },
          ],
        },
      ],
    },
    availableTactics: [
      { id: "rw", hypothesis: "h_sig", labelOverride: "rw [h_sig]" },
      "ring",
      "simp",
      "rfl",
      "sorry",
    ],
    hints: [
      "Combine hypothesis rewriting with ring polynomial normalization.",
      "First, rewrite σ(n) on the Left-Hand Side using hypothesis 'h_sig'.",
      "Once substituted, both sides are polynomial expressions: apply 'ring' to close the capstone theorem!",
    ],
    leanTheoremName: "quasiperfect_quadratic_form",
    leanTypeSignature:
      "(n : Nat) (h_sig : σ(n) = 2 * n + 1) : (σ(n) - 1) + n^2 = (n + 1)^2 - 1",
    educationalConcept: {
      title: "Interactive Verification Grand Capstone",
      summary:
        "Real formal verification in Lean 4 and Mathlib combines domain-specific definitions, hypothesis rewrites, and algebraic decision procedures (`ring`, `linarith`, `omega`) to prove deep mathematical conjectures.",
      mathNotation: "(σ(n) - 1) + n² = 2n + n² = (n + 1)² - 1",
      mathIntuition:
        "You have completed the full curriculum! From reflexive identity (x = x) through natural deduction and Presburger arithmetic to unsolved number theory conjectures, you have practiced Lean-style tactics in a local simulation.",
      leanAnalogy:
        "This level illustrates Lean-style tactics in a local TypeScript simulator. Its generated Lean text is an educational draft and has not been compiled or checked by the Lean kernel.",
      tacticalObjective:
        "Apply `rw [h_sig]` and finish with `ring` to complete the Quasi-Perfect Puzzler campaign!",
      leanDocUrl: "https://lean-lang.org/",
      realWorldApplication:
        "Full-stack formal verification of cryptography, distributed consensus protocols, and mission-critical avionics.",
    },
  },
];
