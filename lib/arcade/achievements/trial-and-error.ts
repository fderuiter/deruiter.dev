import type { ArcadeTrophy } from "./types";

/** Trial & Error trophies. */
export const TRIAL_AND_ERROR_TROPHIES: ArcadeTrophy[] = [
  {
    id: "trial_error_first_blind",
    gameId: "trial-and-error",
    title: "Blind Cleared",
    subtitle: "Trial & Error",
    description: "Play Chips x Mult hands to satisfy the SAP review blind.",
    icon: "Cards",
    category: "gameplay",
    milestone: "blind_cleared",
    conditionDescription: "Clear a Blind in Trial & Error",
  },
  {
    id: "trial_error_csr_lock",
    gameId: "trial-and-error",
    title: "CSR Lock Mastery",
    subtitle: "Trial & Error",
    description: "Guide a candidate compound through all trial phases to lock.",
    icon: "Trophy",
    category: "mastery",
    milestone: "run_won",
    conditionDescription: "Win a Trial & Error run at CSR Lock",
  },
  {
    id: "trial_error_act_cleared",
    gameId: "trial-and-error",
    title: "Committee Survived",
    subtitle: "Trial & Error",
    description: "Beat an act's boss Blind and move the study to the next act.",
    icon: "ClipboardCheck",
    category: "gameplay",
    milestone: "act_cleared",
    conditionDescription: "Clear an act's boss Blind in Trial & Error",
  },
];
