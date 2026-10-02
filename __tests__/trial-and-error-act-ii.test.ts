// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ACT_I,
  ACT_II,
  ACT_II_CRISES,
  ActSchema,
  DMC_MILESTONE_SCENARIO,
  DMC_OPEN_SESSION_SCENARIO,
  FDA_IR_SCENARIO,
  PHASE_II_QC_SCENARIO,
  SCENARIOS,
  SPONSOR_SAFETY_SCENARIO,
  ScenarioSchema,
  advanceRun,
  createRunState,
  createTableState,
  deriveRunView,
  deriveTableView,
  isFreeCrisisChoice,
  runBlinds,
  validate,
  validateKm,
  type RunState,
  type Scenario,
  type TlfCard,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

const QC = PHASE_II_QC_SCENARIO;
const OPEN = DMC_OPEN_SESSION_SCENARIO;
const SEEDS = ["fold-change", "e2e-4", "alpha", "bravo", "charlie", "delta"];

const deckCard = (scenario: Scenario, id: string) =>
  scenario.deck.find((c) => c.id === id) as TlfCard;

/** Figures in the deck whose parent Table is dealt in the same Blind. */
const figuresWithParents = (scenario: Scenario) =>
  scenario.deck.filter(
    (c) =>
      c.cardType === "FIGURE" &&
      c.km !== undefined &&
      deckCard(scenario, c.km.parent.cardId)?.cardType === "TABLE"
  );

/** Every card in the deck in hand at once. */
const allInHand = (scenario: Scenario) => ({
  ...createTableState(scenario),
  hand: scenario.deck.map((c) => c.id),
});

/** Plays the perfect line through the current Blind. */
function clearBlind(run: RunState): RunState {
  const view = deriveRunView(ACT_II, run);
  let next = run;
  for (const action of playBlind(view.blind, run.table, "PERFECT").actions) {
    if (next.table.status !== "REVIEWING") break;
    if (action.type === "RESET") continue;
    next = advanceRun(ACT_II, next, action);
  }
  return next;
}

describe("Act II: Phase II Proof of Concept (#1084)", () => {
  it("parses as an act, and every scenario in it as a scenario", () => {
    expect(ActSchema.safeParse(ACT_II).success).toBe(true);
    expect(ACT_II.title).toBe("Act II: Phase II Proof of Concept");
    for (const scenario of [...ACT_II.blinds, ...(ACT_II.bossPool ?? [])]) {
      expect(ScenarioSchema.safeParse(scenario).success, scenario.id).toBe(
        true
      );
      expect(SCENARIOS[scenario.id]).toBe(scenario);
    }
  });

  it("plays internal QC, then the DMC open session, then a Boss from the pool", () => {
    expect(ACT_II.blinds.map((b) => b.blind.tier)).toEqual([
      "SMALL_BLIND",
      "BIG_BLIND",
    ]);
    expect(ACT_II.blinds.map((b) => b.id)).toEqual([QC.id, OPEN.id]);
    expect(ACT_II.bossPool?.map((b) => b.id)).toEqual([
      DMC_MILESTONE_SCENARIO.id,
      FDA_IR_SCENARIO.id,
    ]);
  });

  it("gives every crisis a choice that costs nothing, and ids unique", () => {
    expect(ACT_II_CRISES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(ACT_II_CRISES.map((c) => c.id)).size).toBe(
      ACT_II_CRISES.length
    );
    for (const crisis of ACT_II_CRISES) {
      expect(crisis.choices.some(isFreeCrisisChoice), crisis.id).toBe(true);
    }
  });
});

describe("Act II boss draw", () => {
  it("draws the Boss from the pool by seed, the same Boss for the same seed", () => {
    for (const seed of SEEDS) {
      const run = createRunState(ACT_II, seed);
      expect(run.bossIds[0]).not.toBeNull();
      expect(ACT_II.bossPool?.some((b) => b.id === run.bossIds[0])).toBe(true);
      expect(createRunState(ACT_II, seed).bossIds[0]).toBe(run.bossIds[0]);
      // The Small Blind may also draw a protocol deviation (#1087).
      expect(run.draws.filter((d) => d.kind === "BOSS")).toEqual([
        {
          drawIndex: 0,
          kind: "BOSS",
          id: run.bossIds[0],
          actIndex: 0,
          blindIndex: 2,
        },
      ]);
      expect(runBlinds(ACT_II, run).map((b) => b.id)).toEqual([
        QC.id,
        OPEN.id,
        run.bossIds[0],
      ]);
    }
  });

  it("draws both Bosses across seeds", () => {
    const drawn = new Set(
      SEEDS.map((seed) => createRunState(ACT_II, seed).bossIds[0])
    );
    expect(drawn).toEqual(
      new Set([DMC_MILESTONE_SCENARIO.id, FDA_IR_SCENARIO.id])
    );
  });

  it("is played on its own through to the drawn Boss", () => {
    for (const seed of ["e2e-4", "alpha"]) {
      let run = createRunState(ACT_II, seed);
      expect(deriveRunView(ACT_II, run).blind.id).toBe(QC.id);
      expect(run.table.crisis).toBeNull();
      run = clearBlind(run);
      expect(run.table.status).toBe("CLEARED");
      run = advanceRun(ACT_II, run, { type: "NEXT_BLIND" });
      expect(deriveRunView(ACT_II, run).blind.id).toBe(OPEN.id);
      expect(ACT_II_CRISES.map((c) => c.id)).toContain(run.table.crisis?.id);
      run = clearBlind(run);
      expect(run.table.status).toBe("CLEARED");
      run = advanceRun(ACT_II, run, { type: "NEXT_BLIND" });
      expect(deriveRunView(ACT_II, run).blind.id).toBe(run.bossIds[0]);
    }
  });
});

describe("Act II content in normal play", () => {
  it("deals a Kaplan-Meier Figure with its parent Table in both Blinds", () => {
    for (const scenario of [QC, OPEN]) {
      expect(figuresWithParents(scenario).length).toBeGreaterThanOrEqual(1);
      const dealt = createTableState(scenario).hand;
      expect(
        figuresWithParents(scenario).some(
          (f) =>
            dealt.includes(f.id) &&
            dealt.includes(f.km?.parent.cardId as string)
        ),
        scenario.id
      ).toBe(true);
    }
  });

  it("makes KM reconciliation matter at internal QC", () => {
    const figure = deckCard(QC, "C-F14.3.3");
    const parent = deckCard(QC, figure.km?.parent.cardId as string);
    const view = deriveTableView(QC, allInHand(QC));
    const parentFace = view.hand.find((h) => h.card.id === parent.id)?.face;
    const report = validateKm(
      figure.km!,
      QC.populationSnapshot,
      figure.population,
      parentFace
    );
    expect(report.findings.length).toBeGreaterThan(0);
    const status = view.hand.find((h) => h.card.id === figure.id)?.figure;
    expect(status?.parent).toBe("Table 14.3.3");
  });

  it("deals by-arm closed-report outputs face down at the DMC open session", () => {
    const view = deriveTableView(OPEN, createTableState(OPEN));
    const down = view.hand.filter((h) => h.faceDown);
    expect(down.map((h) => h.card.id)).toEqual(
      expect.arrayContaining(["C-T14.3.3-C", "C-F14.3.3"])
    );
    // The closed report's values never reach the view in the open session.
    const text = JSON.stringify(down);
    expect(text).not.toContain("2 (33.3)");
    expect(text).not.toContain("(17)");
  });

  it("shows the open session pooled outputs face up with a Total column only", () => {
    const view = deriveTableView(OPEN, allInHand(OPEN));
    const pooled = view.hand.filter((h) => h.card.id.includes("POOLED"));
    expect(pooled.length).toBeGreaterThanOrEqual(3);
    for (const h of pooled) {
      expect(h.faceDown).toBe(false);
      expect(h.face.kind === "TABLE" && h.face.columns).toEqual(["Total"]);
    }
    expect(OPEN.dmc?.charter).toBeTruthy();
  });
});

describe("Act II rulebook drift", () => {
  const PHASE_II = QC.rulebook;

  it("uses a SAP that no Act I Blind uses, in both Act II Blinds", () => {
    const actI = [...ACT_I.blinds, ...(ACT_I.bossPool ?? [])].map(
      (b) => b.rulebook.id
    );
    expect(actI).not.toContain(PHASE_II.id);
    expect(OPEN.rulebook.id).toBe(PHASE_II.id);
    expect(PHASE_II.percentPrecision).toBe(0);
  });

  it("flags an Act I output against the Phase II SAP, and passes it under its own", () => {
    const actIDraft = SPONSOR_SAFETY_SCENARIO.drawPile.find(
      (d) => d.id === "T-14.3.3-B"
    );
    expect(actIDraft).toBeDefined();
    const snapshot = SPONSOR_SAFETY_SCENARIO.populationSnapshot;
    expect(
      validate(actIDraft!, snapshot, SPONSOR_SAFETY_SCENARIO.rulebook).findings
    ).toEqual([]);
    const drift = validate(actIDraft!, snapshot, PHASE_II).findings;
    expect(drift.length).toBeGreaterThan(0);
    expect(drift.every((f) => f.category === "PRECISION")).toBe(true);
  });

  it("deals a Phase I carry-over at internal QC that the new SAP redlines", () => {
    const carried = QC.drawPile.find((d) => d.id === "T-14.3.1-A");
    expect(carried?.draftLabel).toMatch(/Phase I carry-over/);
    const findings = validate(
      carried!,
      QC.populationSnapshot,
      PHASE_II
    ).findings;
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.category === "PRECISION")).toBe(true);
    const clean = QC.drawPile.find((d) => d.id === "T-14.3.1-B");
    expect(validate(clean!, QC.populationSnapshot, PHASE_II).findings).toEqual(
      []
    );
  });
});
