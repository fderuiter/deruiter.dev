/**
 * Window event the touch cabinet dispatches when the game should stop itself:
 * the tab is hidden, the page is closing or the window blurs (ADR 0061). A
 * mounted Laser Loon listens and pauses a run in progress. It is a plain event
 * so the arcade page never imports the game (#2081).
 */
export const LASER_LOON_AUTO_PAUSE_EVENT = "laser-loon:auto-pause";

/** Asks a mounted Laser Loon to pause, if a run is in progress. */
export function requestLaserLoonAutoPause(): void {
  window.dispatchEvent(new Event(LASER_LOON_AUTO_PAUSE_EVENT));
}
