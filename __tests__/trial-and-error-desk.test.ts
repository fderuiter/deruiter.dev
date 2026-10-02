// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CPU_COSTS,
  DEMOGRAPHICS_SCENARIO,
  advanceDesk,
  canAfford,
  cpuReducer,
  createDeskState,
  deriveDeskView,
  type DeskAction,
  type DeskState,
  type Scenario,
} from "@/lib/trial-and-error";

const scenario = DEMOGRAPHICS_SCENARIO;

function run(
  actions: DeskAction[],
  from = createDeskState(scenario),
  s: Scenario = scenario
): DeskState {
  return actions.reduce((state, action) => advanceDesk(s, state, action), from);
}

/** Inspect and correct every finding on the staged draft. */
function fixAll(state: DeskState): DeskAction[] {
  const view = deriveDeskView(scenario, state);
  const inspect: DeskAction[] = view.cells
    .flat()
    .map((c) => ({ type: "INSPECT_CELL", row: c.row, col: c.col }));
  const revealed = deriveDeskView(scenario, run(inspect, state));
  return [
    ...inspect,
    ...revealed.openFindings.map((f): DeskAction => ({
      type: "CORRECT_FINDING",
      findingId: f.id,
    })),
  ];
}

describe("CPU reducer", () => {
  it("charges 2 CPU to play, 1 to discard or inspect and 2 to recompile", () => {
    expect(CPU_COSTS).toEqual({
      PLAY_HAND: 2,
      DISCARD: 1,
      INSPECT: 1,
      RECOMPILE: 2,
    });
    const ledger = { available: 3, spent: 0 };
    expect(cpuReducer(ledger, { type: "SPEND", action: "PLAY_HAND" })).toEqual({
      available: 1,
      spent: 2,
    });
    expect(cpuReducer(ledger, { type: "SPEND", action: "DISCARD" })).toEqual({
      available: 2,
      spent: 1,
    });
  });

  it("refuses an unaffordable spend by returning the same ledger", () => {
    const ledger = { available: 1, spent: 5 };
    expect(canAfford(ledger, "PLAY_HAND")).toBe(false);
    expect(cpuReducer(ledger, { type: "SPEND", action: "PLAY_HAND" })).toBe(
      ledger
    );
  });
});

describe("QC Desk reducer", () => {
  it("starts reviewing Draft A with the scenario's CPU and quota", () => {
    const view = deriveDeskView(scenario, createDeskState(scenario));
    expect(view.table?.draftLabel).toBe("Draft A (v0.1)");
    expect(view.totalCells).toBe(15);
    expect(view.reviewedCells).toBe(0);
    expect(view.quota).toBe(450);
    expect(view.remainingDraws).toBe(3);
    expect(view.canPlay).toBe(true);
    // Nothing is revealed yet: the known expected value is the clean baseline.
    expect(view.expected?.score).toBe(57 * 2);
  });

  it("reveals findings by inspection and slashes the expected Mult", () => {
    const state = run([{ type: "INSPECT_CELL", row: 2, col: 2 }]);
    expect(state.lastEvent).toMatchObject({
      kind: "INSPECTED",
      message: "Female, n (%), Total: 1 redline. DENOMINATOR (FATAL).",
      sequence: 1,
    });
    const view = deriveDeskView(scenario, state);
    expect(view.cells[2][2].status).toBe("REDLINE");
    expect(view.cells[0][0].status).toBe("UNREVIEWED");
    expect(view.openFindings.map((f) => f.id)).toEqual(["SAP-DM-01@r2c2"]);
    expect(view.expected?.zeroRule.triggered).toBe(true);
    expect(view.expected?.score).toBe(0);

    const precision = deriveDeskView(
      scenario,
      run([{ type: "INSPECT_CELL", row: 2, col: 1 }])
    );
    expect(precision.unpenalizedMult).toBe(2);
    expect(precision.expected?.mult.total).toBe(1);
  });

  it("marks clean cells and does not duplicate repeated inspections", () => {
    const state = run([
      { type: "INSPECT_CELL", row: 0, col: 0 },
      { type: "INSPECT_CELL", row: 0, col: 0 },
    ]);
    expect(state.inspectedCells).toEqual(["0:0"]);
    expect(state.lastEvent?.message).toBe("Subjects, N, Placebo: clean.");
    expect(state.lastEvent?.sequence).toBe(2);
    expect(deriveDeskView(scenario, state).cells[0][0].status).toBe("CLEAN");
  });

  it("refuses out-of-range cells and unrevealed or repeated corrections", () => {
    expect(
      run([{ type: "INSPECT_CELL", row: 9, col: 0 }]).lastEvent?.kind
    ).toBe("REFUSED");
    expect(
      run([{ type: "INSPECT_CELL", row: 0, col: 9 }]).lastEvent?.kind
    ).toBe("REFUSED");
    expect(
      run([{ type: "CORRECT_FINDING", findingId: "SAP-DM-01@r2c2" }]).lastEvent
        ?.kind
    ).toBe("REFUSED");
    expect(
      run([{ type: "CORRECT_FINDING", findingId: "nope" }]).lastEvent?.kind
    ).toBe("REFUSED");
    const twice = run([
      { type: "INSPECT_CELL", row: 2, col: 2 },
      { type: "CORRECT_FINDING", findingId: "SAP-DM-01@r2c2" },
      { type: "CORRECT_FINDING", findingId: "SAP-DM-01@r2c2" },
    ]);
    expect(twice.lastEvent?.kind).toBe("REFUSED");
    expect(twice.resolvedFindingIds).toEqual(["SAP-DM-01@r2c2"]);
  });

  it("shows the corrected value once every finding on a cell is resolved", () => {
    const state = run([
      { type: "INSPECT_CELL", row: 2, col: 1 },
      { type: "CORRECT_FINDING", findingId: "SAP-DM-02@r2c1" },
    ]);
    expect(state.lastEvent?.message).toBe(
      "Corrected 4 (66.67) to 4 (66.7) under SAP-DM-02."
    );
    const cell = deriveDeskView(scenario, state).cells[2][1];
    expect(cell).toMatchObject({
      status: "CORRECTED",
      display: "4 (66.7)",
      observed: "4 (66.67)",
    });
  });

  it("clears the Small Blind by fully correcting Draft A and playing it", () => {
    const start = createDeskState(scenario);
    const state = run([...fixAll(start), { type: "PLAY_HAND" }], start);
    expect(state.status).toBe("CLEARED");
    expect(state.roundScore).toBe(456);
    expect(state.cpu).toEqual({ available: 4, spent: 2 });
    expect(state.lastEvaluation?.score).toBe(456);
    expect(state.lastEvent?.message).toContain(
      "Small Blind: Internal QC cleared."
    );
    const view = deriveDeskView(scenario, state);
    expect(view.table).toBeNull();
    expect(view.canPlay).toBe(false);
    expect(
      run([{ type: "INSPECT_CELL", row: 0, col: 0 }], state).lastEvent?.kind
    ).toBe("REFUSED");
  });

  it("scores the true hand on play, so an undiscovered denominator error still zeroes it", () => {
    const state = run([{ type: "PLAY_HAND" }]);
    expect(state.lastEvaluation?.score).toBe(0);
    expect(state.lastEvent?.message).toContain("Zero-score rule triggered.");
    expect(state.status).toBe("REVIEWING");
    expect(state.drawIndex).toBe(1);
    expect(state.inspectedCells).toEqual([]);
  });

  it("discards for 1 CPU and fails once no playable hand remains", () => {
    const discarded = run([{ type: "DISCARD" }]);
    expect(discarded.cpu.available).toBe(5);
    expect(discarded.discards).toBe(1);
    expect(discarded.lastEvent?.message).toBe(
      "Draft A (v0.1) rejected. Draft B (v0.2) staged."
    );

    const exhausted = run([
      { type: "DISCARD" },
      { type: "DISCARD" },
      { type: "DISCARD" },
    ]);
    expect(exhausted.status).toBe("FAILED");
    expect(exhausted.lastEvent?.message).toContain(
      "failed: no playable hands remain"
    );
    expect(deriveDeskView(scenario, exhausted).remainingDraws).toBe(0);

    const played = run([
      { type: "PLAY_HAND" },
      { type: "PLAY_HAND" },
      { type: "PLAY_HAND" },
    ]);
    expect(played.status).toBe("FAILED");
    expect(played.roundScore).toBe(0 + 57 + 114);
  });

  it("refuses to spend CPU it does not have", () => {
    const poor: Scenario = { ...scenario, startingCpu: 0 };
    const state = run(
      [{ type: "PLAY_HAND" }, { type: "DISCARD" }],
      createDeskState(poor),
      poor
    );
    expect(state.cpu).toEqual({ available: 0, spent: 0 });
    expect(state.lastEvent?.message).toBe("Reject & Discard needs 1 CPU.");
    expect(
      run([{ type: "PLAY_HAND" }], createDeskState(poor), poor).lastEvent
        ?.message
    ).toBe("Approve & Play needs 2 CPU.");
  });

  it("resets to a fresh Blind while keeping announcements monotonic", () => {
    const state = run([{ type: "DISCARD" }, { type: "RESET" }]);
    expect({ ...state, lastEvent: null }).toEqual(createDeskState(scenario));
    expect(state.lastEvent).toMatchObject({ kind: "RESET", sequence: 2 });
  });

  it("replays identically: same scenario and moves, same state", () => {
    const moves: DeskAction[] = [
      { type: "INSPECT_CELL", row: 1, col: 2 },
      { type: "CORRECT_FINDING", findingId: "SAP-DM-03@r1c2" },
      { type: "DISCARD" },
      { type: "INSPECT_CELL", row: 2, col: 0 },
      { type: "PLAY_HAND" },
    ];
    expect(run(moves)).toEqual(run(moves));
    expect(JSON.parse(JSON.stringify(run(moves)))).toEqual(run(moves));
  });
});
