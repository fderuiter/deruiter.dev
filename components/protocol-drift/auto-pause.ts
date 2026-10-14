/**
 * Window event the touch cabinet dispatches when the game should stop itself:
 * the tab is hidden, the window blurs, or the device rotates (ADR 0061). The
 * workbench listens while it is mounted and pauses a running clock. It is a
 * plain event so the arcade page never imports the simulation store (#2045).
 */
export const PROTOCOL_DRIFT_AUTO_PAUSE_EVENT = "protocol-drift:auto-pause";

/** Asks a mounted workbench to pause its clock, if the clock is running. */
export function requestProtocolDriftAutoPause(): void {
  window.dispatchEvent(new Event(PROTOCOL_DRIFT_AUTO_PAUSE_EVENT));
}
