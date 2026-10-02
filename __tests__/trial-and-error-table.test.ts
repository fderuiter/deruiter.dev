// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  ACT_I,
  ACT_I_CRISES,
  DEMOGRAPHICS_SCENARIO,
  DMC_MILESTONE_SCENARIO,
  DMC_RELICS,
  DOSE_ESCALATION_SCENARIO,
  SPONSOR_SAFETY_SCENARIO,
  HAND_NAMES,
  UNBLINDING_RULE_ID,
  advanceRun,
  advanceTable,
  carriedInventory,
  createInspectionState,
  createRunState,
  createTableState,
  deriveTableView,
  evaluateHand,
  ruleResultsFor,
  runBlinds,
  scoreTimeline,
  validate,
  type RunState,
  type Scenario,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

const scenario = DEMOGRAPHICS_SCENARIO;
const run = (
  actions: TableAction[],
  from: TableState = createTableState(scenario),
  s: Scenario = scenario
) => actions.reduce((state, action) => advanceTable(s, state, action), from);
const select = (...ids: string[]): TableAction[] =>
  ids.map((cardId) => ({ type: "TOGGLE_SELECT", cardId }));

const DRAFT_A = "C-T14.1.1-A";
const DM_LISTING = "C-L16.2.4";

/** Inspect Draft A and correct every finding on it. */
function fixDraftA(state: TableState): TableState {
  let next = run([{ type: "INSPECT_CARD", cardId: DRAFT_A }], state);
  const draft = scenario.drawPile[0];
  for (let row = 0; row < draft.rows.length; row++) {
    for (let col = 0; col < draft.columns.length; col++) {
      next = run([{ type: "INSPECT_CELL", row, col }], next);
    }
  }
  for (const finding of deriveTableView(scenario, next).inspection!
    .openFindings) {
    next = run([{ type: "CORRECT_FINDING", findingId: finding.id }], next);
  }
  return next;
}

describe("Card Table reducer", () => {
  it("deals the first 8 cards and starts with the table's CPU", () => {
    const state = createTableState(scenario);
    expect(state.hand).toEqual(scenario.deck.slice(0, 8).map((c) => c.id));
    expect(state.deckIndex).toBe(8);
    expect(state.cpu).toEqual({ available: 10, spent: 0 });
    const view = deriveTableView(scenario, state);
    expect(view).toMatchObject({
      classification: null,
      preview: null,
      deckRemaining: 3,
      handsAffordable: 5,
      discardsAffordable: 10,
      canPlay: false,
      canDiscard: false,
      canInspect: true,
      inspection: null,
    });
    // Only the Demographics drafts carry reviewable cells in the Small Blind.
    expect(view.hand.filter((c) => c.unverified).map((c) => c.card.id)).toEqual(
      [DRAFT_A, "C-T14.1.1-B", "C-T14.1.1-C"]
    );
  });

  it("selects up to five cards, deselects, and announces the detected hand", () => {
    let state = run(select(DRAFT_A, DM_LISTING));
    expect(state.selected).toEqual([DRAFT_A, DM_LISTING]);
    expect(state.lastEvent?.message).toBe(
      "Selected Listing 16.2.4 Demographic Data by Subject. 2 selected: TLF Pair."
    );
    state = run(select(DM_LISTING), state);
    expect(state.selected).toEqual([DRAFT_A]);
    expect(state.lastEvent?.kind).toBe("DESELECTED");
    state = run(select(DRAFT_A), state);
    expect(state.lastEvent?.message).toContain("Nothing selected.");

    const five = run(select(...state.hand.slice(0, 5)), state);
    const sixth = run(select(state.hand[5]), five);
    expect(sixth.selected).toEqual(five.selected);
    expect(sixth.lastEvent).toMatchObject({
      kind: "REFUSED",
      message: "You can select up to 5 cards.",
    });
  });

  it("refuses cards that are not in hand", () => {
    expect(run(select("C-L16.2.8")).lastEvent?.message).toBe(
      "That card is not in your hand."
    );
    expect(run(select("nope")).lastEvent?.kind).toBe("REFUSED");
    expect(
      run([{ type: "INSPECT_CARD", cardId: "C-L16.2.8" }]).lastEvent?.kind
    ).toBe("REFUSED");
  });

  it("previews revealed findings only and flags uninspected cards as unverified", () => {
    const view = deriveTableView(scenario, run(select(DRAFT_A, DM_LISTING)));
    expect(view.classification?.handType).toBe("TLF_PAIR");
    expect(view.previewUnverified).toBe(true);
    // (30 + 30 + 20 + 12) × (2 + 1 + 0): looks clean because nothing is revealed.
    expect(view.preview?.score).toBe(92 * 3);
  });

  it("plays the true hand, so an undiscovered fatal defect still zeroes it", () => {
    const state = run([...select(DRAFT_A, DM_LISTING), { type: "PLAY_HAND" }]);
    expect(state.lastPlay?.evaluation.score).toBe(0);
    expect(state.lastPlay?.evaluation.zeroRule.triggered).toBe(true);
    expect(state.lastEvent?.message).toBe(
      "TLF Pair scored 0 (80 Chips × 0 Mult). Zero-score rule triggered. Round 0 of 450."
    );
    expect(state.cpu).toEqual({ available: 8, spent: 2 });
    expect(state.hand).toHaveLength(8);
    expect(state.hand).not.toContain(DRAFT_A);
    expect(state.hand.slice(-2)).toEqual(["C-T14.1.3", "C-T14.3.2"]);
  });

  it("matches evaluateHand exactly for preview and play", () => {
    const inspected = fixDraftA(createTableState(scenario));
    const state = run(select(DRAFT_A, DM_LISTING), inspected);
    const report = validate(
      scenario.drawPile[0],
      scenario.populationSnapshot,
      scenario.rulebook
    );
    const expected = evaluateHand({
      handType: "TLF_PAIR",
      cards: [
        { id: DRAFT_A, chips: 30, mult: 1 },
        { id: DM_LISTING, chips: 20, mult: 0 },
      ],
      ruleResults: ruleResultsFor(report, scenario.rulebook, {
        resolvedFindingIds: state.inspections[DRAFT_A].resolvedFindingIds,
      }),
    });
    expect(deriveTableView(scenario, state).preview).toEqual(expected);
    const played = run([{ type: "PLAY_HAND" }], state);
    expect(played.lastPlay?.evaluation).toEqual(expected);
    // (30 + 30 + 20 + 12) × (2 + 1 + 6 corrections) = 828 clears 450.
    expect(played.roundScore).toBe(828);
    expect(played.status).toBe("CLEARED");
    expect(played.lastEvent?.message).toContain(
      "Small Blind: Internal QC cleared."
    );
  });

  it("charges 1 CPU to open Inspect once, then reopens it for free", () => {
    let state = run([{ type: "INSPECT_CARD", cardId: DRAFT_A }]);
    expect(state.cpu.available).toBe(9);
    expect(state.inspecting).toBe(DRAFT_A);
    expect(state.lastEvent?.message).toBe(
      "Inspecting Table 14.1.1 Demographics (Draft A) for 1 CPU."
    );
    state = run(
      [{ type: "INSPECT_CELL", row: 2, col: 2 }, { type: "CLOSE_INSPECT" }],
      state
    );
    expect(state.inspecting).toBeNull();
    expect(state.lastEvent?.kind).toBe("INSPECT_CLOSED");
    expect(run([{ type: "CLOSE_INSPECT" }], state)).toBe(state);
    state = run([{ type: "INSPECT_CARD", cardId: DRAFT_A }], state);
    expect(state.cpu.available).toBe(9);
    // Corrections persist on the card between openings.
    expect(state.inspections[DRAFT_A].inspectedCells).toEqual(["2:2"]);
    const view = deriveTableView(scenario, state);
    expect(view.inspection?.card.id).toBe(DRAFT_A);
    expect(view.inspection?.expected.zeroRule.triggered).toBe(true);
    expect(view.hand.find((c) => c.card.id === DRAFT_A)).toMatchObject({
      inspected: true,
      unverified: false,
      openRedlines: 1,
    });
  });

  it("refuses to inspect cards without reviewable cells, without charging CPU", () => {
    const state = run([{ type: "INSPECT_CARD", cardId: "C-T14.1.2" }]);
    expect(state.cpu.available).toBe(10);
    expect(state.lastEvent?.message).toBe(
      "Table 14.1.2 Subject Disposition has no reviewable cells in this slice."
    );
  });

  it("routes cell review to the open card and refuses it when nothing is open", () => {
    expect(
      run([{ type: "INSPECT_CELL", row: 0, col: 0 }]).lastEvent?.message
    ).toBe("Open a card's Inspect view first.");
    const open = run([{ type: "INSPECT_CARD", cardId: DRAFT_A }]);
    expect(
      run([{ type: "INSPECT_CELL", row: 9, col: 0 }], open).lastEvent?.kind
    ).toBe("REFUSED");
    expect(
      run([{ type: "CORRECT_FINDING", findingId: "SAP-DM-01@r2c2" }], open)
        .lastEvent?.kind
    ).toBe("REFUSED");
    const reviewed = run(
      [
        { type: "INSPECT_CELL", row: 2, col: 2 },
        { type: "CORRECT_FINDING", findingId: "SAP-DM-01@r2c2" },
      ],
      open
    );
    expect(reviewed.lastEvent).toMatchObject({
      kind: "CORRECTED",
      message: "Corrected 7 (63.6) to 7 (58.3) under SAP-DM-01.",
    });
  });

  it("discards 1 to 5 selected cards for 1 CPU and refills the hand", () => {
    expect(run([{ type: "DISCARD" }]).lastEvent?.message).toBe(
      "Select at least one card to discard."
    );
    expect(run([{ type: "PLAY_HAND" }]).lastEvent?.message).toBe(
      "Select at least one card to play."
    );
    const state = run([...select(DRAFT_A, "C-T14.1.2"), { type: "DISCARD" }]);
    expect(state.cpu.available).toBe(9);
    expect(state.discards).toBe(1);
    expect(state.hand).toHaveLength(8);
    expect(state.selected).toEqual([]);
    expect(state.lastEvent?.message).toBe("Discarded 2 cards.");
    expect(
      run([...select(DM_LISTING), { type: "DISCARD" }]).lastEvent?.message
    ).toBe("Discarded 1 card.");
  });

  it("drops a discarded card's inspection", () => {
    const state = run([
      { type: "INSPECT_CARD", cardId: DRAFT_A },
      { type: "CLOSE_INSPECT" },
      ...select(DRAFT_A),
      { type: "DISCARD" },
    ]);
    expect(state.inspections).toEqual({});
  });

  it("refuses unaffordable actions and leaves state unchanged", () => {
    const poor: Scenario = {
      ...scenario,
      table: { ...scenario.table, startingCpu: 1 },
    };
    const start = run(select(DRAFT_A), createTableState(poor), poor);
    const played = run([{ type: "PLAY_HAND" }], start, poor);
    expect(played.lastEvent?.message).toBe("Play Hand needs 2 CPU; 1 left.");
    expect({ ...played, lastEvent: null }).toEqual({
      ...start,
      lastEvent: null,
    });

    const broke: Scenario = {
      ...scenario,
      table: { ...scenario.table, startingCpu: 0 },
    };
    const none = run(select(DRAFT_A), createTableState(broke), broke);
    expect(run([{ type: "DISCARD" }], none, broke).lastEvent?.message).toBe(
      "Discard needs 1 CPU."
    );
    expect(
      run([{ type: "INSPECT_CARD", cardId: DRAFT_A }], none, broke).lastEvent
        ?.message
    ).toBe("Inspect needs 1 CPU.");
    expect(deriveTableView(broke, none)).toMatchObject({
      canPlay: false,
      canDiscard: false,
      canInspect: false,
    });
  });

  it("fails the Blind once no hand can be played", () => {
    const tight: Scenario = {
      ...scenario,
      table: { ...scenario.table, startingCpu: 3 },
    };
    const state = run(
      [
        ...select("C-L16.1.1"),
        { type: "DISCARD" },
        ...select("C-L16.2.7"),
        { type: "DISCARD" },
      ],
      createTableState(tight),
      tight
    );
    expect(state.status).toBe("FAILED");
    expect(state.lastEvent?.message).toContain(
      "failed: no playable hands remain"
    );
    expect(run(select(DRAFT_A), state, tight).lastEvent?.message).toBe(
      "The Blind is over. Restart to play again."
    );
    expect(deriveTableView(tight, state).canInspect).toBe(false);
  });

  it("fails when the hand runs out of cards", () => {
    const thin: Scenario = {
      ...scenario,
      deck: scenario.deck.slice(0, 2),
      table: { ...scenario.table, handSize: 2 },
    };
    const state = run(
      [...select(DRAFT_A, DM_LISTING), { type: "DISCARD" }],
      createTableState(thin),
      thin
    );
    expect(state.hand).toEqual([]);
    expect(state.status).toBe("FAILED");
  });

  it("resets to a fresh deal with monotonic announcements", () => {
    const state = run([
      ...select(DRAFT_A),
      { type: "DISCARD" },
      { type: "RESET" },
    ]);
    expect({ ...state, lastEvent: null }).toEqual(createTableState(scenario));
    expect(state.lastEvent).toMatchObject({ kind: "RESET", sequence: 3 });
  });

  it("exposes a fresh inspection state for adapters", () => {
    expect(createInspectionState()).toEqual({
      inspectedCells: [],
      resolvedFindingIds: [],
    });
  });
});

describe("play blocker (#1078)", () => {
  /**
   * The view's blocker and the reducer's refusal for the same state: the
   * line names exactly what Play Hand refuses with, or Play Hand succeeds.
   */
  function parity(s: Scenario, state: TableState) {
    const view = deriveTableView(s, state);
    const played = advanceTable(s, state, { type: "PLAY_HAND" });
    if (view.playBlocker) {
      expect(played.lastEvent?.kind).toBe("REFUSED");
      expect(played.lastEvent?.message).toBe(view.playBlocker.reason);
      expect(view.canPlay).toBe(false);
    } else {
      expect(played.lastEvent?.kind).not.toBe("REFUSED");
      expect(view.canPlay).toBe(true);
    }
    return view.playBlocker;
  }

  it("asks for a selection, then clears once a card is selected", () => {
    expect(parity(scenario, createTableState(scenario))).toEqual({
      reason: "Select at least one card to play.",
      fix: "Select a card",
      key: "Space",
    });
    expect(parity(scenario, run(select(DM_LISTING)))).toBeNull();
  });

  it("names a CPU shortfall with what is left", () => {
    const poor: Scenario = {
      ...scenario,
      table: { ...scenario.table, startingCpu: 1 },
    };
    const start = run(select(DRAFT_A), createTableState(poor), poor);
    expect(parity(poor, start)).toEqual({
      reason: "Play Hand needs 2 CPU; 1 left.",
      fix: null,
      key: null,
    });
  });

  it("puts a pending crisis ahead of everything else", () => {
    const [crisis] = ACT_I_CRISES;
    const state = createTableState(scenario, undefined, undefined, crisis);
    expect(parity(scenario, state)).toMatchObject({
      reason: `${crisis.name}: answer the crisis first.`,
      fix: "Answer it in the crisis panel",
    });
  });

  it("says a decided Blind cannot be played", () => {
    const over = { ...createTableState(scenario), status: "FAILED" as const };
    expect(parity(scenario, over)?.reason).toBe(
      "The Blind is over. Restart to play again."
    );
  });

  it("names the stage refusals of a staged Boss with their fixes", () => {
    const dmc = DMC_MILESTONE_SCENARIO;
    const at = (actions: TableAction[], from = createTableState(dmc)) =>
      actions.reduce((state, action) => advanceTable(dmc, state, action), from);
    const closedInOpen = at(select("C-T14.3.3-D", "C-L16.2.8"));
    expect(parity(dmc, closedInOpen)).toMatchObject({
      reason: expect.stringMatching(
        /^Closed-session outputs cannot be presented in the open session/
      ),
      fix: "Deselect Table 14.3.3",
      key: "Space",
    });
    const defended = at([
      ...select("C-T14.1.1", "C-L16.2.4"),
      { type: "PLAY_HAND" },
      ...select("C-T14.1.2", "C-L16.1.1"),
      { type: "PLAY_HAND" },
    ]);
    expect(
      parity(dmc, at(select("C-T14.3.3-D", "C-L16.2.8"), defended))
    ).toMatchObject({ fix: "Convene the closed session", key: null });
    const closed = at(
      [
        ...["C-T14.3.1-D", "C-T14.3.3-D", "C-T14.3.2.5-D"].map(
          (cardId): TableAction => ({ type: "STRUCTURAL_QC", cardId })
        ),
        { type: "SET_SESSION", session: "CLOSED" },
        ...select("C-T14.3.3-D", "C-L16.2.8"),
      ],
      defended
    );
    expect(parity(dmc, closed)).toEqual({
      reason:
        "Stage 2: Closed report accepts Efficacy Full House; this is TLF Pair.",
      fix: "Select an Efficacy Full House",
      key: null,
    });
  });

  it("matches PLAY_HAND's refusal in every state random play reaches", () => {
    const scenarios = [
      DEMOGRAPHICS_SCENARIO,
      SPONSOR_SAFETY_SCENARIO,
      DOSE_ESCALATION_SCENARIO,
      DMC_MILESTONE_SCENARIO,
    ];
    /** Every action worth trying from `state`, so each draw is meaningful. */
    const candidates = (s: Scenario, state: TableState): TableAction[] => [
      ...state.hand.map((cardId): TableAction => ({
        type: "TOGGLE_SELECT",
        cardId,
      })),
      ...state.hand.map((cardId): TableAction => ({
        type: "RECOMPILE",
        cardId,
      })),
      ...state.hand.map((cardId): TableAction => ({
        type: "STRUCTURAL_QC",
        cardId,
      })),
      ...state.hand.map((cardId): TableAction => ({
        type: "ALLOCATE",
        cardId,
        population: "SAFETY",
      })),
      { type: "PLAY_HAND" },
      { type: "DISCARD" },
      { type: "SET_SESSION", session: "CLOSED" },
      ...(state.crisis
        ? state.crisis.choices.map((c): TableAction => ({
            type: "RESOLVE_CRISIS",
            choiceId: c.id,
          }))
        : []),
    ];
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: scenarios.length - 1 }),
        fc.boolean(),
        fc.array(fc.nat(), { maxLength: 14 }),
        (which, withCrisis, picks) => {
          const s = scenarios[which];
          let state = createTableState(
            s,
            undefined,
            undefined,
            withCrisis ? ACT_I_CRISES[which % ACT_I_CRISES.length] : null
          );
          parity(s, state);
          for (const pick of picks) {
            const options = candidates(s, state);
            state = advanceTable(s, state, options[pick % options.length]);
            parity(s, state);
          }
        }
      ),
      { numRuns: 60 }
    );
  });
});

describe("score log (#1082)", () => {
  const PAIR: TableAction[] = [
    ...select(DRAFT_A, DM_LISTING),
    { type: "PLAY_HAND" },
  ];

  it("appends each hand played and totals the round score", () => {
    const fresh = createTableState(scenario);
    expect(fresh.plays).toEqual([]);
    expect(deriveTableView(scenario, fresh).scoreLog).toEqual([]);

    // Played unfixed, Draft A's fatal finding zeroes the pair.
    const once = run(PAIR);
    const twice = run([...select("C-T14.1.2"), { type: "PLAY_HAND" }], once);
    expect(twice.handsPlayed).toBe(2);
    expect(twice.plays).toHaveLength(2);
    expect(twice.plays[0]).toEqual(once.lastPlay);
    expect(twice.plays[1]).toBe(twice.lastPlay);

    const log = deriveTableView(scenario, twice).scoreLog;
    expect(log).toMatchObject([
      {
        handType: "TLF_PAIR",
        name: HAND_NAMES.TLF_PAIR,
        chips: once.lastPlay!.evaluation.chips.total,
        mult: 0,
        score: 0,
        zeroLabel: "DENOMINATOR ERROR",
      },
      {
        handType: "HIGH_TABLE",
        name: HAND_NAMES.HIGH_TABLE,
        chips: 40,
        mult: 2,
        score: 80,
        zeroLabel: null,
      },
    ]);
    expect(log.reduce((sum, e) => sum + e.score, 0)).toBe(twice.roundScore);

    // Corrected first, the same pair scores and fires no zero rule.
    const [clean] = deriveTableView(
      scenario,
      run(PAIR, fixDraftA(fresh))
    ).scoreLog;
    expect(clean.score).toBeGreaterThan(0);
    expect(clean.zeroLabel).toBeNull();
  });

  it("leaves refused plays and other moves out of the log", () => {
    const refused = run([{ type: "PLAY_HAND" }]);
    expect(refused.plays).toEqual([]);
    const discarded = run([...select(DRAFT_A), { type: "DISCARD" }]);
    expect(discarded.plays).toEqual([]);
  });

  it("shows a hand played after a peek as zeroed by the unblinding", () => {
    const dmc = DMC_MILESTONE_SCENARIO;
    const peeked = run(
      [{ type: "PEEK_BLINDED", cardId: "C-T14.3.3-D" }],
      createTableState(dmc),
      dmc
    );
    const played = run(
      [...select("C-T14.1.1", "C-L16.2.4"), { type: "PLAY_HAND" }],
      peeked,
      dmc
    );
    expect(played.lastPlay?.evaluation.zeroRule.ruleIds).toContain(
      UNBLINDING_RULE_ID
    );
    const [entry] = deriveTableView(dmc, played).scoreLog;
    expect(entry.score).toBe(0);
    expect(entry.zeroLabel).toBe("UNBLINDING");
    expect(entry.fired).toContainEqual({
      kind: "ZERO_RULE",
      label: "UNBLINDING",
      effect: "×0",
    });
    // Labels and effects only: rule evidence, which can quote a closed
    // session's cells, never reaches the log.
    for (const effect of entry.fired) {
      expect(Object.keys(effect).sort()).toEqual(["effect", "kind", "label"]);
    }
  });

  it("empties on RESET and when the next Blind starts", () => {
    expect(run([...PAIR, { type: "RESET" }]).plays).toEqual([]);

    const act = { ...ACT_I, crisisDeck: undefined };
    let runState: RunState = createRunState(act, "fold-change");
    const blind = runBlinds(act, runState)[0];
    for (const action of playBlind(blind, runState.table, "MEDIAN").actions) {
      if (runState.table.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      runState = advanceRun(act, runState, action);
    }
    expect(runState.table.status).toBe("CLEARED");
    expect(runState.table.plays.length).toBeGreaterThan(0);
    const next = advanceRun(act, runState, { type: "NEXT_BLIND" });
    expect(next.blindIndex).toBe(1);
    expect(next.table.plays).toEqual([]);
    expect(
      deriveTableView(runBlinds(act, next)[1], next.table).scoreLog
    ).toEqual([]);
  });

  it("agrees with each hand's score timeline in every state random play reaches", () => {
    const scenarios = [
      DEMOGRAPHICS_SCENARIO,
      SPONSOR_SAFETY_SCENARIO,
      DOSE_ESCALATION_SCENARIO,
      DMC_MILESTONE_SCENARIO,
    ];
    const candidates = (s: Scenario, state: TableState): TableAction[] => [
      ...state.hand.map((cardId): TableAction => ({
        type: "TOGGLE_SELECT",
        cardId,
      })),
      ...state.hand.map((cardId): TableAction => ({
        type: "PEEK_BLINDED",
        cardId,
      })),
      { type: "PLAY_HAND" },
      { type: "PLAY_HAND" },
      { type: "DISCARD" },
      { type: "SET_SESSION", session: "CLOSED" },
      { type: "SET_SESSION", session: "OPEN" },
      ...(state.crisis
        ? state.crisis.choices.map((c): TableAction => ({
            type: "RESOLVE_CRISIS",
            choiceId: c.id,
          }))
        : []),
    ];
    const check = (s: Scenario, state: TableState) => {
      const view = deriveTableView(s, state);
      expect(view.scoreLog).toHaveLength(state.handsPlayed);
      expect(view.scoreLog.reduce((sum, e) => sum + e.score, 0)).toBe(
        state.roundScore
      );
      let before = 0;
      state.plays.forEach((play, i) => {
        const steps = scoreTimeline(play.evaluation, {
          roundScoreBefore: before,
          target: s.blind.quota,
        });
        before += play.evaluation.score;
        const entry = view.scoreLog[i];
        const total = steps.find((step) => step.kind === "TOTAL")!;
        expect(total).toMatchObject({
          chips: entry.chips,
          mult: entry.mult,
          score: entry.score,
        });
        const fired = steps.flatMap((step) =>
          step.kind === "RULE"
            ? [["RULE", step.ruleId]]
            : step.kind === "RELIC"
              ? [["RELIC", step.relicId]]
              : step.kind === "X_MULT"
                ? [["X_MULT", step.source]]
                : step.kind === "ZERO_RULE"
                  ? [["ZERO_RULE"]]
                  : []
        );
        expect(
          entry.fired.map((e) =>
            e.kind === "ZERO_RULE" ? [e.kind] : [e.kind, e.label]
          )
        ).toEqual(fired);
        expect(entry.zeroLabel !== null).toBe(
          play.evaluation.zeroRule.triggered
        );
      });
      // The playback's timeline is the log's newest entry.
      if (state.lastPlay) {
        const last = view.scoreLog.at(-1)!;
        const kinds = view
          .lastTimeline!.filter((step) =>
            ["RULE", "RELIC", "X_MULT", "ZERO_RULE"].includes(step.kind)
          )
          .map((step) => step.kind);
        expect(last.fired.map((e) => e.kind)).toEqual(kinds);
      }
    };
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: scenarios.length - 1 }),
        fc.boolean(),
        fc.subarray([...DMC_RELICS]),
        fc.array(fc.nat(), { maxLength: 16 }),
        (which, withCrisis, relics, picks) => {
          const s = scenarios[which];
          const crisis = withCrisis
            ? ACT_I_CRISES[which % ACT_I_CRISES.length]
            : null;
          const plain = createTableState(s, undefined, undefined, crisis);
          let state = createTableState(
            s,
            undefined,
            { ...carriedInventory(plain), relics },
            crisis
          );
          for (const pick of picks) {
            const options = candidates(s, state);
            state = advanceTable(s, state, options[pick % options.length]);
          }
          check(s, state);
        }
      ),
      { numRuns: 60 }
    );
  });
});
