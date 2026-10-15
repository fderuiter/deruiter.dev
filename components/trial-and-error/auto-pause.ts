/**
 * Window event the touch cabinet dispatches when the game should stop itself:
 * the tab is hidden, the page is closing or the window blurs (ADR 0061). A
 * mounted Card Table listens and finishes a hand's scoring playback, the one
 * animated, timed state in Trial & Error. It is a plain event so the arcade
 * page never imports the table (#2120).
 */
export const TE_AUTO_PAUSE_EVENT = "trial-and-error:auto-pause";

/** Asks a mounted Card Table to settle any scoring playback in progress. */
export function requestTeAutoPause(): void {
  window.dispatchEvent(new Event(TE_AUTO_PAUSE_EVENT));
}
