import { describe, it, expect } from "vitest";
import {
  ACT_I,
  CLINICAL_HOLD,
  DEMOGRAPHICS_SCENARIO,
  DMC_MILESTONE_SCENARIO,
  DOSE_ESCALATION_SCENARIO,
  FDA_IR_SCENARIO,
  SCENARIOS,
  ScenarioSchema,
  advanceRun,
  advanceTable,
  createRunState,
  createTableState,
  deriveRunView,
  deriveTableView,
  type Act,
  type FdaIr,
  type RunAction,
  type RunState,
  type Scenario,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

const IR = FDA_IR_SCENARIO;
const SAE_TABLE = "C-T14.3.3-E";
const KM_DISCONTINUATION = "C-F14.3.1";
const OVERVIEW = "C-T14.3.1-E";
const AE_LISTING = "C-L16.2.7";

const run = (
  actions: readonly TableAction[],
  scenario: Scenario = IR,
  from: TableState = createTableState(scenario)
) =>
  actions.reduce(
    (state, action) => advanceTable(scenario, state, action),
    from
  );
const view = (state: TableState, scenario: Scenario = IR) =>
  deriveTableView(scenario, state);
const select = (...ids: string[]): TableAction[] =>
  ids.map((cardId) => ({ type: "TOGGLE_SELECT", cardId }));
const discardFirst = (state: TableState): TableAction[] => [
  ...select(state.hand[0]),
  { type: "DISCARD" },
];

/** The IR with its encounter changed, for edge cases; not parsed. */
const withIr = (patch: Partial<FdaIr>, scenario: Scenario = IR): Scenario => ({
  ...scenario,
  encounter: { ...IR.encounter, ...patch },
});
/** The IR with a bigger CPU budget, so only the clock can end it. */
const ROOMY: Scenario = { ...IR, table: { ...IR.table, startingCpu: 40 } };

/** Discards one card at a time, n times. */
function discardTimes(n: number, scenario: Scenario = ROOMY): TableState {
  let state = createTableState(scenario);
  for (let i = 0; i < n; i++) state = run(discardFirst(state), scenario, state);
  return state;
}

describe("FDA Information Request schema (#921)", () => {
  it("parses the IR, and the DMC defense parses unchanged", () => {
    expect(ScenarioSchema.safeParse(IR).success).toBe(true);
    expect(ScenarioSchema.safeParse(DMC_MILESTONE_SCENARIO).success).toBe(true);
    expect(SCENARIOS[IR.id]).toBe(IR);
  });

  it.each<[string, Scenario, string]>([
    [
      "question quotas that miss the Blind's quota",
      withIr({
        questions: [{ ...IR.encounter.questions[0], quota: 1 }],
      }),
      "The questions' quotas must add up to the Blind's quota",
    ],
    [
      "a question naming a card outside the deck",
      withIr({
        questions: [
          { ...IR.encounter.questions[0], cardId: "C-NOPE" },
          IR.encounter.questions[1],
        ],
      }),
      "Each question must name a card in the deck",
    ],
    [
      "duplicate question ids",
      withIr({
        questions: [
          IR.encounter.questions[0],
          { ...IR.encounter.questions[1], id: "IR-Q1" },
        ],
      }),
      "Question ids must be unique",
    ],
    [
      "a clock too short to play a hand",
      withIr({ clockHours: 6 }),
      "The clock must leave time to play a hand",
    ],
    [
      "a boss other than a hand limit",
      { ...IR, boss: DOSE_ESCALATION_SCENARIO.boss },
      "An FDA Information Request needs a HAND_LIMIT Boss",
    ],
  ])("rejects %s", (_, scenario, message) => {
    const parsed = ScenarioSchema.safeParse(scenario);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((i) => i.message)).toContain(message);
  });

  it("rejects an encounter kind it does not know", () => {
    const parsed = ScenarioSchema.safeParse({
      ...IR,
      encounter: { ...IR.encounter, kind: "CSR_LOCK" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("FDA Information Request clock (#921)", () => {
  it("opens with 48 hours, two open questions and a two-hand limit", () => {
    const fresh = createTableState(IR);
    expect(fresh.clock).toBe(48);
    expect(fresh.answered).toEqual([]);
    const v = view(fresh);
    expect(v.clock).toEqual({
      hoursLeft: 48,
      totalHours: 48,
      costs: { PLAY_HAND: 12, DISCARD: 4, INSPECT: 2, TRACE: 1 },
      urgent: false,
      hold: false,
    });
    expect(v.questions.map((q) => [q.cardNumber, q.answered])).toEqual([
      ["Table 14.3.3", false],
      ["Figure 14.3.1", false],
    ]);
    expect(v.handsLeft).toBe(2);
    expect(v.stageAccepts).toEqual([
      "TLF_PAIR",
      "POPULATION_FLUSH",
      "EFFICACY_FULL_HOUSE",
    ]);
    expect(v.encounter).toBeNull();
    expect(v.bossIntro).toMatchObject({
      bossName: "Two-Hand Response",
      dueHours: 48,
      questions: IR.encounter.questions.map((q) => q.question),
      stages: [],
    });
  });

  it("has no clock outside an FDA Information Request", () => {
    for (const scenario of [DEMOGRAPHICS_SCENARIO, DMC_MILESTONE_SCENARIO]) {
      const state = createTableState(scenario);
      expect(state.clock).toBeNull();
      expect(view(state, scenario).clock).toBeNull();
      expect(view(state, scenario).questions).toEqual([]);
      expect(view(state, scenario).bossIntro?.dueHours ?? null).toBeNull();
    }
  });

  it("takes 4 hours and 1 CPU for a discard, and says what is left", () => {
    const fresh = createTableState(IR);
    const after = run(discardFirst(fresh));
    expect(after.clock).toBe(44);
    expect(after.cpu.available).toBe(9);
    expect(after.lastEvent?.message).toBe("Discarded 1 card. 44 hours left.");
  });

  it("takes 2 hours to inspect, and nothing to reopen an inspected card", () => {
    const opened = run([{ type: "INSPECT_CARD", cardId: OVERVIEW }]);
    expect(opened.clock).toBe(46);
    expect(opened.lastEvent?.message).toContain(
      "for 1 CPU and 2 hours (46 left)"
    );
    const reopened = run(
      [{ type: "CLOSE_INSPECT" }, { type: "INSPECT_CARD", cardId: OVERVIEW }],
      IR,
      opened
    );
    expect(reopened.clock).toBe(46);
  });

  it("takes 1 hour for a new trace and none to re-read one", () => {
    const flagged = run([
      { type: "INSPECT_CARD", cardId: OVERVIEW },
      { type: "INSPECT_CELL", row: 1, col: 1 },
    ]);
    const traced = run([{ type: "TRACE_CELL", row: 1, col: 1 }], IR, flagged);
    expect(traced.lastEvent?.kind).toBe("TRACED");
    expect(traced.clock).toBe((flagged.clock as number) - 1);
    expect(traced.lastEvent?.message).toContain("Took 1 hour (45 left).");
    const again = run([{ type: "TRACE_CELL", row: 1, col: 1 }], IR, traced);
    expect(again.clock).toBe(traced.clock);
  });

  it("refuses a move the clock cannot pay for, and says so", () => {
    const short = { ...createTableState(IR), clock: 3 };
    const discard = run(discardFirst(short), IR, short);
    expect(discard.lastEvent?.message).toBe(
      "Discard takes 4 hours; 3 hours left before the response is due."
    );
    expect(discard.clock).toBe(3);
    expect(view(short).canDiscard).toBe(false);

    const tight = { ...createTableState(IR), clock: 1 };
    const inspect = run(
      [{ type: "INSPECT_CARD", cardId: OVERVIEW }],
      IR,
      tight
    );
    expect(inspect.lastEvent?.message).toBe(
      "Inspect takes 2 hours; 1 hour left before the response is due."
    );
    expect(view(tight).canInspect).toBe(false);

    const late = run(select(SAE_TABLE, "C-L16.2.8"), IR, {
      ...createTableState(IR),
      clock: 11,
    });
    expect(view(late).playBlocker?.reason).toBe(
      "Play Hand takes 12 hours; 11 hours left before the response is due."
    );
  });

  it("accepts only a TLF Pair, Population Flush or Efficacy Full House", () => {
    const one = run(select(SAE_TABLE));
    expect(view(one).playBlocker?.reason).toBe(
      "The FDA accepts TLF Pair, Population Flush, Efficacy Full House; this is High Table."
    );
    const refused = run([{ type: "PLAY_HAND" }], IR, one);
    expect(refused.lastEvent?.kind).toBe("REFUSED");
    expect(refused.clock).toBe(48);
  });
});

describe("FDA Information Request questions (#921)", () => {
  it("clears once a reviewed Population Flush answers both questions", () => {
    const { state, actions } = playBlind(IR, createTableState(IR), "MEDIAN");
    expect(state.status).toBe("CLEARED");
    expect(state.answered).toEqual(["IR-Q1", "IR-Q2"]);
    expect(state.handsPlayed).toBe(1);
    expect(state.lastPlay?.classification.scoringCardIds).toEqual(
      expect.arrayContaining([SAE_TABLE, KM_DISCONTINUATION])
    );
    expect(state.clock).toBe(26);
    expect(state.lastEvent?.message).toContain(
      "Answered: Serious adverse events by preferred term and arm; Time to an adverse event leading to discontinuation, by arm (Kaplan-Meier)."
    );
    expect(state.lastEvent?.message).toContain(
      "Boss Blind: FDA Information Request answered with 26 hours to spare."
    );
    expect(view(state).questions.every((q) => q.answered)).toBe(true);
    expect(view(state).reward).toBeNull();
    // The same moves from the same start give the same response and clock.
    expect(run(actions)).toEqual(state);
  });

  it("answers in the request's order while the score covers each share", () => {
    const { actions } = playBlind(IR, createTableState(IR), "MEDIAN");
    const steep = withIr({
      questions: [
        { ...IR.encounter.questions[0], quota: 100 },
        { ...IR.encounter.questions[1], quota: 1_000_000 },
      ],
    });
    const state = run(actions, steep);
    expect(state.answered).toEqual(["IR-Q1"]);
    expect(state.status).toBe("REVIEWING");
    expect(view(state, steep).handsLeft).toBe(1);
  });

  it("leaves a question open when its card does not score in the hand", () => {
    const easy = withIr({
      questions: IR.encounter.questions.map((q) => ({ ...q, quota: 1 })),
    });
    const state = run(
      [...select(OVERVIEW, AE_LISTING), { type: "PLAY_HAND" }],
      easy
    );
    expect(state.lastPlay?.classification.handType).toBe("TLF_PAIR");
    expect(state.lastPlay?.evaluation.score).toBeGreaterThan(0);
    expect(state.answered).toEqual([]);
    expect(state.clock).toBe(36);
  });

  it("fails on the hand limit when two hands leave questions open", () => {
    const { state } = playBlind(IR, createTableState(IR), "HASTY");
    expect(state.status).toBe("FAILED");
    expect(state.handsPlayed).toBe(2);
    expect(state.lastEvent?.message).toContain("the 2-hand limit is used up");
    expect(view(state).clock?.hold).toBe(false);
  });

  it("never answers a question twice", () => {
    const easy = withIr({
      questions: [
        { ...IR.encounter.questions[0], quota: 1 },
        { ...IR.encounter.questions[1], quota: 1_000_000 },
      ],
    });
    const { actions } = playBlind(IR, createTableState(IR), "MEDIAN");
    const once = run(actions, easy);
    expect(once.answered).toEqual(["IR-Q1"]);
  });
});

describe("Clinical Hold (#921)", () => {
  it("warns once the clock leaves time for one last hand", () => {
    const state = discardTimes(9);
    expect(state.clock).toBe(12);
    expect(state.status).toBe("REVIEWING");
    expect(state.lastEvent?.message).toBe(
      "Discarded 1 card. 12 hours left. 12 hours left: the response is due soon."
    );
    expect(view(state, ROOMY).clock).toMatchObject({
      urgent: true,
      hold: false,
    });
    // The warning is given once, not on every later move.
    const next = run(
      [{ type: "INSPECT_CARD", cardId: state.hand[0] }],
      ROOMY,
      state
    );
    expect(next.lastEvent?.message).not.toContain("due soon");
  });

  it("is a Clinical Hold when the clock runs out with questions open", () => {
    const state = discardTimes(10);
    expect(state.clock).toBe(8);
    expect(state.status).toBe("FAILED");
    expect(state.lastEvent?.message).toContain(
      `${CLINICAL_HOLD}: the 48-hour response window closed with 2 of 2 questions unanswered. The program cannot proceed to Phase III.`
    );
    expect(view(state, ROOMY).clock).toMatchObject({ hold: true });
  });

  it("is a Clinical Hold when an inspection spends the last playable hours", () => {
    const state = run([{ type: "INSPECT_CARD", cardId: OVERVIEW }], IR, {
      ...createTableState(IR),
      clock: 13,
    });
    expect(state.clock).toBe(11);
    expect(state.status).toBe("FAILED");
    expect(state.lastEvent?.message).toContain(CLINICAL_HOLD);
  });

  it("is a Clinical Hold when a trace spends them", () => {
    const flagged = run([
      { type: "INSPECT_CARD", cardId: OVERVIEW },
      { type: "INSPECT_CELL", row: 1, col: 1 },
    ]);
    const traced = run([{ type: "TRACE_CELL", row: 1, col: 1 }], IR, {
      ...flagged,
      clock: 12,
    });
    expect(traced.status).toBe("FAILED");
    expect(traced.lastEvent?.message).toContain(CLINICAL_HOLD);
  });

  it("ends the run: a held Boss is a lost run, not a Blind retry", () => {
    const act = irAct(ROOMY);
    let state: RunState = runToBoss(act, SEED);
    expect(deriveRunView(act, state).blind.id).toBe(IR.id);
    for (let i = 0; i < 10; i++) {
      for (const action of discardFirst(state.table)) {
        state = advanceRun(act, state, inRun(action));
      }
    }
    expect(state.table.status).toBe("FAILED");
    expect(deriveRunView(act, state).phase).toBe("RUN_FAILED");
    const retry = advanceRun(act, state, { type: "NEXT_BLIND" });
    expect(retry.table.status).toBe("FAILED");
  });
});

/** A table action as a run takes it: a run never resets a table. */
function inRun(action: TableAction): RunAction {
  if (action.type === "RESET") throw new Error("A run has no RESET.");
  return action;
}

/** Act I with a one-point Small Blind, no Big Blind and no crises. */
function irAct(boss: Scenario): Act {
  return {
    ...ACT_I,
    blinds: [
      {
        ...DEMOGRAPHICS_SCENARIO,
        blind: { ...DEMOGRAPHICS_SCENARIO.blind, quota: 1 },
      },
    ],
    bossPool: [DOSE_ESCALATION_SCENARIO, boss],
    crisisDeck: [],
  };
}

/** The first seed whose boss draw is the IR. */
const SEED = Array.from({ length: 50 }, (_, i) => `ir-${i}`).find(
  (seed) => createRunState(irAct(ROOMY), seed).bossIds[0] === IR.id
) as string;

/** Clears the one-point Small Blind and deals the Boss. */
function runToBoss(act: Act, seed: string): RunState {
  let state = createRunState(act, seed);
  for (const action of [...select("C-T14.1.1-C"), { type: "PLAY_HAND" }]) {
    state = advanceRun(act, state, inRun(action as TableAction));
  }
  return advanceRun(act, state, { type: "NEXT_BLIND" });
}

describe("FDA Information Request in a run (#921)", () => {
  it("is drawn only by the run's seeded boss draw, the same way every time", () => {
    const act = irAct(IR);
    expect(SEED).toBeDefined();
    const first = runToBoss(act, SEED);
    const second = runToBoss(act, SEED);
    expect(first).toEqual(second);
    expect(first.draws.filter((d) => d.kind === "BOSS")).toEqual([
      { drawIndex: 0, kind: "BOSS", id: IR.id, actIndex: 0, blindIndex: 1 },
    ]);
    expect(first.table.clock).toBe(48);
  });

  it("completes the act once answered, with no relic to claim", () => {
    const act = irAct(IR);
    let state = runToBoss(act, SEED);
    const { actions } = playBlind(IR, state.table, "MEDIAN");
    for (const action of actions) state = advanceRun(act, state, inRun(action));
    expect(state.table.status).toBe("CLEARED");
    expect(deriveRunView(act, state).phase).toBe("RUN_WON");
    expect(deriveRunView(act, state).table.reward).toBeNull();
  });
});
