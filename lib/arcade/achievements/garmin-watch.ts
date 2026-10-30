import type { ArcadeTrophy } from "./types";

/** Garmin Watch Simulator trophies. */
export const GARMIN_WATCH_TROPHIES: ArcadeTrophy[] = [
  {
    id: "garmin_survivor",
    gameId: "garmin-watch",
    title: "First Split",
    subtitle: "Monkey C Mayhem",
    description: "Reach the finish pole of a 1 km stage.",
    icon: "Cpu",
    category: "gameplay",
    milestone: "stage_cleared",
    conditionDescription: "Clear a stage in Monkey C Mayhem",
  },
  {
    id: "garmin_gc_master",
    gameId: "garmin-watch",
    title: "5K Finisher",
    subtitle: "Monkey C Mayhem",
    description: "Run all five stages and cross the 5K finish line.",
    icon: "Sparkles",
    category: "mastery",
    milestone: "run_complete",
    conditionDescription: "Finish the 5K in Monkey C Mayhem",
  },
];
