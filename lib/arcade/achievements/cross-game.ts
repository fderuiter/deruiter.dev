import type { ArcadeTrophy } from "./types";

/** Cross-Game Meta Achievements. */
export const CROSS_GAME_TROPHIES: ArcadeTrophy[] = [
  {
    id: "arcade_triathlon",
    gameId: "cross_game",
    title: "Arcade Triathlete",
    subtitle: "Portfolio Meta",
    description: "Score personal bests in at least 3 distinct mini-games.",
    icon: "Trophy",
    category: "cross_game",
    conditionDescription: "Score in 3 or more games",
  },
  {
    id: "arcade_completionist",
    gameId: "cross_game",
    title: "Portfolio Veteran",
    subtitle: "Portfolio Meta",
    description: "Participate and set high scores in 6 or more mini-games.",
    icon: "Trophy",
    category: "cross_game",
    conditionDescription: "Score in 6 or more games",
  },
  {
    id: "arcade_legend",
    gameId: "cross_game",
    title: "Hall of Famer",
    subtitle: "Portfolio Meta",
    description: "Unlock 15 game trophies across the arcade.",
    icon: "Sparkles",
    category: "cross_game",
    conditionDescription: "Unlock 15 game trophies",
  },
];
