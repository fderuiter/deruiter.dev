import type { ArcadeTrophy } from "./types";
import { PIPELINE_SIMULATOR_NAME } from "@/lib/clinical-tools/pipeline-simulator";

/** Trial Data Pipeline Simulator trophies. */
export const PROTOCOL_DRIFT_TROPHIES: ArcadeTrophy[] = [
  {
    id: "protocol_drift_locked",
    gameId: "protocol-drift",
    title: "Database Locked",
    subtitle: PIPELINE_SIMULATOR_NAME,
    description: "Clear both Database Lock gates for Study PD-101.",
    icon: "ShieldCheck",
    category: "gameplay",
    targetScore: 100,
    conditionDescription: "Lock the simulator's database",
  },
  {
    id: "protocol_drift_defensible",
    gameId: "protocol-drift",
    title: "Defensible Lock",
    subtitle: PIPELINE_SIMULATOR_NAME,
    description:
      "Lock the database and earn all three preventative badges without fabricating data.",
    icon: "Trophy",
    category: "mastery",
    // A milestone since #2054: efficiency points can pass the old 400 mark
    // without all three badges.
    milestone: "all_badges",
    conditionDescription:
      "Earn every preventative badge in the simulator at lock",
  },
  {
    id: "protocol_drift_lean_lock",
    gameId: "protocol-drift",
    title: "Lean Pipeline",
    subtitle: PIPELINE_SIMULATOR_NAME,
    description:
      "Lock the database with a live pipeline at or under the par chip count.",
    icon: "Cpu",
    category: "milestone",
    milestone: "lock_under_par_chips",
    conditionDescription: "Lock the simulator with no more chips than par",
  },
];
