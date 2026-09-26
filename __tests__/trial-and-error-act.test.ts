import { describe, it, expect } from "vitest";
import {
  ACT_I,
  ActSchema,
  BossBlindModifierSchema,
  DEMOGRAPHICS_SCENARIO,
  DOSE_ESCALATION_SCENARIO,
  SPONSOR_SAFETY_SCENARIO,
  ScenarioSchema,
  advanceRun,
  advanceTable,
  classifyHand,
  runBlinds,
  createRunState,
  createTableState,
  deriveRunView,
  deriveTableView,
  validate,
  type RunAction,
  type RunState,
  type Scenario,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

/** Act I's three Blinds, with its fixed Boss. */
const ACT_I_BLINDS = runBlinds(ACT_I, createRunState(ACT_I));
/** Act I without its crisis deck, for flows that test the Blinds alone. */
const QUIET_ACT = { ...ACT_I, crisisDeck: undefined };

const play = (
  scenario: Scenario,
  actions: TableAction[],
  from: TableState = createTableState(scenario)
) => actions.reduce((s, a) => advanceTable(scenario, s, a), from);
const select = (...ids: string[]): TableAction[] =>
  ids.map((cardId) => ({ type: "TOGGLE_SELECT", cardId }));

/** Inspect a card, review every cell, correct every finding, close. */
function fix(scenario: Scenario, cardId: string): TableAction[] {
  const card = scenario.deck.find((c) => c.id === cardId)!;
  const draft = scenario.drawPile.find((d) => d.id === card.draftId)!;
  const report = validate(
    draft,
    scenario.populationSnapshot,
    scenario.rulebook
  );
  const actions: TableAction[] = [{ type: "INSPECT_CARD", cardId }];
  draft.rows.forEach((_, row) =>
    draft.columns.forEach((_, col) =>
      actions.push({ type: "INSPECT_CELL", row, col })
    )
  );
  for (const finding of report.findings) {
    actions.push({ type: "CORRECT_FINDING", findingId: finding.id });
  }
  actions.push({ type: "CLOSE_INSPECT" });
  return actions;
}

/** A winning line for each Blind, within its CPU. */
const LINES: Record<string, TableAction[]> = {
  [DEMOGRAPHICS_SCENARIO.id]: [
    ...fix(DEMOGRAPHICS_SCENARIO, "C-T14.1.1-A"),
    ...select("C-T14.1.1-A", "C-L16.2.4"),
    { type: "PLAY_HAND" },
  ],
  [SPONSOR_SAFETY_SCENARIO.id]: [
    // Four corrected Safety tables and a listing make a Population Flush.
    ...fix(SPONSOR_SAFETY_SCENARIO, "C-T14.3.1-A"),
    ...fix(SPONSOR_SAFETY_SCENARIO, "C-T14.3.3-A"),
    ...fix(SPONSOR_SAFETY_SCENARIO, "C-T14.3.2.5-A"),
    ...fix(SPONSOR_SAFETY_SCENARIO, "C-T14.3.1-B"),
    ...select(
      "C-T14.3.1-A",
      "C-L16.2.7",
      "C-T14.3.3-A",
      "C-T14.3.2.5-A",
      "C-T14.3.1-B"
    ),
    { type: "PLAY_HAND" },
  ],
  [DOSE_ESCALATION_SCENARIO.id]: [
    // Discard the two ITT outputs to draw the fifth SOC table.
    ...select("C-T14.1.2", "C-T14.1.1"),
    { type: "DISCARD" },
    ...fix(DOSE_ESCALATION_SCENARIO, "C-T14.3.2.5-B"),
    ...fix(DOSE_ESCALATION_SCENARIO, "C-T14.3.2.2-B"),
    ...fix(DOSE_ESCALATION_SCENARIO, "C-T14.3.2.3-A"),
    ...select(
      "C-T14.3.2.5-B",
      "C-T14.3.2.1-B",
      "C-T14.3.2.2-B",
      "C-T14.3.2.3-A",
      "C-T14.3.2.4-A"
    ),
    { type: "PLAY_HAND" },
  ],
};

describe("Act I contract", () => {
  it("ships three escalating Blinds on one Phase I snapshot", () => {
    expect(ActSchema.safeParse(ACT_I).success).toBe(true);
    expect(ACT_I_BLINDS.map((b) => [b.blind.tier, b.blind.quota])).toEqual([
      ["SMALL_BLIND", 450],
      ["BIG_BLIND", 7500],
      ["BOSS_BLIND", 8500],
    ]);
    expect(ACT_I_BLINDS.map((b) => b.blind.name)).toEqual([
      "Small Blind: Internal QC",
      "Big Blind: Sponsor Safety Review",
      "Boss Blind: Dose Escalation Committee",
    ]);
    for (const blind of ACT_I_BLINDS) {
      expect(ScenarioSchema.safeParse(blind).success).toBe(true);
      expect(blind.intro.length).toBeLessThanOrEqual(280);
    }
  });

  it("rejects an act whose Blinds do not escalate or share a snapshot", () => {
    const flat = ActSchema.safeParse({
      ...ACT_I,
      blinds: [SPONSOR_SAFETY_SCENARIO, SPONSOR_SAFETY_SCENARIO],
    });
    expect(flat.error?.issues.map((i) => i.path.join("."))).toEqual([
      "blinds.1.blind.tier",
    ]);
    const split = ActSchema.safeParse({
      ...ACT_I,
      blinds: [
        DEMOGRAPHICS_SCENARIO,
        {
          ...SPONSOR_SAFETY_SCENARIO,
          populationSnapshot: {
            ...SPONSOR_SAFETY_SCENARIO.populationSnapshot,
            id: "SNAP-OTHER",
          },
          drawPile: SPONSOR_SAFETY_SCENARIO.drawPile.map((d) => ({
            ...d,
            populationSnapshotId: "SNAP-OTHER",
          })),
        },
      ],
    });
    expect(split.error?.issues.map((i) => i.path.join("."))).toEqual([
      "blinds.1.populationSnapshot.id",
    ]);
  });

  it("requires a boss modifier on the Boss Blind and nowhere else", () => {
    const { boss, ...bossless } = DOSE_ESCALATION_SCENARIO;
    expect(ScenarioSchema.safeParse(bossless).success).toBe(false);
    expect(
      ScenarioSchema.safeParse({ ...SPONSOR_SAFETY_SCENARIO, boss }).success
    ).toBe(false);
    expect(
      BossBlindModifierSchema.safeParse({ ...boss, disabledPopulations: [] })
        .success
    ).toBe(false);
    expect(
      BossBlindModifierSchema.safeParse({
        ...boss,
        debuffType: "HAND_LIMIT",
        disabledPopulations: undefined,
        maxHandsAllowed: 2,
      }).success
    ).toBe(true);
  });

  it("disables every suit except Safety at the Dose Escalation Committee", () => {
    expect(DOSE_ESCALATION_SCENARIO.boss?.disabledPopulations?.sort()).toEqual([
      "FAS",
      "ITT",
      "PER_PROTOCOL",
      "SCREENED",
    ]);
  });
});

describe("safety validation: subjects, not events", () => {
  const findingsOf = (scenario: Scenario, draftId: string) =>
    validate(
      scenario.drawPile.find((d) => d.id === draftId)!,
      scenario.populationSnapshot,
      scenario.rulebook
    ).findings;

  it("finds nothing in the clean drafts", () => {
    for (const [scenario, id] of [
      [SPONSOR_SAFETY_SCENARIO, "T-14.3.3-B"],
      [SPONSOR_SAFETY_SCENARIO, "T-14.3.2.1-A"],
      [DOSE_ESCALATION_SCENARIO, "T-14.3.2.1-B"],
      [DOSE_ESCALATION_SCENARIO, "T-14.3.2.4-A"],
      [DOSE_ESCALATION_SCENARIO, "T-14.3.1-C"],
    ] as const) {
      expect(findingsOf(scenario, id)).toEqual([]);
    }
  });

  it("explains an SOC row that counts events instead of subjects", () => {
    const [active, total] = findingsOf(SPONSOR_SAFETY_SCENARIO, "T-14.3.2.5-A");
    expect(active).toMatchObject({
      ruleId: "SAP-AE-04",
      category: "VALUE",
      severity: "MAJOR",
      cell: { row: 1, col: 1 },
      observed: "3 (50.0)",
      expected: "2 (33.3)",
      evidence:
        "n=3 counts events, not subjects. 3 events belong to 2 subjects, and a subject is counted once however many events they have.",
    });
    expect(total.expected).toBe("3 (25.0)");
    const [single] = findingsOf(SPONSOR_SAFETY_SCENARIO, "T-14.3.2.2-A");
    expect(single.evidence).toContain("2 events belong to 1 subject,");
  });

  it("reconciles Any TEAE with the event total across the SOC tables", () => {
    const [precision, events] = findingsOf(
      SPONSOR_SAFETY_SCENARIO,
      "T-14.3.1-B"
    );
    expect(precision.category).toBe("PRECISION");
    expect(events).toMatchObject({
      category: "VALUE",
      observed: "13 (108.3)",
      expected: "8 (66.7)",
    });
    expect(events.evidence).toContain("13 events belong to 8 subjects");
  });

  it("gives a mismatch that is not an event count the generic evidence", () => {
    const [value] = findingsOf(SPONSOR_SAFETY_SCENARIO, "T-14.3.3-A");
    expect(value.evidence).toBe(
      "n=3 does not match the snapshot, which has 2 qualifying subjects."
    );
  });

  it("catches FAS and Per-Protocol denominators as fatal", () => {
    const fas = findingsOf(SPONSOR_SAFETY_SCENARIO, "T-14.3.1-A");
    expect(fas.map((f) => f.category)).toEqual(Array(5).fill("DENOMINATOR"));
    expect(fas[1].evidence).toBe(
      "100.0 divides by 5, the FAS N for Active. The SAP population is Safety (N=6): 5 × 100 / 6 gives 83.3."
    );
    const pp = findingsOf(DOSE_ESCALATION_SCENARIO, "T-14.3.2.2-B");
    expect(pp.every((f) => f.severity === "FATAL")).toBe(true);
    expect(pp[0].evidence).toBe(
      "N=9 is the Per-Protocol count for Total; the SAP population is Safety (N=12)."
    );
  });

  it("counts serious, grade and discontinuation filters by subject", () => {
    const overview = DOSE_ESCALATION_SCENARIO.drawPile.find(
      (d) => d.id === "T-14.3.1-C"
    )!;
    expect(overview.cells.slice(1).map((r) => r[2])).toEqual([
      "8 (66.7)",
      "3 (25.0)",
      "3 (25.0)",
      "1 (8.3)",
    ]);
  });
});

describe("Dose Escalation Committee debuff", () => {
  const boss = DOSE_ESCALATION_SCENARIO;

  it("scores an ITT output at 0 Chips with one explained line, keeping +Mult", () => {
    const state = play(boss, [...select("C-T14.1.2"), { type: "PLAY_HAND" }]);
    const evaluation = state.lastPlay!.evaluation;
    // (15 base + 25 − 25) × (1 base + 1 card).
    expect(evaluation.chips.total).toBe(15);
    expect(evaluation.mult.total).toBe(2);
    expect(evaluation.score).toBe(30);
    expect(evaluation.ruleResults).toEqual([
      {
        ruleId: "DEC-SAFETY-ONLY",
        passed: false,
        chipsDelta: -25,
        multDelta: 0,
        evidence:
          "Dose Escalation Committee (Safety Set Only): Table 14.1.2 is built on the ITT population, so it scores 0 Chips (25 cancelled).",
      },
    ]);
  });

  it("marks disabled cards in the view and in the preview", () => {
    const state = play(boss, select("C-T14.1.2"));
    const view = deriveTableView(boss, state);
    expect(view.hand.filter((h) => h.debuffed).map((h) => h.card.id)).toEqual([
      "C-T14.1.2",
      "C-T14.1.1",
    ]);
    expect(view.preview?.chips.total).toBe(15);
    expect(view.preview?.score).toBe(30);
  });

  it("cancels a disabled draft's subject credit too", () => {
    const itt: Scenario = {
      ...boss,
      boss: { ...boss.boss!, disabledPopulations: ["SAFETY"] },
    };
    const state = play(itt, [
      ...select("C-T14.3.2.1-B"),
      { type: "PLAY_HAND" },
    ]);
    const debuff = state.lastPlay!.evaluation.ruleResults.at(-1)!;
    expect(debuff.chipsDelta).toBe(-(25 + 12));
    expect(state.lastPlay!.evaluation.chips.total).toBe(15);
  });

  it("leaves Safety outputs and the other Blinds alone", () => {
    const safe = play(boss, [
      ...select("C-T14.3.2.1-B"),
      { type: "PLAY_HAND" },
    ]);
    expect(safe.lastPlay!.evaluation.chips.total).toBe(15 + 25 + 12);
    const big = play(SPONSOR_SAFETY_SCENARIO, [
      ...select("C-T14.1.2"),
      { type: "PLAY_HAND" },
    ]);
    expect(big.lastPlay!.evaluation.chips.total).toBe(40);
    expect(
      deriveTableView(SPONSOR_SAFETY_SCENARIO, big).hand.some((h) => h.debuffed)
    ).toBe(false);
  });
});

describe("Act I hands", () => {
  const cards = (scenario: Scenario, ...ids: string[]) =>
    ids.map((id) => scenario.deck.find((c) => c.id === id)!);

  it("makes a Two Pair from the AE and SAE tables with their listings", () => {
    expect(
      classifyHand(
        cards(
          SPONSOR_SAFETY_SCENARIO,
          "C-T14.3.1-A",
          "C-L16.2.7",
          "C-T14.3.3-A",
          "C-L16.2.8"
        )
      )?.handType
    ).toBe("TLF_TWO_PAIR");
  });

  it("makes a MedDRA Five of a Kind and a Safety Population Flush at the committee", () => {
    const b = DOSE_ESCALATION_SCENARIO;
    expect(
      classifyHand(
        cards(
          b,
          "C-T14.3.2.5-B",
          "C-T14.3.2.1-B",
          "C-T14.3.2.2-B",
          "C-T14.3.2.3-A",
          "C-T14.3.2.4-A"
        )
      )?.handType
    ).toBe("MEDDRA_FIVE_OF_A_KIND");
    expect(
      classifyHand(
        cards(
          b,
          "C-T14.3.2.5-B",
          "C-T14.3.2.1-B",
          "C-L16.2.7",
          "C-L16.2.8",
          "C-T14.3.1-C"
        )
      )?.handType
    ).toBe("POPULATION_FLUSH");
  });
});

describe("each Blind is clearable, and a missed fatal defect zeroes it", () => {
  it.each(ACT_I_BLINDS.map((b) => [b.blind.name, b] as const))(
    "%s clears with an inspected line",
    (_, scenario) => {
      const state = play(scenario, LINES[scenario.id]);
      expect(state.status).toBe("CLEARED");
      expect(state.roundScore).toBeGreaterThanOrEqual(scenario.blind.quota);
      expect(state.cpu.available).toBeGreaterThanOrEqual(0);
    }
  );

  it.each([
    [SPONSOR_SAFETY_SCENARIO, ["C-T14.3.1-A", "C-L16.2.7"]],
    [DOSE_ESCALATION_SCENARIO, ["C-T14.3.2.2-B", "C-L16.2.7"]],
  ] as const)(
    "zeroes an uninspected FAS or Per-Protocol table (%#)",
    (scenario, ids) => {
      const state = play(scenario, [...select(...ids), { type: "PLAY_HAND" }]);
      expect(state.lastPlay?.evaluation.score).toBe(0);
      expect(state.lastPlay?.evaluation.zeroRule.triggered).toBe(true);
    }
  );
});

describe("run progression", () => {
  const step = (run: RunState, ...actions: RunAction[]) =>
    actions.reduce((r, a) => advanceRun(QUIET_ACT, r, a), run);
  const clearCurrent = (run: RunState) =>
    step(run, ...(LINES[ACT_I_BLINDS[run.blindIndex].id] as RunAction[]));

  it("starts at the Small Blind with its intro showing", () => {
    const view = deriveRunView(QUIET_ACT, createRunState(QUIET_ACT));
    expect(view).toMatchObject({
      blindIndex: 0,
      blindCount: 3,
      isFinalBlind: false,
      phase: "PLAYING",
      showIntro: true,
    });
    expect(view.blind.id).toBe(DEMOGRAPHICS_SCENARIO.id);
    expect(view.nextBlind?.id).toBe(SPONSOR_SAFETY_SCENARIO.id);
  });

  it("hides the intro once the player acts", () => {
    const run = step(
      createRunState(QUIET_ACT),
      ...(select("C-T14.1.2") as RunAction[]),
      { type: "DISCARD" }
    );
    expect(deriveRunView(QUIET_ACT, run).showIntro).toBe(false);
  });

  it("refuses Next Blind until the Blind is cleared", () => {
    const run = step(createRunState(QUIET_ACT), { type: "NEXT_BLIND" });
    expect(run.blindIndex).toBe(0);
    expect(run.table.lastEvent).toMatchObject({
      kind: "REFUSED",
      message: "Clear Small Blind: Internal QC first.",
    });
  });

  it("plays Small, Big and Boss in order to Act complete", () => {
    let run = clearCurrent(createRunState(QUIET_ACT));
    expect(deriveRunView(QUIET_ACT, run).phase).toBe("BLIND_CLEARED");
    const before = run.table.lastEvent!.sequence;
    run = step(run, { type: "NEXT_BLIND" });
    expect(run.blindIndex).toBe(1);
    expect(run.table.lastEvent).toEqual({
      kind: "BLIND_STARTED",
      message: "Big Blind: Sponsor Safety Review. Target 7500.",
      sequence: before + 1,
    });
    // CPU is the milestone's allocation: it resets for each Blind.
    expect(run.table.cpu).toEqual({ available: 10, spent: 0 });
    expect(deriveRunView(QUIET_ACT, run).showIntro).toBe(true);

    run = step(clearCurrent(run), { type: "NEXT_BLIND" });
    expect(deriveRunView(QUIET_ACT, run).blind.boss?.id).toBe(
      "DEC-SAFETY-ONLY"
    );
    run = clearCurrent(run);
    const done = deriveRunView(QUIET_ACT, run);
    expect(done).toMatchObject({
      phase: "RUN_WON",
      isFinalBlind: true,
      nextBlind: null,
    });
    expect(step(run, { type: "NEXT_BLIND" }).table.lastEvent?.message).toBe(
      "Act I: Phase I Safety is complete."
    );
  });

  it("ends the run when a Blind is lost, and restarts from the Small Blind", () => {
    let run = clearCurrent(createRunState(QUIET_ACT));
    run = step(run, { type: "NEXT_BLIND" });
    // Discard one card at a time until no hand can be played.
    while (run.table.status === "REVIEWING") {
      run = step(
        run,
        { type: "TOGGLE_SELECT", cardId: run.table.hand[0] },
        { type: "DISCARD" }
      );
    }
    expect(deriveRunView(QUIET_ACT, run).phase).toBe("RUN_FAILED");
    expect(
      step(run, { type: "TOGGLE_SELECT", cardId: run.table.hand[0] }).table
        .lastEvent?.message
    ).toBe("The Blind is over. Restart to play again.");
    const restarted = step(run, { type: "RESTART_RUN" });
    expect(restarted).toMatchObject({ blindIndex: 0 });
    expect(restarted.table.lastEvent?.message).toBe(
      "Run restarted. Small Blind: Internal QC."
    );
    expect({ ...restarted.table, lastEvent: null }).toEqual(
      createTableState(DEMOGRAPHICS_SCENARIO)
    );
  });

  it("replays identically: fixed draw piles, no randomness", () => {
    const script: RunAction[] = [
      ...(LINES[DEMOGRAPHICS_SCENARIO.id] as RunAction[]),
      { type: "NEXT_BLIND" },
      ...(LINES[SPONSOR_SAFETY_SCENARIO.id] as RunAction[]),
      { type: "NEXT_BLIND" },
      ...(LINES[DOSE_ESCALATION_SCENARIO.id] as RunAction[]),
    ];
    const once = step(createRunState(QUIET_ACT), ...script);
    const twice = step(createRunState(QUIET_ACT), ...script);
    expect(twice).toEqual(once);
    expect(JSON.parse(JSON.stringify(once))).toEqual(once);
  });
});
