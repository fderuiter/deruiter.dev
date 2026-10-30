import type { ArcadeTrophy } from "./types";

/** Retro Labyrinth trophies. */
export const RETRO_LABYRINTH_TROPHIES: ArcadeTrophy[] = [
  {
    id: "retro_labyrinth_crawler",
    gameId: "retro-labyrinth",
    title: "Dungeon Crawler",
    subtitle: "Retro Labyrinth",
    description: "Navigate shifting maze walls and defeat legacy code bugs.",
    icon: "DeviceGamepad2",
    category: "gameplay",
    targetScore: 500,
    conditionDescription: "Reach 500+ points in Retro Labyrinth",
  },
  {
    id: "retro_labyrinth_boss",
    gameId: "retro-labyrinth",
    title: "FaceForge Slayer",
    subtitle: "Retro Labyrinth",
    description:
      "Break the FaceForge wireframe boss and walk out of its arena.",
    icon: "Trophy",
    category: "gameplay",
    milestone: "faceforge_cleared",
    conditionDescription: "Clear the FaceForge boss room in Retro Labyrinth",
  },
  {
    id: "retro_labyrinth_untouched",
    gameId: "retro-labyrinth",
    title: "Zero Packets Lost",
    subtitle: "Retro Labyrinth",
    description: "Clear a boss room without a single volley landing.",
    icon: "ShieldCheck",
    category: "mastery",
    milestone: "boss_no_hit",
    conditionDescription:
      "Clear a Retro Labyrinth boss room without taking a hit from the boss",
  },
  {
    id: "retro_labyrinth_root",
    gameId: "retro-labyrinth",
    title: "Root Access",
    subtitle: "Retro Labyrinth",
    description:
      "Route through the whole network and take down the Neural Warden.",
    icon: "Cpu",
    category: "mastery",
    milestone: "run_completed",
    conditionDescription:
      "Finish a Retro Labyrinth run by clearing the Neural Warden",
  },
];
