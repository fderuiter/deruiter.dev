import type { FieldManualData } from "./types";

export const QUASI_PUZZLER_MANUAL: FieldManualData = {
  id: "quasi-puzzler",
  title: "Quasi-Perfect Puzzler",
  subtitle: "Formal Verification Logic Puzzle Arcade",
  genre: "Formal Verification",
  badge: "Lean 4 Simulator",
  route: "/arcade/quasi-puzzler",
  storageKey: "quasi_perfect_puzzler_progress_v1",
  accentColor: "from-purple-500/20 via-purple-500/5 to-transparent",
  badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/30",
  objective:
    "Construct formal AST proofs, discharge multi-goal branch cases, and synthesize valid Lean 4 code within language server RAM limits without conceding to the forbidden `sorry` axiom.",
  quickSummary:
    "Apply formal proof tactics (intro, apply, exact, cases, rw, ring, norm_num, simp, omega, use, induction, trans, gcongr) across a two-act, 7-chapter curriculum to discharge mathematical theorems and preserve verification morality.",
  controls: [
    {
      action: "Apply Proof Tactic",
      description:
        "Click or drag tactic cards (`intro`, `apply`, `exact`, `cases`, `rw`, `ring`, `norm_num`, `simp`, `omega`, `linarith`, `use`, `induction`, `trans`, `gcongr`) onto AST nodes to transform goals.",
      key: "Click / Drag Tactic",
    },
    {
      action: "Branch & Multi-Goal Navigation",
      description:
        "Tactics like `cases` and `induction` split goals into multiple subgoals. Use the branch tabs to switch between active goals until all are discharged.",
      key: "Subgoal Tabs",
    },
    {
      action: "Progressive Hint Coach",
      description:
        "Toggle progressive 3-tier hints for conceptual strategy, target subtree highlights, and recommended tactics.",
      key: "Hints Button (H)",
    },
    {
      action: "Lean 4 IDE Inspector",
      description:
        "Inspect live generated Lean 4 code in real time (`theorem ... := by ...`) and copy directly to Lean Web Editor.",
      key: "Lean IDE (C)",
    },
    {
      action: "Undo & Redo Tactics",
      description:
        "Step back through applied tactics with Ctrl+Z (Cmd+Z on Mac) and reapply them with Ctrl+Y (Cmd+Y). The plain Z and Y keys do nothing. R resets the level.",
      key: "Ctrl/⌘ + Z / Y",
    },
    {
      action: "Switch Mode",
      description:
        "Toggle between Story Mode and Hacker Mode. Switching restarts the current level with the new mode's RAM budget; mid-proof, you confirm the restart first.",
      key: "M",
    },
    {
      action: "The 'Sorry' Escape Valve",
      description:
        "Admit defeat on the current branch using `sorry`. It costs no RAM but permanently incurs a -100 Morality Penalty. Like every tactic, it is locked at 0 GB until you reset the level.",
      key: "Sorry Button",
    },
  ],
  rules: [
    {
      title: "Expression Tree Transformation",
      detail:
        "Every mathematical theorem is modeled as an Abstract Syntax Tree (AST). Tactics transform the root goal into simpler sub-goals until reaching known axioms.",
      badge: "AST Engine",
    },
    {
      title: "Proof-Engine RAM Limit",
      detail:
        "Each tactic, including a failed one, consumes simulated memory. Story Mode starts with twice the Hacker Mode budget. In either mode, hitting 0 GB stops the simulated tactic session and the level must be reset. Every tactic, sorry included, stays locked until then.",
      badge: "RAM Constraint",
    },
    {
      title: "Multi-Goal Case Splits",
      detail:
        "Disjunctions (P ∨ Q) split into independent cases with their own hypotheses. Both branches must be discharged to achieve Q.E.D.",
      badge: "Multi-Goal",
    },
    {
      title: "Zero-Sorry Morality Rating",
      detail:
        "Using `sorry` bypasses a difficult sub-goal without proving it, assigning a severe penalty to your final verification integrity score.",
      badge: "Integrity Score",
    },
    {
      title: "Challenge Variants",
      detail:
        "Prove a level without `sorry` to unlock its challenge variants under the level title. Tight RAM starts you with exactly what the cheapest proof spends, in either mode, so a single failed tactic leaves too little to finish. Step limit fails the run on the step after the level's par. On twelve levels a third variant bans the tactic the usual proof needs; the banned card stays in the hand marked Banned. A variant cleared honestly is saved on the level map (V cleared/total) and never changes the level's stars.",
      badge: "Replay",
    },
    {
      title: "Act 2: Quantifiers, Induction & Chains",
      detail:
        "Prove Level 18, the Act 1 capstone, without `sorry` to open Act 2 (Levels 19–30): ∀ and ∃ goals (`intro`, `use`), induction over ℕ with a base case and a step case that carries `ih`, ≤ chains (`trans`, `gcongr`), and an almost perfect numbers arc that ends at a second capstone. Act 1 levels, stars and saves are unchanged, and a save that already proved Level 18 opens Act 2 at once.",
      badge: "Act 2",
    },
  ],
  proTips: [
    "Use `ring` to automatically prove algebraic polynomial equivalences like (a+b)² = a² + 2ab + b².",
    "`intro h` unpacks implication antecedents into your local hypothesis pool.",
    "`cases h_or` splits a disjunction into two sub-goals (h_left and h_right).",
    "`norm_num` rapidly evaluates concrete numerical arithmetic and comparisons.",
    "Targeted `rw [h]` uses far less RAM (2 GB) than full confluent search `simp` (6 GB).",
    "`rw` with a ∀ lemma rewrites any sub-term of the lemma's shape: tap the instance you mean.",
    "In an induction step, rearrange until the k case appears, then rewrite it with `ih`.",
  ],
  lore: {
    title: "The Curry-Howard Isomorphism & Lean 4",
    story:
      "The Curry-Howard correspondence establishes that computer programs and mathematical proofs are the exact same mathematical objects: propositions are types, and proofs are programs. Interactive theorem provers like Lean 4, developed at Microsoft Research and Carnegie Mellon, enable mathematicians and engineers to formally verify complex mathematics (such as Peter Scholze's Liquid Tensor Experiment) and verify production microcode.",
    realWorldTech: [
      "Lean 4",
      "Dependent Type Theory",
      "Homotopy Type Theory",
      "Calculus of Constructions",
    ],
  },
};
