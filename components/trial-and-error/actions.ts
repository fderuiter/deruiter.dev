import {
  controlsFromActions,
  defineActions,
  type ActionName,
  type CabinetControl,
} from "@/lib/arcade";
import {
  handKeyIntent,
  type HandInputContext,
  type HandIntent,
  type HandKeyInput,
} from "@/lib/trial-and-error";

/**
 * Action map wrapping {@link handKeyIntent} (`lib/trial-and-error/internal/hand-input.ts`)
 * so `PlayCabinet` generates all 14 hand controls from one source of truth (#3443).
 */
export const TRIAL_AND_ERROR_ACTIONS = defineActions(
  {
    "focus-prev": {
      kind: "press",
      keys: ["ArrowLeft"],
      label: "Focus previous card",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "move",
    },
    "focus-next": {
      kind: "press",
      keys: ["ArrowRight"],
      label: "Focus next card",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "move",
    },
    "focus-first": {
      kind: "press",
      keys: ["Home"],
      label: "Focus first card",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "focus-first",
    },
    "focus-last": {
      kind: "press",
      keys: ["End"],
      label: "Focus last card",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "focus-last",
    },
    "move-left": {
      kind: "press",
      keys: ["ArrowLeft"],
      keyLabel: "Alt + ←",
      label: "Move card left",
      context: "hand-alt",
      preventDefault: true,
      onControls: true,
      group: "move-left",
    },
    "move-right": {
      kind: "press",
      keys: ["ArrowRight"],
      keyLabel: "Alt + →",
      label: "Move card right",
      context: "hand-alt",
      preventDefault: true,
      onControls: true,
      group: "move-right",
    },
    "toggle-select": {
      kind: "press",
      keys: ["Space"],
      label: "Select or deselect a card",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "select",
    },
    "play-hand": {
      kind: "press",
      keys: ["Enter"],
      label: "Play hand (2 CPU)",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "play",
    },
    "apply-seal": {
      kind: "press",
      keys: ["Enter", "Space"],
      keyLabel: "Enter / Space",
      label: "Affix picked-up seal",
      context: "seal",
      preventDefault: true,
      onControls: true,
    },
    "put-seal-back": {
      kind: "press",
      keys: ["Escape"],
      label: "Put seal back / Close Inspect",
      context: "seal",
      preventDefault: true,
      onControls: true,
      yieldsToCabinet: true,
      group: "escape",
    },
    "focus-allocate": {
      kind: "press",
      keys: ["KeyA"],
      label: "Focus analysis set allocation",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "allocate",
    },
    discard: {
      kind: "press",
      keys: ["KeyD"],
      label: "Discard selected (1 CPU)",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "discard",
    },
    inspect: {
      kind: "press",
      keys: ["KeyI"],
      label: "Inspect card (1 CPU)",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "inspect",
    },
    recompile: {
      kind: "press",
      keys: ["KeyR"],
      label: "Recompile stale card (2 CPU)",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "recompile",
    },
    "structural-qc": {
      kind: "press",
      keys: ["KeyS"],
      label: "Structural QC (1 CPU)",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "structural-qc",
    },
    "read-card": {
      kind: "press",
      keys: ["Slash"],
      keyLabel: "?",
      label: "Read card detail",
      context: "hand",
      preventDefault: true,
      onControls: true,
      group: "read-card",
    },
  },
  {
    groups: {
      move: { label: "Move across the hand", keyLabel: "← →" },
    },
  }
);

/** One action of {@link TRIAL_AND_ERROR_ACTIONS}. */
type TrialAndErrorActionName = ActionName<typeof TRIAL_AND_ERROR_ACTIONS>;

/**
 * The 14 PlayCabinet control rows generated from {@link TRIAL_AND_ERROR_ACTIONS}.
 */
export const TRIAL_AND_ERROR_CONTROLS: readonly CabinetControl[] =
  controlsFromActions(TRIAL_AND_ERROR_ACTIONS);

/**
 * Maps a resolved {@link HandIntent} (together with the originating key input)
 * to its named action in {@link TRIAL_AND_ERROR_ACTIONS}.
 */
export function actionNameForHandIntent(
  intent: HandIntent,
  input?: Pick<HandKeyInput, "key">
): TrialAndErrorActionName | null {
  switch (intent.kind) {
    case "BLOCKED":
      return null;
    case "FOCUS":
      if (input?.key === "Home") return "focus-first";
      if (input?.key === "End") return "focus-last";
      if (input?.key === "ArrowLeft") return "focus-prev";
      return "focus-next";
    case "MOVE":
      return input?.key === "ArrowLeft" ? "move-left" : "move-right";
    case "TOGGLE_SELECT":
      return "toggle-select";
    case "PLAY":
      return "play-hand";
    case "APPLY_SEAL":
      return "apply-seal";
    case "PUT_SEAL_BACK":
      return "put-seal-back";
    case "FOCUS_ALLOCATE":
      return "focus-allocate";
    case "DISCARD":
      return "discard";
    case "INSPECT":
      return "inspect";
    case "RECOMPILE":
      return "recompile";
    case "STRUCTURAL_QC":
      return "structural-qc";
    case "READ":
      return "read-card";
  }
}

/**
 * Resolves a key press on a card in hand through {@link handKeyIntent} and
 * pairs the resulting {@link HandIntent} with its named action in
 * {@link TRIAL_AND_ERROR_ACTIONS}.
 */
export function resolveHandKeyIntent(
  input: HandKeyInput,
  context: HandInputContext
): HandIntent | null {
  return handKeyIntent(input, context);
}
