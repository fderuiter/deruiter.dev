/**
 * Window event the touch cabinet dispatches when the game should stop itself:
 * the tab is hidden, the page is closing or the window blurs (ADR 0061). A
 * mounted Clinical Trial Chaos listens and pauses a shift in progress. It is a
 * plain event so the arcade page never imports the game (#2105).
 */
export const CLINICAL_CHAOS_AUTO_PAUSE_EVENT = "clinical-chaos:auto-pause";

/** Asks a mounted Clinical Trial Chaos to pause, if a shift is running. */
export function requestClinicalChaosAutoPause(): void {
  window.dispatchEvent(new Event(CLINICAL_CHAOS_AUTO_PAUSE_EVENT));
}
