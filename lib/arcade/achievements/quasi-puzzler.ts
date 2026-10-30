import type { ArcadeTrophy } from "./types";

/** Quasi-Perfect Puzzler trophies. */
export const QUASI_PUZZLER_TROPHIES: ArcadeTrophy[] = [
  {
    id: "quasi_first_proof",
    gameId: "quasi-puzzler",
    title: "First Q.E.D.",
    subtitle: "Quasi-Perfect Puzzler",
    description: "Apply Lean 4 tactics to complete your first AST proof.",
    icon: "Brain",
    category: "gameplay",
    targetScore: 100,
    conditionDescription: "Complete at least 1 proof goal",
  },
  {
    id: "quasi_master_prover",
    gameId: "quasi-puzzler",
    title: "Formal Verifier",
    subtitle: "Quasi-Perfect Puzzler",
    description: "Prove every Act 1 level honestly, with no sorry.",
    icon: "ShieldCheck",
    category: "mastery",
    milestone: "all_levels_proven",
    conditionDescription: "Prove all 18 Act 1 levels",
  },
  {
    id: "quasi_all_gold",
    gameId: "quasi-puzzler",
    title: "Golden Lemma",
    subtitle: "Quasi-Perfect Puzzler",
    description: "Earn three stars on every Act 1 level.",
    icon: "Sparkles",
    category: "mastery",
    milestone: "all_gold",
    conditionDescription: "Earn gold (3 stars) on all 18 Act 1 levels",
  },
  {
    id: "quasi_act_two",
    gameId: "quasi-puzzler",
    title: "Almost Perfect",
    subtitle: "Quasi-Perfect Puzzler",
    description:
      "Prove every Act 2 level honestly: quantifiers, induction, inequality chains and almost perfect numbers.",
    icon: "Trophy",
    category: "mastery",
    milestone: "act_two_proven",
    conditionDescription: "Prove all 12 Act 2 levels without sorry",
  },
];
