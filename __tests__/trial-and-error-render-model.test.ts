import { describe, it, expect } from "vitest";
import {
  CSR_LOCK_SCENARIO,
  GUIDED_BLIND_SCENARIO as GUIDED,
  advanceTable,
  createTableState,
  deriveTableView,
  type Scenario,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

const play = (
  scenario: Scenario,
  actions: TableAction[],
  from: TableState = createTableState(scenario)
) => actions.reduce((s, a) => advanceTable(scenario, s, a), from);

describe("Card Table render facts (#996)", () => {
  it("mirrors the selection, the open Inspect card and CPU", () => {
    const state = play(GUIDED, [
      { type: "TOGGLE_SELECT", cardId: "C-L16.2.4" },
      { type: "TOGGLE_SELECT", cardId: "C-T14.1.1-G" },
      { type: "INSPECT_CARD", cardId: "C-T14.1.1-G" },
    ]);
    const view = deriveTableView(GUIDED, state);
    expect(view.selected).toEqual(["C-L16.2.4", "C-T14.1.1-G"]);
    expect(view.inspecting).toBe("C-T14.1.1-G");
    expect(view.cpu).toEqual(state.cpu);
    expect(view.cpu.spent).toBeGreaterThan(0);
    // Paying to inspect is acting: the Blind's intro no longer shows.
    expect(view.untouched).toBe(false);
    expect(view.lastEvent?.kind).toBe("INSPECT_OPENED");
    expect(view.handIds).toBe(state.hand);
  });

  it("reports a failed Blind once its CPU runs out", () => {
    let state = createTableState(GUIDED);
    while (state.status === "REVIEWING") {
      state = play(
        GUIDED,
        [
          { type: "TOGGLE_SELECT", cardId: state.hand[0] },
          { type: "PLAY_HAND" },
        ],
        state
      );
    }
    const view = deriveTableView(GUIDED, state);
    expect(view).toMatchObject({
      status: "FAILED",
      outcome: "FAILED",
      handsPlayed: state.handsPlayed,
      roundScore: state.roundScore,
      discards: 0,
    });
    expect(view.roundScore).toBeLessThan(view.quota);
    expect(view.lastPlay).toBe(state.lastPlay);
  });

  it("counts a free or paid discard as acting", () => {
    const state = play(CSR_LOCK_SCENARIO, [
      {
        type: "TOGGLE_SELECT",
        cardId: createTableState(CSR_LOCK_SCENARIO).hand[0],
      },
      { type: "DISCARD" },
    ]);
    const view = deriveTableView(CSR_LOCK_SCENARIO, state);
    expect(view.discards).toBe(1);
    expect(view.untouched).toBe(false);
  });
});
