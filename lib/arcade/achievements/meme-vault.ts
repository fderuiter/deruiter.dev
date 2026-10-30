import type { ArcadeTrophy } from "./types";

/** Meme Vault trophies. */
export const MEME_VAULT_TROPHIES: ArcadeTrophy[] = [
  {
    id: "meme_vault_explorer",
    gameId: "meme-vault",
    title: "Soundboard Operator",
    subtitle: "Meme Vault",
    description: "Find your first hidden trophy in or around the Meme Vault.",
    icon: "Sparkles",
    category: "gameplay",
    targetScore: 100,
    conditionDescription: "Find 1 Meme Vault easter egg",
  },
  {
    id: "meme_vault_echo_5",
    gameId: "meme-vault",
    title: "Echo Chamber",
    subtitle: "Meme Vault",
    description: "Repeat a five-pad Echo sequence without a wrong pad.",
    icon: "Sparkles",
    category: "gameplay",
    milestone: "echo_streak_5",
    conditionDescription: "Reach an Echo streak of 5 in Meme Vault",
  },
  {
    id: "meme_vault_echo_10",
    gameId: "meme-vault",
    title: "Perfect Recall",
    subtitle: "Meme Vault",
    description: "Repeat a ten-pad Echo sequence without a wrong pad.",
    icon: "Trophy",
    category: "mastery",
    milestone: "echo_streak_10",
    conditionDescription: "Reach an Echo streak of 10 in Meme Vault",
  },
  {
    id: "meme_vault_cleared",
    gameId: "meme-vault",
    title: "Vault Cleared",
    subtitle: "Meme Vault",
    description: "Find all six hidden trophies in and around the Meme Vault.",
    icon: "Trophy",
    category: "mastery",
    targetScore: 600,
    conditionDescription: "Find all 6 Meme Vault easter eggs",
  },
];
