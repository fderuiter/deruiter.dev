// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  BlindTierSchema,
  CardTypeSchema,
  DEMOGRAPHICS_SCENARIO,
  HAND_BASE_SCORES,
  HandBaseScoreSchema,
  HandEvaluationSchema,
  HandType,
  HandTypeSchema,
  PopulationTypeSchema,
  RoundingModeSchema,
  RuleCheckResultSchema,
  SapRulebookSchema,
  SCENARIOS,
  ScenarioSchema,
  StagedTableSchema,
  TableShellSpecSchema,
  TlfCardSchema,
  evaluateHand,
} from "@/lib/trial-and-error";

describe("Trial & Error runtime schemas", () => {
  it("keeps FAS and ITT as distinct population suits", () => {
    expect(PopulationTypeSchema.options).toEqual([
      "SCREENED",
      "ITT",
      "SAFETY",
      "PER_PROTOCOL",
      "FAS",
    ]);
    expect(PopulationTypeSchema.safeParse("FAS").success).toBe(true);
    expect(PopulationTypeSchema.safeParse("ITT").success).toBe(true);
    expect(PopulationTypeSchema.safeParse("MITT").success).toBe(false);
  });

  it("accepts the declared card, blind and rounding primitives and rejects others", () => {
    expect(CardTypeSchema.safeParse("LISTING").success).toBe(true);
    expect(CardTypeSchema.safeParse("HEARTS").success).toBe(false);
    expect(BlindTierSchema.safeParse("BOSS_BLIND").success).toBe(true);
    expect(BlindTierSchema.safeParse("ANTE").success).toBe(false);
    expect(RoundingModeSchema.options).toEqual([
      "HALF_EVEN",
      "HALF_AWAY_FROM_ZERO",
      "TRUNCATE",
    ]);
    expect(RoundingModeSchema.safeParse("HALF_UP").success).toBe(false);
  });

  it("exposes hand types in strength order with enum-style access", () => {
    expect(HandType.HIGH_TABLE).toBe("HIGH_TABLE");
    expect(HandTypeSchema.options[HandTypeSchema.options.length - 1]).toBe(
      "MEDDRA_FIVE_OF_A_KIND"
    );
    expect(HandTypeSchema.safeParse("ROYAL_FLUSH").success).toBe(false);
  });

  it("pins the hand table from the governing map", () => {
    const table = Object.fromEntries(
      Object.values(HAND_BASE_SCORES).map((h) => [
        h.handType,
        [h.baseChips, h.baseMult],
      ])
    );
    expect(table).toEqual({
      HIGH_TABLE: [15, 1],
      TLF_PAIR: [30, 2],
      TLF_TWO_PAIR: [60, 4],
      POPULATION_FLUSH: [100, 7],
      CSR_STRAIGHT: [140, 10],
      EFFICACY_FULL_HOUSE: [160, 14],
      MEDDRA_FIVE_OF_A_KIND: [200, 18],
    });
    for (const base of Object.values(HAND_BASE_SCORES)) {
      expect(HandBaseScoreSchema.safeParse(base).success).toBe(true);
    }
    expect(
      HandBaseScoreSchema.safeParse({
        handType: "HIGH_TABLE",
        baseChips: -1,
        baseMult: 1,
        description: "x",
      }).success
    ).toBe(false);
  });

  it("validates table shell specs, including chips and mult", () => {
    expect(
      TableShellSpecSchema.safeParse(DEMOGRAPHICS_SCENARIO.shells[0]).success
    ).toBe(true);
    const bad = TableShellSpecSchema.safeParse({
      ...DEMOGRAPHICS_SCENARIO.shells[0],
      chips: 1.5,
      targetPopulation: "EVERYONE",
    });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      "chips",
      "targetPopulation",
    ]);
  });

  it("validates rule check results, including the ×0 multiplier", () => {
    const fatal = {
      ruleId: "SAP-DM-01",
      passed: false,
      chipsDelta: 0,
      multDelta: 0,
      multMultiplier: 0,
      evidence: "7/11",
      cellCoordinates: { row: 2, col: 2 },
    };
    expect(RuleCheckResultSchema.safeParse(fatal).success).toBe(true);
    expect(
      RuleCheckResultSchema.safeParse({ ...fatal, multMultiplier: -1 }).success
    ).toBe(false);
    expect(
      RuleCheckResultSchema.safeParse({
        ...fatal,
        cellCoordinates: { row: -1, col: 0 },
      }).success
    ).toBe(false);
    expect(
      RuleCheckResultSchema.safeParse({ ...fatal, evidence: "" }).success
    ).toBe(false);
  });

  it("requires a rulebook to cover every QC category and forbids self-aliases", () => {
    const rulebook = DEMOGRAPHICS_SCENARIO.rulebook;
    expect(SapRulebookSchema.safeParse(rulebook).success).toBe(true);

    const missing = SapRulebookSchema.safeParse({
      ...rulebook,
      rules: rulebook.rules.filter((r) => r.category !== "ROUNDING"),
    });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0].message).toContain("ROUNDING");

    const selfAlias = SapRulebookSchema.safeParse({
      ...rulebook,
      populationAliases: [{ population: "FAS", equals: "FAS" }],
    });
    expect(selfAlias.success).toBe(false);

    const explicitAlias = SapRulebookSchema.safeParse({
      ...rulebook,
      populationAliases: [{ population: "FAS", equals: "ITT" }],
    });
    expect(explicitAlias.success).toBe(true);
  });

  it("rejects staged tables whose cells do not match their rows and columns", () => {
    const table = DEMOGRAPHICS_SCENARIO.drawPile[0];
    expect(StagedTableSchema.safeParse(table).success).toBe(true);
    expect(
      StagedTableSchema.safeParse({ ...table, cells: table.cells.slice(1) })
        .success
    ).toBe(false);
    const ragged = StagedTableSchema.safeParse({
      ...table,
      cells: table.cells.map((row, i) => (i === 3 ? row.slice(1) : row)),
    });
    expect(ragged.success).toBe(false);
    expect(ragged.error?.issues[0].path).toEqual(["cells", 3]);
  });

  it("accepts every shipped scenario and rejects cross-wired ones", () => {
    for (const scenario of Object.values(SCENARIOS)) {
      expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
    }
    const crossWired = ScenarioSchema.safeParse({
      ...DEMOGRAPHICS_SCENARIO,
      shells: [
        {
          ...DEMOGRAPHICS_SCENARIO.shells[0],
          requiredRulebookId: "SAP-OTHER",
        },
        DEMOGRAPHICS_SCENARIO.shells[0],
      ],
      drawPile: [
        {
          ...DEMOGRAPHICS_SCENARIO.drawPile[0],
          shellId: "T-99",
          populationSnapshotId: "SNAP-OLD",
        },
      ],
    });
    expect(crossWired.success).toBe(false);
    expect(crossWired.error?.issues.map((i) => i.path.join("."))).toEqual(
      expect.arrayContaining([
        "shells.0.requiredRulebookId",
        "shells.1.id",
        "drawPile.0.shellId",
        "drawPile.0.populationSnapshotId",
      ])
    );
  });

  it("produces hand evaluations that satisfy the HandEvaluation contract", () => {
    const evaluation = evaluateHand({
      handType: "HIGH_TABLE",
      cards: [{ id: "T-14.1.1", chips: 30, mult: 1 }],
      ruleResults: [],
    });
    expect(HandEvaluationSchema.safeParse(evaluation).success).toBe(true);
    expect(
      HandEvaluationSchema.safeParse({ ...evaluation, score: -5 }).success
    ).toBe(false);
  });

  it("validates the Card Table deck: unique ids and existing drafts", () => {
    const [first, second] = DEMOGRAPHICS_SCENARIO.deck;
    const broken = ScenarioSchema.safeParse({
      ...DEMOGRAPHICS_SCENARIO,
      deck: [
        first,
        { ...second, id: first.id, draftId: "T-99-MISSING", face: undefined },
      ],
    });
    expect(broken.success).toBe(false);
    expect(broken.error?.issues.map((i) => i.path.join("."))).toEqual([
      "deck.1.id",
      "deck.1.draftId",
    ]);
    expect(
      TlfCardSchema.safeParse({ ...first, csrStage: "UNBLINDING" }).success
    ).toBe(false);
    expect(
      ScenarioSchema.safeParse({
        ...DEMOGRAPHICS_SCENARIO,
        table: { ...DEMOGRAPHICS_SCENARIO.table, maxSelection: 6 },
      }).success
    ).toBe(false);
  });
});
