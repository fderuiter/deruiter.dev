import {
  INITIAL_PATROL_SCENARIOS,
  OEC_SAMPLE_SCENARIO,
} from "./scenarios/catalog";
import { WRIST_INJURY_SCENARIO } from "./scenarios/wrist-injury";
import { AMBIGUOUS_PATIENT_SCENARIO } from "./scenarios/ambiguous-patient";
import { BUSY_SCENE_SCENARIO } from "./scenarios/busy-scene";
import type { PatrolScenario } from "./types";

/**
 * The three MVP scenario content packages (Issue #752 / epic #744), covering
 * a straightforward injury, an ambiguous patient, and a busy/crowded scene.
 * Randomly (or sequentially) selected per shift by the Mountain Map hub.
 */
export const PATROL_SCENARIOS: PatrolScenario[] = [
  WRIST_INJURY_SCENARIO,
  AMBIGUOUS_PATIENT_SCENARIO,
  BUSY_SCENE_SCENARIO,
];

/**
 * Comprehensive list of all scenarios registered across milestones, MVP
 * scenarios first so they are preferred by default scenario selection.
 */
export const ALL_PATROL_SCENARIOS: PatrolScenario[] = [
  ...PATROL_SCENARIOS,
  ...INITIAL_PATROL_SCENARIOS,
  OEC_SAMPLE_SCENARIO,
];

export { INITIAL_PATROL_SCENARIOS, OEC_SAMPLE_SCENARIO };

export function getScenarioById(id: string): PatrolScenario | undefined {
  return ALL_PATROL_SCENARIOS.find((s) => s.id === id);
}
