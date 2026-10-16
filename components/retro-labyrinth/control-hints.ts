import { controlHint } from "@/components/arcade/mobile/touch-hint";

// Copy for the keyboard-named controls the phone player still sees. Each
// names the gesture on a coarse pointer and the keys everywhere else (ADR 0061).

/** The IP trace card: the restart control is the button above it. */
export const RETRY_HINT = controlHint({
  key: "Enter or R",
  touch: "Tap Retry Breach",
  desktop: "Enter or R to retry",
});

/** The room-cleared card in a roguelike run, with the next room to come. */
export const ROOM_CLEAR_HINT = controlHint({
  key: "Enter",
  touch: "Tap Next Room to continue",
  desktop: "Enter to continue · R to retry this room",
});

/**
 * The run-finished card, which starts over from Room 01. The run is over, so
 * it offers no retry of the last room (#2291).
 */
export const FINAL_ROOM_HINT = controlHint({
  key: "Enter",
  touch: "Tap New Run to start over from Room 01",
  desktop: "Enter for a new run from Room 01",
});
