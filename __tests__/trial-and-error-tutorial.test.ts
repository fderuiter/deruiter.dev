// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  GUIDED_BLIND_SCENARIO as GUIDED,
  ScenarioSchema,
  TUTORIAL_STEPS,
  advanceTable,
  createTableState,
  deriveTableView,
  nextTutorialStep,
  tutorialStepAfter,
  tutorialStepDone,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

const TABLE = "C-T14.1.1-G";
const LISTING = "C-L16.2.4";
const FINDING = "SAP-DM-02@r1c0";

const play = (actions: TableAction[], from = createTableState(GUIDED)) =>
  actions.reduce<TableState>((state, action) => {
    const next = advanceTable(GUIDED, state, action);
    expect(next.lastEvent?.kind, JSON.stringify(action)).not.toBe("REFUSED");
    return next;
  }, from);

/** The guided moves, in step order after Welcome. */
const GUIDED_MOVES: TableAction[][] = [
  [{ type: "INSPECT_CARD", cardId: TABLE }],
  [{ type: "INSPECT_CELL", row: 1, col: 0 }],
  [{ type: "CORRECT_FINDING", findingId: FINDING }],
  [{ type: "CLOSE_INSPECT" }],
  [
    { type: "TOGGLE_SELECT", cardId: TABLE },
    { type: "TOGGLE_SELECT", cardId: LISTING },
  ],
  [{ type: "PLAY_HAND" }],
];

describe("Guided Blind scenario (#1089)", () => {
  it("is a valid Small Blind with a fixed hand, no crisis and no draws", () => {
    expect(ScenarioSchema.safeParse(GUIDED).success).toBe(true);
    expect(GUIDED.blind.tier).toBe("SMALL_BLIND");
    const state = createTableState(GUIDED);
    expect(state.hand).toEqual(GUIDED.deck.map((c) => c.id));
    expect(state.crisis).toBeNull();
    expect(state.consumables).toEqual([]);
    expect(GUIDED.events).toBeUndefined();
  });

  it("has exactly one finding, on the cell the steps point at", () => {
    const state = play([
      { type: "INSPECT_CARD", cardId: TABLE },
      { type: "INSPECT_CELL", row: 1, col: 0 },
    ]);
    const open = deriveTableView(GUIDED, state).inspection?.openFindings;
    expect(open?.map((f) => f.id)).toEqual([FINDING]);
  });

  it("clears only once the finding is corrected", () => {
    const ids = GUIDED.deck.map((c) => c.id);
    let best = 0;
    for (let mask = 1; mask < 1 << ids.length; mask++) {
      const combo = ids.filter((_, i) => mask & (1 << i));
      const state = play([
        ...combo.map((cardId): TableAction => ({
          type: "TOGGLE_SELECT",
          cardId,
        })),
        { type: "PLAY_HAND" },
      ]);
      best = Math.max(best, state.roundScore);
    }
    // No uncorrected hand, even followed by what is left, reaches the quota.
    expect(best).toBeLessThan(GUIDED.blind.quota / 2);

    const cleared = play(GUIDED_MOVES.flat());
    expect(cleared.lastPlay?.classification.handType).toBe("TLF_PAIR");
    expect(cleared.roundScore).toBeGreaterThanOrEqual(GUIDED.blind.quota);
    expect(cleared.status).toBe("CLEARED");
  });
});

describe("tutorial step engine (#1089)", () => {
  it("waits on Welcome until Next", () => {
    const state = createTableState(GUIDED);
    expect(tutorialStepAfter(TUTORIAL_STEPS, 0, null, state)).toBe(0);
    expect(nextTutorialStep(TUTORIAL_STEPS, 0, state)).toBe(1);
  });

  it("ignores Next on a step that waits for the table", () => {
    const state = createTableState(GUIDED);
    expect(nextTutorialStep(TUTORIAL_STEPS, 1, state)).toBe(1);
    expect(nextTutorialStep(TUTORIAL_STEPS, TUTORIAL_STEPS.length, state)).toBe(
      TUTORIAL_STEPS.length
    );
  });

  it("walks every step to the end on the guided moves", () => {
    let state = createTableState(GUIDED);
    let step = nextTutorialStep(TUTORIAL_STEPS, 0, state);
    const seen = [TUTORIAL_STEPS[0].id];
    for (const moves of GUIDED_MOVES) {
      seen.push(TUTORIAL_STEPS[step].id);
      state = play(moves, state);
      const next = tutorialStepAfter(
        TUTORIAL_STEPS,
        step,
        state.lastEvent,
        state
      );
      expect(next).toBe(step + 1);
      step = next;
    }
    expect(seen).toEqual(TUTORIAL_STEPS.map((s) => s.id));
    expect(step).toBe(TUTORIAL_STEPS.length);
  });

  it("does not move on for the wrong card or cell", () => {
    // Disposition is face only, so inspecting it is refused.
    let state = advanceTable(GUIDED, createTableState(GUIDED), {
      type: "INSPECT_CARD",
      cardId: "C-T14.1.2",
    });
    expect(tutorialStepAfter(TUTORIAL_STEPS, 1, state.lastEvent, state)).toBe(
      1
    );
    state = play([
      { type: "INSPECT_CARD", cardId: TABLE },
      { type: "INSPECT_CELL", row: 0, col: 0 },
    ]);
    expect(tutorialStepAfter(TUTORIAL_STEPS, 2, state.lastEvent, state)).toBe(
      2
    );
    state = play([{ type: "TOGGLE_SELECT", cardId: TABLE }]);
    expect(tutorialStepAfter(TUTORIAL_STEPS, 5, state.lastEvent, state)).toBe(
      5
    );
  });

  it("skips steps the player already did out of order", () => {
    // Selected the Pair first, then inspected and corrected: closing the
    // Inspect view finishes both the close and the select steps.
    const state = play([
      { type: "TOGGLE_SELECT", cardId: TABLE },
      { type: "TOGGLE_SELECT", cardId: LISTING },
      ...GUIDED_MOVES.slice(0, 4).flat(),
    ]);
    expect(tutorialStepAfter(TUTORIAL_STEPS, 4, state.lastEvent, state)).toBe(
      6
    );
  });

  it("counts a played hand as played", () => {
    const state = play([
      { type: "TOGGLE_SELECT", cardId: TABLE },
      { type: "PLAY_HAND" },
    ]);
    const playStep = TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1];
    expect(tutorialStepDone(playStep, state.lastEvent, state)).toBe(true);
    expect(tutorialStepDone(playStep, null, createTableState(GUIDED))).toBe(
      false
    );
  });

  it("points only at cards in the guided hand", () => {
    const hand = new Set(GUIDED.deck.map((c) => c.id));
    for (const step of TUTORIAL_STEPS) {
      const ids =
        step.target.kind === "CARD"
          ? [step.target.cardId]
          : step.target.kind === "CARDS"
            ? step.target.cardIds
            : [];
      ids.forEach((id) => expect(hand.has(id)).toBe(true));
    }
  });
});
