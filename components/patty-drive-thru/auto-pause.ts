/**
 * Window event the touch cabinet dispatches when the game should stop itself:
 * the tab is hidden, the page is closing or the window blurs (ADR 0061). A
 * mounted Patty's Drive-Thru listens and pauses a shift in progress. It is a
 * plain event so the arcade page never imports the game (#2116).
 */
export const PATTY_AUTO_PAUSE_EVENT = "patty-drive-thru:auto-pause";

/** Asks a mounted Patty's Drive-Thru to pause, if a shift is running. */
export function requestPattyAutoPause(): void {
  window.dispatchEvent(new Event(PATTY_AUTO_PAUSE_EVENT));
}
