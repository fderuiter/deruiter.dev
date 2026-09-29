/**
 * The Hand's interaction policy (#997): what a key, a tap, a long press or a
 * finished drag on a card in hand means. Pure; the Card Table and HandCard
 * only turn these intents into dispatches, focus moves and motion.
 */

/** How long a press must hold still before it reads the card, in ms. */
export const LONG_PRESS_MS = 500;

/** How far a press may travel, in px, and still count as a long press. */
export const LONG_PRESS_SLOP_PX = 8;

/** The drag payload type a tray seal carries onto a card. */
export const SEAL_DRAG_TYPE = "application/x-te-seal";

/** What an input on a card in hand asks for. */
export type HandIntent =
  /** Consume the input and do nothing, e.g. a reorder during playback. */
  | { kind: "BLOCKED" }
  /** Move the roving focus to another card. */
  | { kind: "FOCUS"; index: number }
  /** Move this card to `toIndex`; focus follows it to `focusIndex`. */
  | { kind: "MOVE"; toIndex: number; focusIndex: number }
  | { kind: "TOGGLE_SELECT" }
  | { kind: "PLAY" }
  | { kind: "DISCARD" }
  | { kind: "INSPECT" }
  | { kind: "RECOMPILE" }
  | { kind: "STRUCTURAL_QC" }
  /** Hand focus to the allocation control for this blank shell. */
  | { kind: "FOCUS_ALLOCATE" }
  /** Open the card's detail view. */
  | { kind: "READ" }
  /** Affix the picked-up footnote seal to this card. */
  | { kind: "APPLY_SEAL" }
  /** Put the picked-up footnote seal back in the tray. */
  | { kind: "PUT_SEAL_BACK" };

/** The card an input landed on, and what the table is doing. */
export interface HandInputContext {
  /** The card's position in the Hand. */
  index: number;
  /** Cards in the Hand. */
  count: number;
  /** A footnote seal is picked up and waiting for a card. */
  sealArmed: boolean;
  /** Score playback is running, so Hand actions are locked. */
  locked: boolean;
  /** The card is a blank shell waiting for an analysis set. */
  blank: boolean;
  /** The card is a blinded output dealt face down. */
  faceDown: boolean;
}

/** A key press on a card, as the policy reads it. */
export interface HandKeyInput {
  key: string;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  /** The key was pressed on the card itself, not a nested element. */
  onCard: boolean;
}

function clampIndex(index: number, count: number): number {
  if (index <= 0 || count <= 1) return 0;
  return index >= count - 1 ? count - 1 : index;
}

/**
 * What a key pressed on a card in hand asks for, or null when the key is not
 * the Hand's and should keep its default behavior.
 *
 * Arrows, Home and End rove focus. Alt with an arrow reorders, except during
 * playback. Every other key acts only on the card itself, without Meta, Ctrl
 * or Alt, and not during playback. With a seal picked up, Enter or Space
 * affixes it and Escape puts it back.
 */
export function handKeyIntent(
  input: HandKeyInput,
  context: HandInputContext
): HandIntent | null {
  const { key } = input;
  const { index, count } = context;
  if (input.altKey && (key === "ArrowLeft" || key === "ArrowRight")) {
    if (context.locked) return { kind: "BLOCKED" };
    const toIndex = key === "ArrowLeft" ? index - 1 : index + 1;
    return { kind: "MOVE", toIndex, focusIndex: clampIndex(toIndex, count) };
  }
  const moves: Record<string, number> = {
    ArrowLeft: index - 1,
    ArrowRight: index + 1,
    Home: 0,
    End: count - 1,
  };
  if (key in moves) {
    return { kind: "FOCUS", index: clampIndex(moves[key], count) };
  }
  if (!input.onCard || context.locked) return null;
  if (input.metaKey || input.ctrlKey || input.altKey) return null;
  if (context.sealArmed && (key === "Enter" || key === " ")) {
    return { kind: "APPLY_SEAL" };
  }
  if (context.sealArmed && key === "Escape") return { kind: "PUT_SEAL_BACK" };
  if (key.toLowerCase() === "a" && context.blank)
    return { kind: "FOCUS_ALLOCATE" };
  if (key === " ") return { kind: "TOGGLE_SELECT" };
  if (key === "Enter") return { kind: "PLAY" };
  if (key.toLowerCase() === "d") return { kind: "DISCARD" };
  if (key.toLowerCase() === "i") return { kind: "INSPECT" };
  if (key.toLowerCase() === "r" && !input.shiftKey)
    return { kind: "RECOMPILE" };
  if (key.toLowerCase() === "s" && context.faceDown)
    return { kind: "STRUCTURAL_QC" };
  // On a card, ? reads it; elsewhere it opens the Field Manual.
  if (key === "?") return { kind: "READ" };
  return null;
}

/** A tap or click on a card, as the policy reads it. */
export interface HandActivation {
  /** The pointer that pressed the card: "mouse", "pen" or "touch". */
  pointerType: string;
  /** The card is already selected. */
  selected: boolean;
  sealArmed: boolean;
  locked: boolean;
}

/**
 * What a tap or click on a card asks for. A picked-up seal is affixed. On
 * touch, a second tap on a selected card reads it rather than deselecting it,
 * and the detail view offers Deselect. Otherwise the tap toggles selection.
 */
export function handActivationIntent(
  activation: HandActivation
): HandIntent | null {
  if (activation.locked) return null;
  if (activation.sealArmed) return { kind: "APPLY_SEAL" };
  if (activation.pointerType === "touch" && activation.selected) {
    return { kind: "READ" };
  }
  return { kind: "TOGGLE_SELECT" };
}

/**
 * True once a press has travelled too far to be a long press, so it is a
 * scroll or a drag instead.
 */
export function pressTravelled(
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) > LONG_PRESS_SLOP_PX;
}

/**
 * The order to draw the Hand in: the order a drag in progress is showing, if
 * it still holds exactly the cards in hand, otherwise the Hand itself.
 */
export function handDisplayOrder(
  handIds: string[],
  dragOrder: string[] | null
): string[] {
  if (
    dragOrder &&
    dragOrder.length === handIds.length &&
    dragOrder.every((id) => handIds.includes(id))
  ) {
    return dragOrder;
  }
  return handIds;
}

/**
 * Where a finished drag moved `cardId` to, or null when it ended where it
 * started. A drag commits once, on release, and spends no CPU.
 */
export function reorderTarget(
  handIds: readonly string[],
  shownOrder: readonly string[],
  cardId: string
): number | null {
  const to = shownOrder.indexOf(cardId);
  if (to === -1 || to === handIds.indexOf(cardId)) return null;
  return to;
}
