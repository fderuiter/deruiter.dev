import type { TableEvent, TableState } from "./table";

/**
 * What a guided step points at, so the adapter can mark it. `NONE` is a step
 * with nothing to act on, which the player moves past with Next.
 */
export type TutorialTarget =
  | { kind: "NONE" }
  | { kind: "CARD"; cardId: string }
  | { kind: "CARDS"; cardIds: string[] }
  | { kind: "CELL"; row: number; col: number }
  | { kind: "CORRECT" }
  | { kind: "CLOSE_INSPECT" }
  | { kind: "PLAY" };

/** The table outcome a guided step waits for; null waits for Next. */
export type TutorialWait =
  | null
  | { kind: "INSPECTING"; cardId: string }
  | { kind: "CELL_REVIEWED"; cardId: string; row: number; col: number }
  | { kind: "CORRECTED"; cardId: string; findingId: string }
  | { kind: "INSPECT_CLOSED" }
  | { kind: "SELECTED"; cardIds: string[] }
  | { kind: "PLAYED" };

/** One step of the guided Blind (#1089). */
export interface TutorialStep {
  id: string;
  title: string;
  /** The coach mark's text, announced politely when the step starts. */
  text: string;
  target: TutorialTarget;
  waitsFor: TutorialWait;
}

const GUIDED_TABLE = "C-T14.1.1-G";
const GUIDED_LISTING = "C-L16.2.4";
const GUIDED_FINDING = "SAP-DM-02@r1c0";

/**
 * The guided Blind's steps, in order: inspect a Table, review and correct
 * its one finding, then select it with its Listing and play the TLF Pair.
 * The wording and keys match the Field Manual.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = Object.freeze([
  {
    id: "welcome",
    title: "Your first review",
    text: "Every card is a clinical output. Play hands of them to reach the Blind's target score. First, check a draft against the SAP.",
    target: { kind: "NONE" },
    waitsFor: null,
  },
  {
    id: "inspect",
    title: "Inspect the Table",
    text: "Open Table 14.1.1 (Guided): select it and press Inspect, or focus it and press I. Inspecting costs 1 CPU.",
    target: { kind: "CARD", cardId: GUIDED_TABLE },
    waitsFor: { kind: "INSPECTING", cardId: GUIDED_TABLE },
  },
  {
    id: "review",
    title: "Review a cell",
    text: "Check the Placebo mean age, 49.83: click it, or move there with the arrow keys and press Enter.",
    target: { kind: "CELL", row: 1, col: 0 },
    waitsFor: { kind: "CELL_REVIEWED", cardId: GUIDED_TABLE, row: 1, col: 0 },
  },
  {
    id: "correct",
    title: "Correct the finding",
    text: "The SAP reports means to 1 decimal place, so 49.83 is a redline. Press Flag & Correct, or C, to fix it for +Mult.",
    target: { kind: "CORRECT" },
    waitsFor: {
      kind: "CORRECTED",
      cardId: GUIDED_TABLE,
      findingId: GUIDED_FINDING,
    },
  },
  {
    id: "close",
    title: "Back to the table",
    text: "Close the Inspect view with Close or Esc.",
    target: { kind: "CLOSE_INSPECT" },
    waitsFor: { kind: "INSPECT_CLOSED" },
  },
  {
    id: "select",
    title: "Make a TLF Pair",
    text: "A Table played with its supporting Listing is a TLF Pair. Select Table 14.1.1 and Listing 16.2.4: click them, or press Space on each.",
    target: { kind: "CARDS", cardIds: [GUIDED_TABLE, GUIDED_LISTING] },
    waitsFor: { kind: "SELECTED", cardIds: [GUIDED_TABLE, GUIDED_LISTING] },
  },
  {
    id: "play",
    title: "Play the hand",
    text: "Press Play Hand, or Enter. The score is Chips × Mult, and the correction you made adds Mult.",
    target: { kind: "PLAY" },
    waitsFor: { kind: "PLAYED" },
  },
]);

/** Whether the table already shows what a step waits for. */
export function tutorialStepDone(
  step: TutorialStep,
  event: TableEvent | null,
  state: TableState
): boolean {
  const wait = step.waitsFor;
  if (wait === null) return false;
  switch (wait.kind) {
    case "INSPECTING":
      return state.inspecting === wait.cardId;
    case "CELL_REVIEWED":
      return (
        state.inspections[wait.cardId]?.inspectedCells.includes(
          `${wait.row}:${wait.col}`
        ) ?? false
      );
    case "CORRECTED":
      return (
        state.inspections[wait.cardId]?.resolvedFindingIds.includes(
          wait.findingId
        ) ?? false
      );
    case "INSPECT_CLOSED":
      return state.inspecting === null;
    case "SELECTED":
      return wait.cardIds.every((id) => state.selected.includes(id));
    case "PLAYED":
      return event?.kind === "PLAYED" || state.handsPlayed > 0;
  }
}

/**
 * The step to show after the latest table event: the current step, or the
 * first later one whose outcome the table does not already show. Steps done
 * out of order are skipped, so a player who selects the Pair before closing
 * the Inspect view is not asked to do it again. Returns `steps.length` once
 * every step is done. Next-only steps are passed with {@link nextTutorialStep}.
 */
export function tutorialStepAfter(
  steps: readonly TutorialStep[],
  current: number,
  event: TableEvent | null,
  state: TableState
): number {
  let index = current;
  while (index < steps.length && tutorialStepDone(steps[index], event, state)) {
    index += 1;
  }
  return index;
}

/**
 * The step after pressing Next on a step that waits for nothing; any other
 * step stays put, since it waits for its table outcome.
 */
export function nextTutorialStep(
  steps: readonly TutorialStep[],
  current: number,
  state: TableState
): number {
  if (current >= steps.length || steps[current].waitsFor !== null) {
    return current;
  }
  return tutorialStepAfter(steps, current + 1, state.lastEvent, state);
}
