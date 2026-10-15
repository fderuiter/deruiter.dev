/**
 * Window event the touch cabinet dispatches when the game should stop itself:
 * the tab is hidden, the page is closing or the window blurs (ADR 0061). A
 * mounted Monkey C Mayhem listens and pauses a run in progress. It is a plain
 * event so the arcade page never imports the game (#2122).
 */
export const GARMIN_AUTO_PAUSE_EVENT = "garmin-watch:auto-pause";

/** Asks a mounted Monkey C Mayhem to pause, if a run is in progress. */
export function requestGarminAutoPause(): void {
  window.dispatchEvent(new Event(GARMIN_AUTO_PAUSE_EVENT));
}
