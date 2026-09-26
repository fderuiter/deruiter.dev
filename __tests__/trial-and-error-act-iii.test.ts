import { describe, it, expect } from "vitest";
import {
  ACT_I,
  ACT_II,
  ACT_III,
  ACT_III_CRISES,
  ActSchema,
  BLINDED_DATA_REVIEW_SCENARIO,
  CSR_LOCK_PLACEHOLDER_SCENARIO,
  CsrStageSchema,
  SCENARIOS,
  SPONSOR_TOPLINE_SCENARIO,
  ScenarioSchema,
  advanceRun,
  classifyHand,
  createRunState,
  createTableState,
  deriveRunView,
  deriveTableView,
  isFreeCrisisChoice,
  validateKm,
  type CsrStage,
  type RunState,
  type Scenario,
  type TlfCard,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

const REVIEW = BLINDED_DATA_REVIEW_SCENARIO;
const TOPLINE = SPONSOR_TOPLINE_SCENARIO;
const LOCK = CSR_LOCK_PLACEHOLDER_SCENARIO;
const ALL = [REVIEW, TOPLINE, LOCK];

const deckCard = (scenario: Scenario, id: string) =>
  scenario.deck.find((c) => c.id === id);

/** Every card in the deck in hand at once. */
const allInHand = (scenario: Scenario) => ({
  ...createTableState(scenario),
  hand: scenario.deck.map((c) => c.id),
});

/** Efficacy KM Figures whose parent Table is in the same deck. */
const efficacyKm = (scenario: Scenario) =>
  scenario.deck.filter(
    (c) =>
      c.cardType === "FIGURE" &&
      c.csrStage === "EFFICACY" &&
      c.km !== undefined &&
      deckCard(scenario, c.km.parent.cardId)?.cardType === "TABLE"
  );

const isForest = (card: TlfCard) =>
  card.face?.kind === "FIGURE" && card.face.plot.type === "FOREST";

/** Plays the perfect line through the current Blind. */
function clearBlind(run: RunState): RunState {
  const view = deriveRunView(ACT_III, run);
  let next = run;
  for (const action of playBlind(view.blind, run.table, "PERFECT").actions) {
    if (next.table.status !== "REVIEWING") break;
    if (action.type === "RESET") continue;
    next = advanceRun(ACT_III, next, action);
  }
  return next;
}

describe("Act III: Phase III Blinded Pivotal (#1085)", () => {
  it("parses as an act, and every scenario in it as a scenario", () => {
    expect(ActSchema.safeParse(ACT_III).success).toBe(true);
    expect(ACT_III.title).toBe("Act III: Phase III Blinded Pivotal");
    for (const scenario of ALL) {
      expect(ScenarioSchema.safeParse(scenario).success, scenario.id).toBe(
        true
      );
      expect(SCENARIOS[scenario.id]).toBe(scenario);
    }
  });

  it("plays the blinded data review, the sponsor topline, then CSR Lock", () => {
    expect(ACT_III.blinds.map((b) => [b.id, b.blind.tier])).toEqual([
      [REVIEW.id, "SMALL_BLIND"],
      [TOPLINE.id, "BIG_BLIND"],
    ]);
    expect(ACT_III.bossPool?.map((b) => b.id)).toEqual([LOCK.id]);
    // The Big Blind records which ladder rung it is.
    expect(TOPLINE.title).toBe("Sponsor Topline Review");
    for (const seed of ["alpha", "bravo", "e2e-4"]) {
      const run = createRunState(ACT_III, seed);
      expect(run.bossId).toBe(LOCK.id);
      expect(run.draws).toEqual([]);
    }
  });

  it("uses its own rulebook, apart from Acts I and II", () => {
    const earlier = [ACT_I, ACT_II].flatMap((act) =>
      [...act.blinds, ...(act.bossPool ?? [])].map((b) => b.rulebook.id)
    );
    for (const scenario of ALL) {
      expect(scenario.rulebook.id).toBe("SAP-P3-001");
      expect(earlier).not.toContain(scenario.rulebook.id);
    }
  });

  it("gives every crisis a choice that costs nothing, and ids unique", () => {
    expect(new Set(ACT_III_CRISES.map((c) => c.id)).size).toBe(
      ACT_III_CRISES.length
    );
    for (const crisis of ACT_III_CRISES) {
      expect(crisis.choices.some(isFreeCrisisChoice), crisis.id).toBe(true);
    }
  });

  it("is played on its own through to the Boss", () => {
    let run = createRunState(ACT_III, "alpha");
    expect(deriveRunView(ACT_III, run).blind.id).toBe(REVIEW.id);
    run = clearBlind(run);
    expect(run.table.status).toBe("CLEARED");
    run = advanceRun(ACT_III, run, { type: "NEXT_BLIND" });
    expect(deriveRunView(ACT_III, run).blind.id).toBe(TOPLINE.id);
    expect(ACT_III_CRISES.map((c) => c.id)).toContain(run.table.crisis?.id);
    run = clearBlind(run);
    expect(run.table.status).toBe("CLEARED");
    run = advanceRun(ACT_III, run, { type: "NEXT_BLIND" });
    expect(deriveRunView(ACT_III, run).blind.id).toBe(LOCK.id);
  });
});

describe("Act III efficacy cards", () => {
  it("deals an efficacy Table, an efficacy KM Figure with its parent, and a forest plot in both Blinds", () => {
    for (const scenario of [REVIEW, TOPLINE]) {
      expect(
        scenario.deck.some(
          (c) => c.cardType === "TABLE" && c.csrStage === "EFFICACY"
        ),
        scenario.id
      ).toBe(true);
      expect(efficacyKm(scenario).length, scenario.id).toBeGreaterThanOrEqual(
        1
      );
      expect(scenario.deck.some(isForest), scenario.id).toBe(true);
      // The first deal already holds the figure, its parent and the forest.
      const dealt = createTableState(scenario).hand;
      const km = efficacyKm(scenario)[0];
      expect(dealt).toContain(km.id);
      expect(dealt).toContain(km.km?.parent.cardId);
      expect(dealt).toContain(scenario.deck.find(isForest)?.id);
    }
  });

  it("reconciles the topline KM figure with its parent, and redlines the dry run's at-risk row", () => {
    const check = (scenario: Scenario) => {
      const figure = efficacyKm(scenario)[0];
      const view = deriveTableView(scenario, allInHand(scenario));
      const parentFace = view.hand.find(
        (h) => h.card.id === figure.km?.parent.cardId
      )?.face;
      return validateKm(
        figure.km!,
        scenario.populationSnapshot,
        figure.population,
        parentFace
      ).findings.map((f) => f.id);
    };
    expect(check(TOPLINE)).toEqual([]);
    expect(check(REVIEW)).toEqual(["AT_RISK@ACTIVEt4"]);
  });

  it("makes an Efficacy Full House from the topline's efficacy cards", () => {
    const ids = [
      "C-T14.2.1",
      "C-T14.2.2",
      "C-T14.2.3",
      "C-F14.2.1",
      "C-F14.2.4",
    ];
    const cards = ids.map((id) => deckCard(TOPLINE, id) as TlfCard);
    expect(classifyHand(cards)?.handType).toBe("EFFICACY_FULL_HOUSE");
  });
});

describe("Act III CSR Straight", () => {
  it("puts every CSR stage on at least one card in the act", () => {
    const stages = new Set(
      ALL.flatMap((s) => s.deck.map((c) => c.csrStage)).filter(Boolean)
    );
    expect([...stages].sort()).toEqual([...CsrStageSchema.options].sort());
  });

  it("forms a legal CSR Straight from each Act III deck, in pipeline order", () => {
    for (const scenario of ALL) {
      const straight = CsrStageSchema.options.map(
        (stage: CsrStage) =>
          scenario.deck.find((c) => c.csrStage === stage) as TlfCard
      );
      expect(straight.every(Boolean), scenario.id).toBe(true);
      expect(straight.map((c) => c.csrStage)).toEqual(CsrStageSchema.options);
      expect(classifyHand(straight)?.handType, scenario.id).toBe(
        "CSR_STRAIGHT"
      );
    }
  });
});
