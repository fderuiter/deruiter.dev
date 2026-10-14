/**
 * Window event the touch cabinet dispatches when the game should stop itself:
 * the tab is hidden, the window blurs, or the device rotates (ADR 0061). The
 * office listens while it is mounted and stops a walk in progress. It is a
 * plain event so the arcade page never imports the world (#2076).
 */
export const STUDY_DIRECTOR_AUTO_PAUSE_EVENT = "study-director:auto-pause";

/** Asks a mounted office to stop walking, if it is walking. */
export function requestStudyDirectorAutoPause(): void {
  window.dispatchEvent(new Event(STUDY_DIRECTOR_AUTO_PAUSE_EVENT));
}
