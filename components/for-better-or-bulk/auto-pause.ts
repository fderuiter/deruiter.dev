/**
 * Window event the touch cabinet dispatches when the game should stop itself:
 * the tab is hidden, the page is closing or the window blurs (ADR 0061). A
 * mounted For Better or Bulk listens and pauses a day in progress. It is a
 * plain event so the arcade page never imports the game (#2123).
 */
export const FBB_AUTO_PAUSE_EVENT = "for-better-or-bulk:auto-pause";

/** Asks a mounted For Better or Bulk to pause, if a day is running. */
export function requestFbbAutoPause(): void {
  window.dispatchEvent(new Event(FBB_AUTO_PAUSE_EVENT));
}
