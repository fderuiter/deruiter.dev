/**
 * Arcade Field Manual Aggregator & Registry
 *
 * Aggregates individual game field manuals into the canonical GAME_MANUALS registry.
 */

import type { FieldManualData } from "./types";
import { PROOF_MANUAL } from "./proof";
import { PATROL_MANUAL } from "./patrol";
import { WORKING_WITH_DUCK_MANUAL } from "./working-with-duck";
import { LASER_LOON_MANUAL } from "./laser-loon";
import { QUASI_PUZZLER_MANUAL } from "./quasi-puzzler";
import { GARMIN_WATCH_MANUAL } from "./garmin-watch";
import { CLINICAL_CHAOS_MANUAL } from "./clinical-chaos";
import { STUDY_DIRECTOR_MANUAL } from "./study-director";
import { PATTY_DRIVE_THRU_MANUAL } from "./patty-drive-thru";
import { FOR_BETTER_OR_BULK_MANUAL } from "./for-better-or-bulk";
import { PROTOCOL_DRIFT_MANUAL } from "./protocol-drift";
import { TRIAL_AND_ERROR_MANUAL } from "./trial-and-error";
import { RETRO_LABYRINTH_MANUAL } from "./retro-labyrinth";
import { MEME_VAULT_MANUAL } from "./meme-vault";
import { CRF_MANUAL } from "./crf";
import { SIMULATOR_MANUAL } from "./simulator";

export * from "./types";
export { PROOF_MANUAL } from "./proof";
export { PATROL_MANUAL } from "./patrol";
export { WORKING_WITH_DUCK_MANUAL } from "./working-with-duck";
export { LASER_LOON_MANUAL } from "./laser-loon";
export { QUASI_PUZZLER_MANUAL } from "./quasi-puzzler";
export { GARMIN_WATCH_MANUAL } from "./garmin-watch";
export { CLINICAL_CHAOS_MANUAL } from "./clinical-chaos";
export { STUDY_DIRECTOR_MANUAL } from "./study-director";
export { PATTY_DRIVE_THRU_MANUAL } from "./patty-drive-thru";
export { FOR_BETTER_OR_BULK_MANUAL } from "./for-better-or-bulk";
export { PROTOCOL_DRIFT_MANUAL } from "./protocol-drift";
export { TRIAL_AND_ERROR_MANUAL } from "./trial-and-error";
export { RETRO_LABYRINTH_MANUAL } from "./retro-labyrinth";
export { MEME_VAULT_MANUAL } from "./meme-vault";
export { CRF_MANUAL } from "./crf";
export { SIMULATOR_MANUAL } from "./simulator";

export const GAME_MANUALS: Record<string, FieldManualData> = {
  proof: PROOF_MANUAL,
  patrol: PATROL_MANUAL,
  "working-with-duck": WORKING_WITH_DUCK_MANUAL,
  "laser-loon": LASER_LOON_MANUAL,
  "quasi-puzzler": QUASI_PUZZLER_MANUAL,
  "garmin-watch": GARMIN_WATCH_MANUAL,
  "clinical-chaos": CLINICAL_CHAOS_MANUAL,
  "study-director": STUDY_DIRECTOR_MANUAL,
  "patty-drive-thru": PATTY_DRIVE_THRU_MANUAL,
  "for-better-or-bulk": FOR_BETTER_OR_BULK_MANUAL,
  "protocol-drift": PROTOCOL_DRIFT_MANUAL,
  "trial-and-error": TRIAL_AND_ERROR_MANUAL,
  "retro-labyrinth": RETRO_LABYRINTH_MANUAL,
  "meme-vault": MEME_VAULT_MANUAL,
  crf: CRF_MANUAL,
  simulator: SIMULATOR_MANUAL,
};
