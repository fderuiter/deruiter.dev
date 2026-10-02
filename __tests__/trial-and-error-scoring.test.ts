// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEMOGRAPHICS_SCENARIO,
  decimalPlaces,
  evaluateHand,
  roundRatio,
  ruleResultsFor,
  validate,
  type RuleCheckResult,
} from "@/lib/trial-and-error";

const card = { id: "T-14.1.1", chips: 30, mult: 1 };

describe("roundRatio rounding-mode matrix", () => {
  it.each([
    // [numerator, denominator, precision, HALF_EVEN, HALF_AWAY_FROM_ZERO, TRUNCATE]
    [543, 12, 1, "45.2", "45.3", "45.2"], // exact tie 45.25, even neighbour below
    [5475, 100, 1, "54.8", "54.8", "54.7"], // exact tie 54.75, even neighbour above
    [625, 1000, 2, "0.62", "0.63", "0.62"], // 0.625
    [5, 2, 0, "2", "3", "2"], // 2.5
    [7, 2, 0, "4", "4", "3"], // 3.5
    [700, 12, 1, "58.3", "58.3", "58.3"], // not a tie
    [400, 6, 2, "66.67", "66.67", "66.66"],
    [1, 3, 0, "0", "0", "0"],
    [12, 1, 0, "12", "12", "12"],
  ] as const)(
    "%i / %i at %i dp",
    (numerator, denominator, precision, even, away, truncate) => {
      expect(roundRatio(numerator, denominator, precision, "HALF_EVEN")).toBe(
        even
      );
      expect(
        roundRatio(numerator, denominator, precision, "HALF_AWAY_FROM_ZERO")
      ).toBe(away);
      expect(roundRatio(numerator, denominator, precision, "TRUNCATE")).toBe(
        truncate
      );
    }
  );

  it("rounds negative ties symmetrically away from or towards zero", () => {
    expect(roundRatio(-543, 12, 1, "HALF_EVEN")).toBe("-45.2");
    expect(roundRatio(-543, 12, 1, "HALF_AWAY_FROM_ZERO")).toBe("-45.3");
    expect(roundRatio(543, -12, 1, "TRUNCATE")).toBe("-45.2");
    expect(roundRatio(-1, 100, 1, "HALF_EVEN")).toBe("0.0");
    expect(roundRatio(0, 5, 1, "HALF_EVEN")).toBe("0.0");
  });

  it("returns null instead of throwing on incomputable inputs", () => {
    expect(roundRatio(7, 0, 1, "HALF_EVEN")).toBeNull();
    expect(roundRatio(1.5, 2, 1, "HALF_EVEN")).toBeNull();
    expect(roundRatio(1, 2.5, 1, "HALF_EVEN")).toBeNull();
    expect(roundRatio(1, 2, -1, "HALF_EVEN")).toBeNull();
    expect(roundRatio(1, 2, 1.5, "HALF_EVEN")).toBeNull();
    expect(roundRatio(1, 2, 13, "HALF_EVEN")).toBeNull();
    expect(roundRatio(Number.NaN, 2, 1, "HALF_EVEN")).toBeNull();
  });

  it("counts displayed decimal places", () => {
    expect(decimalPlaces("45")).toBe(0);
    expect(decimalPlaces("45.2")).toBe(1);
    expect(decimalPlaces("66.67")).toBe(2);
  });
});

describe("evaluateHand scoring pipeline", () => {
  it("scores a bare High Table as (15 + 30) × (1 + 1)", () => {
    const result = evaluateHand({
      handType: "HIGH_TABLE",
      cards: [card],
      ruleResults: [],
    });
    expect(result.chips).toEqual({
      base: 15,
      outputs: 30,
      relics: 0,
      total: 45,
    });
    expect(result.mult).toEqual({
      base: 1,
      cardsAndRules: 1,
      relics: 0,
      total: 2,
    });
    expect(result.xMult).toEqual({ factors: [], product: 1 });
    expect(result.finalMult).toBe(2);
    expect(result.score).toBe(90);
    expect(result.zeroRule).toEqual({ triggered: false, ruleIds: [] });
    expect(result.cardIds).toEqual(["T-14.1.1"]);
  });

  it("applies the full formula: (base + Σ outputs + Σ relics) × (base + Σ +Mult + Σ relic +Mult) × Π ×Mult", () => {
    const ruleResults: RuleCheckResult[] = [
      {
        ruleId: "R-CHIPS",
        passed: true,
        chipsDelta: 12,
        multDelta: 0,
        evidence: "12 records",
      },
      {
        ruleId: "R-PREC",
        passed: true,
        chipsDelta: 0,
        multDelta: 2,
        evidence: "precision fixed",
      },
      {
        ruleId: "R-SYN",
        passed: true,
        chipsDelta: 0,
        multDelta: 0,
        multMultiplier: 2,
        evidence: "synergy",
      },
    ];
    const result = evaluateHand({
      handType: "TLF_PAIR",
      cards: [card, { id: "L-16.2.7", chips: 20, mult: 0 }],
      ruleResults,
      modifiers: [
        {
          sourceId: "RELIC-MACRO",
          label: "Lead Programmer Macro",
          chips: 10,
          plusMult: 4,
          xMult: 1.5,
        },
      ],
    });
    // Chips: 30 + (30 + 20 + 12) + 10 = 102. Mult: 2 + (1 + 2) + 4 = 9. ×: 2 × 1.5 = 3.
    expect(result.chips.total).toBe(102);
    expect(result.mult.total).toBe(9);
    expect(result.xMult.product).toBe(3);
    expect(result.finalMult).toBe(27);
    expect(result.score).toBe(2754);
    expect(result.ledger.map((l) => [l.step, l.kind, l.value])).toEqual([
      [1, "CHIPS", 30],
      [1, "CHIPS", 30],
      [1, "CHIPS", 20],
      [1, "CHIPS", 12],
      [1, "CHIPS", 10],
      [2, "PLUS_MULT", 2],
      [2, "PLUS_MULT", 1],
      [2, "PLUS_MULT", 0],
      [2, "PLUS_MULT", 2],
      [2, "PLUS_MULT", 4],
      [3, "X_MULT", 2],
      [3, "X_MULT", 1.5],
      [4, "X_MULT", 27],
    ]);
  });

  it("sets Final Mult to 0 whenever a rule carries the zero-score multiplier", () => {
    const result = evaluateHand({
      handType: "HIGH_TABLE",
      cards: [card],
      ruleResults: [
        {
          ruleId: "R-PREC",
          passed: true,
          chipsDelta: 0,
          multDelta: 2,
          evidence: "ok",
        },
        {
          ruleId: "SAP-DM-01",
          passed: false,
          chipsDelta: 0,
          multDelta: 0,
          multMultiplier: 0,
          evidence: "FAS N",
        },
      ],
      modifiers: [
        { sourceId: "RELIC", label: "Relic", chips: 0, plusMult: 0, xMult: 3 },
      ],
    });
    expect(result.zeroRule).toEqual({
      triggered: true,
      ruleIds: ["SAP-DM-01"],
    });
    expect(result.mult.total).toBe(4);
    expect(result.finalMult).toBe(0);
    expect(result.score).toBe(0);
    expect(result.ledger.at(-1)?.label).toContain("Zero-score rule");
  });

  it("floors negative totals at zero rather than producing negative scores", () => {
    const result = evaluateHand({
      handType: "HIGH_TABLE",
      cards: [card],
      ruleResults: [
        {
          ruleId: "R-BAD",
          passed: false,
          chipsDelta: -100,
          multDelta: -5,
          evidence: "bad",
        },
      ],
    });
    expect(result.chips.total).toBe(0);
    expect(result.mult.total).toBe(0);
    expect(result.score).toBe(0);
  });

  it("removes binary floating-point noise before flooring", () => {
    const result = evaluateHand({
      handType: "HIGH_TABLE",
      cards: [{ id: "c", chips: 85, mult: 0 }],
      ruleResults: [],
      modifiers: [
        { sourceId: "x", label: "x", chips: 0, plusMult: 0, xMult: 0.29 },
      ],
    });
    // 100 × (1 × 0.29) is 28.999999999999996 in floating point.
    expect(100 * 0.29).toBeLessThan(29);
    expect(result.score).toBe(29);
  });

  it("does not mutate its input", () => {
    const input = {
      handType: "HIGH_TABLE" as const,
      cards: [{ ...card }],
      ruleResults: [
        {
          ruleId: "R",
          passed: true,
          chipsDelta: 1,
          multDelta: 1,
          evidence: "e",
        },
      ],
    };
    const snapshot = structuredClone(input);
    evaluateHand(input);
    expect(input).toEqual(snapshot);
  });
});

describe("Demographics QC scoring cases", () => {
  const scenario = DEMOGRAPHICS_SCENARIO;
  const draftA = scenario.drawPile[0];
  const report = validate(
    draftA,
    scenario.populationSnapshot,
    scenario.rulebook
  );
  const allIds = report.findings.map((f) => f.id);
  const score = (resolvedFindingIds: string[]) =>
    evaluateHand({
      handType: scenario.handType,
      cards: [
        {
          id: scenario.shells[0].id,
          chips: scenario.shells[0].chips,
          mult: scenario.shells[0].mult,
        },
      ],
      ruleResults: ruleResultsFor(report, scenario.rulebook, {
        resolvedFindingIds,
      }),
    });

  it("zeroes the hand while the denominator error is uncorrected", () => {
    const result = score(allIds.filter((id) => !id.startsWith("SAP-DM-01")));
    expect(result.zeroRule.triggered).toBe(true);
    expect(result.zeroRule.ruleIds).toEqual([
      "SAP-DM-01",
      "SAP-DM-01",
      "SAP-DM-01",
    ]);
    expect(result.score).toBe(0);
  });

  it("credits +2 Mult for correcting precision, pinned against the uncorrected hand", () => {
    const withoutPrecision = allIds.filter((id) => !id.startsWith("SAP-DM-02"));
    const redlined = score(withoutPrecision);
    const corrected = score(allIds);
    // Uncorrected precision is a −1 redline; corrected it is +2: a swing of 3.
    expect(corrected.mult.total - redlined.mult.total).toBe(3);
    const precision = corrected.ruleResults.find(
      (r) => r.ruleId === "SAP-DM-02"
    );
    expect(precision).toMatchObject({ passed: true, multDelta: 2 });
  });

  it("scores the fully corrected Draft A as (15 + 30 + 12) × 8 = 456", () => {
    const result = score(allIds);
    expect(result.chips.total).toBe(57);
    expect(result.mult.total).toBe(8);
    expect(result.score).toBe(456);
    expect(result.score).toBeGreaterThanOrEqual(scenario.blind.quota);
  });

  it("scores the known view from visible findings only", () => {
    const visible = ruleResultsFor(report, scenario.rulebook, {
      resolvedFindingIds: [],
      visibleFindingIds: [],
    });
    expect(visible).toEqual([
      expect.objectContaining({
        ruleId: "SAP-DM-01",
        passed: true,
        chipsDelta: 12,
      }),
    ]);
  });
});
