import { safeGetRawItem } from "@/lib/safe-storage";
import { arcadeTutorialsSlice, read, setTutorialOutcome } from "@/lib/arcade";
import { TRIAL_AND_ERROR_TUTORIAL } from "@/lib/trial-and-error";

/**
 * Set by the table's own tutorial (#1089) once the guided Blind was finished
 * or skipped. The cabinet now keeps that record; this key is only read, so a
 * returning player is not offered the same guided Blind again.
 */
export const TUTORIAL_SEEN_KEY = "te:tutorial-seen";

/**
 * Carries a returning player's answer from the table's own tutorial over to
 * the cabinet's record, as turned down, so the cabinet does not offer the
 * same guided Blind again. The Tutorial key still replays it.
 */
export function carryOverTutorialSeen() {
  if (safeGetRawItem(TUTORIAL_SEEN_KEY) !== "1") return;
  if (read(arcadeTutorialsSlice).games[TRIAL_AND_ERROR_TUTORIAL.gameId]) {
    return;
  }
  setTutorialOutcome(
    TRIAL_AND_ERROR_TUTORIAL.gameId,
    TRIAL_AND_ERROR_TUTORIAL.version,
    "declined"
  );
}
