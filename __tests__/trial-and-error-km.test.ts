// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEMOGRAPHICS_SCENARIO,
  HAND_BASE_SCORES,
  KM_REDLINE_PENALTY,
  KM_SYNERGY,
  ScenarioSchema,
  advanceTable,
  classifyHand,
  createTableState,
  deriveTableView,
  evaluateHand,
  kaplanMeier,
  scoreTimeline,
  stepAt,
  validateKm,
  type CardFace,
  type ClassifiableCard,
  type KmFigure,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";
import { KM_FIGURE, SMALL_BLIND_WITH_KM } from "./utils/trial-and-error-km";

const km = KM_FIGURE.km as KmFigure;
const snapshot = DEMOGRAPHICS_SCENARIO.populationSnapshot;
const scenario = SMALL_BLIND_WITH_KM;
const FIG = KM_FIGURE.id;
const DISPOSITION = "C-T14.1.2";
const PARENT_FACE = DEMOGRAPHICS_SCENARIO.deck.find(
  (c) => c.id === DISPOSITION
)!.face as CardFace;

const run = (
  actions: TableAction[],
  from: TableState = createTableState(scenario)
) =>
  actions.reduce(
    (state, action) => advanceTable(scenario, state, action),
    from
  );
const select = (...ids: string[]): TableAction[] =>
  ids.map((cardId) => ({ type: "TOGGLE_SELECT", cardId }));

describe("kaplanMeier", () => {
  it("steps down only at event times, counting censorings at t as still at risk", () => {
    const curve = kaplanMeier([
      { time: 2, event: true },
      { time: 2, event: false },
      { time: 3, event: true },
      { time: 5, event: false },
    ]);
    expect(curve).toEqual([
      [0, 1],
      [2, 0.75],
      [3, 0.375],
    ]);
  });

  it("handles tied event times as one step", () => {
    const curve = kaplanMeier([
      { time: 2, event: true },
      { time: 2, event: true },
      { time: 4, event: false },
      { time: 6, event: true },
    ]);
    expect(curve).toEqual([
      [0, 1],
      [2, 0.5],
      [6, 0],
    ]);
    expect(stepAt(curve, 1.9)).toBe(1);
    expect(stepAt(curve, 2)).toBe(0.5);
    expect(stepAt(curve, 5)).toBe(0.5);
  });

  it("stays at 1 with only censored records", () => {
    expect(kaplanMeier([{ time: 4, event: false }])).toEqual([[0, 1]]);
  });
});

describe("validateKm", () => {
  it("re-derives each arm and flags the draft's two defects", () => {
    const report = validateKm(km, snapshot, "ITT", PARENT_FACE);
    expect(report.snapshotId).toBe(snapshot.id);
    const [pbo, act] = report.arms;
    expect(pbo).toMatchObject({
      n: 6,
      events: 1,
      censorTicks: [12],
      atRisk: [6, 6, 5, 5],
      estimates: [1, 1, 0.833, 0.833],
    });
    // A subject with an event at a milestone is still at risk at it.
    expect(act).toMatchObject({
      n: 6,
      events: 2,
      censorTicks: [12],
      atRisk: [6, 5, 5, 4],
      estimates: [1, 0.833, 0.667, 0.667],
    });
    expect(report.findings.map((f) => [f.id, f.observed, f.expected])).toEqual([
      ["CENSOR_TICK@PLACEBO", "5, 12", "12"],
      ["AT_RISK@ACTIVEt8", "4", "5"],
    ]);
  });

  it("asserts a fixed origin, a non-increasing curve and the estimates", () => {
    const bad: KmFigure = {
      ...km,
      timeOrigin: 1,
      displayed: [
        {
          ...km.displayed[0],
          curve: [
            [0, 1],
            [5, 0.8],
            [9, 0.9],
          ],
          censorTicks: [12],
        },
      ],
    };
    const ids = validateKm(bad, snapshot, "ITT").findings.map((f) => f.id);
    expect(ids).toEqual([
      "TIME_ORIGIN@PLACEBO",
      "MONOTONIC@PLACEBO",
      "ESTIMATE@PLACEBOt8",
      "ESTIMATE@PLACEBOt12",
    ]);
  });

  it("reconciles the origin and events with the parent table", () => {
    const parent: CardFace = {
      kind: "TABLE",
      columns: ["Placebo", "Active", "Total"],
      rows: [
        { label: "Randomized", values: ["7", "6", "13"] },
        { label: "Completed", values: ["5", "4", "9"] },
        { label: "Discontinued", values: ["1 (14.3)", "3 (50.0)", "4"] },
      ],
    };
    const ids = validateKm(km, snapshot, "ITT", parent).findings.map(
      (f) => f.id
    );
    expect(ids).toContain("PARENT_AT_RISK@PLACEBO");
    expect(ids).toContain("PARENT_EVENTS@ACTIVE");
    expect(ids).not.toContain("PARENT_AT_RISK@ACTIVE");
  });

  it("counts only records in the figure's population", () => {
    // S-008 is ITT but not FAS; S-004 and S-012 are not Per-Protocol.
    const fas = validateKm(km, snapshot, "FAS").arms[1];
    expect(fas).toMatchObject({ n: 5, events: 1 });
  });
});

describe("KM figure schema", () => {
  const issues = (deck: typeof scenario.deck) =>
    ScenarioSchema.safeParse({ ...scenario, deck }).error?.issues.map(
      (i) => i.message
    ) ?? [];

  it("accepts the fixture scenario", () => {
    expect(issues(scenario.deck)).toEqual([]);
  });

  it("rejects KM data on a non-Figure, an unknown parent, another snapshot or subject", () => {
    const swap = (card: typeof KM_FIGURE) =>
      scenario.deck.map((c) => (c.id === FIG ? card : c));
    expect(issues(swap({ ...KM_FIGURE, cardType: "TABLE" }))).toContain(
      "Only a Figure carries Kaplan–Meier data"
    );
    expect(
      issues(
        swap({
          ...KM_FIGURE,
          km: { ...km, parent: { ...km.parent, cardId: "C-L16.2.4" } },
        })
      )
    ).toContain("A KM figure's parent must be a Table in the deck");
    expect(
      issues(
        swap({ ...KM_FIGURE, km: { ...km, populationSnapshotId: "SNAP-X" } })
      )
    ).toContain("A KM figure must reference the scenario's snapshot");
    expect(
      issues(
        swap({
          ...KM_FIGURE,
          km: {
            ...km,
            records: [{ subjectId: "S-999", time: 1, event: true }],
          },
        })
      )
    ).toContain("A time-to-event record must name a subject in the snapshot");
    expect(
      issues(swap({ ...KM_FIGURE, km: { ...km, milestones: [0, 8, 4, 12] } }))
    ).toContain("Milestones must be strictly increasing");
  });
});

describe("dependent Figures on the Card Table", () => {
  it("prints its parent and an inactive ×Mult until inspected", () => {
    const view = deriveTableView(scenario, createTableState(scenario));
    const fig = view.hand.find((h) => h.card.id === FIG)!;
    expect(fig.inspectable).toBe(true);
    expect(fig.unverified).toBe(true);
    expect(fig.figure).toEqual({
      parent: "Table 14.1.2",
      xMult: KM_SYNERGY,
      active: false,
      reason: "Inspect the figure to reconcile its Number-at-Risk.",
      blocked: false,
    });
    expect(fig.face).toMatchObject({
      kind: "FIGURE",
      source: "Table 14.1.2",
      atRisk: { times: [0, 4, 8, 12] },
    });
  });

  it("reveals every check on inspect and reconciles findings one by one", () => {
    const open = run([{ type: "INSPECT_CARD", cardId: FIG }]);
    expect(open.cpu.available).toBe(9);
    const desk = deriveTableView(scenario, open).figureInspection!;
    expect(desk.openFindings.map((f) => f.id)).toEqual([
      "CENSOR_TICK@PLACEBO",
      "AT_RISK@ACTIVEt8",
    ]);
    expect(deriveTableView(scenario, open).inspection).toBeNull();
    expect(
      run([{ type: "INSPECT_CELL", row: 0, col: 0 }], open).lastEvent?.kind
    ).toBe("REFUSED");
    const one = run(
      [{ type: "CORRECT_FINDING", findingId: "AT_RISK@ACTIVEt8" }],
      open
    );
    expect(one.lastEvent?.message).toBe(
      "Reconciled at risk for Active: 4 to 5."
    );
    expect(
      run([{ type: "CORRECT_FINDING", findingId: "AT_RISK@ACTIVEt8" }], one)
        .lastEvent?.kind
    ).toBe("REFUSED");
    const both = run(
      [{ type: "CORRECT_FINDING", findingId: "CENSOR_TICK@PLACEBO" }],
      one
    );
    expect(both.lastEvent?.message).toContain("×2 Mult is live");
    const view = deriveTableView(scenario, both);
    const fig = view.hand.find((h) => h.card.id === FIG)!;
    expect(fig.figure?.active).toBe(true);
    expect(fig.stamps).toContain("QC_PASS");
    // The reconciled face prints the true at-risk rows and ticks.
    expect(
      fig.face.kind === "FIGURE" && fig.face.atRisk?.rows[1].values
    ).toEqual([6, 5, 5, 4]);
    expect(
      fig.face.kind === "FIGURE" &&
        fig.face.plot.type === "KM" &&
        fig.face.plot.series[0].censors
    ).toEqual([12]);
  });

  it("imposes redline penalties while KM discrepancies stand, and ×2 once reconciled", () => {
    const unreconciled = run([...select(FIG), { type: "PLAY_HAND" }]).lastPlay!
      .evaluation;
    const penalties = unreconciled.ruleResults.filter((r) =>
      r.ruleId.startsWith("KM@")
    );
    expect(penalties.map((r) => r.multDelta)).toEqual([
      -KM_REDLINE_PENALTY,
      -KM_REDLINE_PENALTY,
    ]);
    expect(unreconciled.xMult.factors).toEqual([]);

    const reconciled = run([
      { type: "INSPECT_CARD", cardId: FIG },
      { type: "CORRECT_FINDING", findingId: "AT_RISK@ACTIVEt8" },
      { type: "CORRECT_FINDING", findingId: "CENSOR_TICK@PLACEBO" },
      { type: "CLOSE_INSPECT" },
      ...select(FIG),
      { type: "PLAY_HAND" },
    ]).lastPlay!.evaluation;
    expect(reconciled.handType).toBe("HIGH_TABLE");
    expect(reconciled.xMult.factors).toEqual([
      { sourceId: `KM-RECONCILED@${FIG}`, value: KM_SYNERGY },
    ]);
    // 15 base + 25 Chips; (1 base + 1) +Mult × 2.
    expect(reconciled.score).toBe(40 * 2 * KM_SYNERGY);
    const step = scoreTimeline(reconciled, {
      roundScoreBefore: 0,
      target: 300,
    }).find((s) => s.kind === "X_MULT");
    expect(step).toMatchObject({ factor: KM_SYNERGY });
    expect(step?.text).toContain("reconcile with Table 14.1.2");
  });

  it("cannot compile without its parent Table in hand", () => {
    const state = run([
      { type: "INSPECT_CARD", cardId: FIG },
      { type: "CORRECT_FINDING", findingId: "AT_RISK@ACTIVEt8" },
      { type: "CORRECT_FINDING", findingId: "CENSOR_TICK@PLACEBO" },
      { type: "CLOSE_INSPECT" },
      ...select(DISPOSITION),
      { type: "DISCARD" },
    ]);
    const fig = deriveTableView(scenario, state).hand.find(
      (h) => h.card.id === FIG
    )!;
    expect(fig.figure).toMatchObject({ active: false, blocked: true });
    expect(fig.figure?.reason).toMatch(
      /^Parent Table 14\.1\.2 is not on the table/
    );
    const played = run([...select(FIG), { type: "PLAY_HAND" }], state).lastPlay!
      .evaluation;
    const block = played.ruleResults.find((r) => r.ruleId === "FIG-DEPENDENCY");
    expect(block?.chipsDelta).toBe(-KM_FIGURE.chips);
    expect(played.xMult.factors).toEqual([]);
  });
});

describe("Efficacy Full House", () => {
  it("scores 3 Tables with 2 dependent Figures at 160 Chips × 14 Mult", () => {
    const t = (id: string, topic: string): ClassifiableCard => ({
      id,
      cardType: "TABLE",
      population: "ITT",
      chips: 10,
      topic,
    });
    const f = (id: string, topic: string): ClassifiableCard => ({
      id,
      cardType: "FIGURE",
      population: "ITT",
      chips: 10,
      topic,
    });
    const cards = [
      t("T1", "EFF"),
      t("T2", "EFF"),
      t("T3", "DS"),
      f("F1", "EFF"),
      f("F2", "DS"),
    ];
    const hand = classifyHand(cards)!;
    expect(hand.handType).toBe("EFFICACY_FULL_HOUSE");
    expect(HAND_BASE_SCORES.EFFICACY_FULL_HOUSE).toMatchObject({
      baseChips: 160,
      baseMult: 14,
    });
    const evaluation = evaluateHand({
      handType: hand.handType,
      cards: cards.map((c) => ({ id: c.id, chips: c.chips, mult: 0 })),
      ruleResults: [],
    });
    expect(evaluation.score).toBe((160 + 50) * 14);
    // A Figure whose topic has no Table breaks the Full House.
    expect(
      classifyHand([...cards.slice(0, 4), f("F2", "AE")])?.handType
    ).not.toBe("EFFICACY_FULL_HOUSE");
  });
});
