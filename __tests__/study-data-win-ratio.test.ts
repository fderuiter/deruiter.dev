import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  NORMAL_QUANTILE_975,
  compareOnComponent,
  normalQuantile,
  winStatistics,
  type WinRatioComponent,
  type WinRatioResult,
  type WinRatioStratumWeighting,
  type WinRatioSubject,
} from "@/lib/study-data";

const DEATH: WinRatioComponent = {
  id: "TTDTH",
  label: "All-cause death",
  kind: "time-to-event",
  better: "higher",
};
const QOL: WinRatioComponent = {
  id: "KCCQCHG",
  label: "KCCQ change",
  kind: "continuous",
  better: "higher",
  margin: 5,
};

/**
 * Worked by hand. T1 dies on day 10, T2 is censored alive on day 100;
 * C1 is censored alive on day 50, C2 dies on day 40.
 *   T1-C1: T1 died while C1 was still followed       -> loss on death
 *   T1-C2: both died, T1 first                       -> loss on death
 *   T2-C1: nobody died; QoL change 20 vs 10, gap > 5 -> win on QoL
 *   T2-C2: C2 died while T2 was still followed       -> win on death
 */
const HAND: readonly WinRatioSubject[] = [
  {
    id: "T1",
    group: "treatment",
    outcomes: [{ value: 10, event: true }, { value: null }],
  },
  {
    id: "T2",
    group: "treatment",
    outcomes: [{ value: 100, event: false }, { value: 20 }],
  },
  {
    id: "C1",
    group: "control",
    outcomes: [{ value: 50, event: false }, { value: 10 }],
  },
  {
    id: "C2",
    group: "control",
    outcomes: [{ value: 40, event: true }, { value: null }],
  },
];

describe("compareOnComponent", () => {
  it("decides a time to an event only inside the pair's shared follow-up", () => {
    // The control was censored on day 30, before the treatment death on day 40.
    expect(
      compareOnComponent(
        DEATH,
        { value: 40, event: true },
        { value: 30, event: false }
      )
    ).toBe(0);
    expect(
      compareOnComponent(
        DEATH,
        { value: 40, event: false },
        { value: 30, event: true }
      )
    ).toBe(1);
    expect(
      compareOnComponent(
        DEATH,
        { value: 30, event: true },
        { value: 30, event: true }
      )
    ).toBe(0);
  });

  it("treats a difference equal to the margin as a tie", () => {
    expect(compareOnComponent(QOL, { value: 15 }, { value: 10 })).toBe(0);
    expect(compareOnComponent(QOL, { value: 15.5 }, { value: 10 })).toBe(1);
    expect(compareOnComponent(QOL, { value: 4 }, { value: 10 })).toBe(-1);
  });

  it("ties a missing outcome with anything", () => {
    expect(compareOnComponent(QOL, { value: null }, { value: 10 })).toBe(0);
  });

  it("compares lower-is-better outcomes and earlier-is-better events", () => {
    const sbp: WinRatioComponent = {
      id: "SYSBP",
      label: "SBP change",
      kind: "continuous",
      better: "lower",
      margin: 5,
    };
    expect(compareOnComponent(sbp, { value: -12 }, { value: -2 })).toBe(1);
    const recovery: WinRatioComponent = {
      id: "TTREC",
      label: "Time to recovery",
      kind: "time-to-event",
      better: "lower",
    };
    expect(
      compareOnComponent(
        recovery,
        { value: 5, event: true },
        { value: 9, event: false }
      )
    ).toBe(1);
    expect(
      compareOnComponent(
        recovery,
        { value: 5, event: false },
        { value: 9, event: true }
      )
    ).toBe(0);
  });
});

describe("winStatistics on a hand-worked example", () => {
  const result = winStatistics(HAND, { components: [DEATH, QOL] });

  it("counts wins, losses and ties overall and per component", () => {
    expect(result).toMatchObject({
      treatmentCount: 2,
      controlCount: 2,
      pairs: 4,
      wins: 2,
      losses: 2,
      ties: 0,
    });
    expect(result.components).toEqual([
      {
        componentId: "TTDTH",
        wins: 1,
        losses: 2,
        tiesAfter: 1,
        decidingSubjectIds: ["T1", "T2", "C1", "C2"],
      },
      {
        componentId: "KCCQCHG",
        wins: 1,
        losses: 0,
        tiesAfter: 0,
        decidingSubjectIds: ["T2", "C1"],
      },
    ]);
    expect(result.subjects.find((s) => s.id === "T2")).toEqual({
      id: "T2",
      group: "treatment",
      wins: 2,
      losses: 0,
      ties: 0,
    });
  });

  it("gives an even result as a win ratio of 1 and no net benefit", () => {
    expect(result.winRatio.estimate).toBe(1);
    expect(result.winOdds.estimate).toBe(1);
    expect(result.netBenefit.estimate).toBe(0);
    expect(result.finkelsteinSchoenfeld.statistic).toBe(0);
  });

  it("censors event times after the horizon", () => {
    const capped = winStatistics(HAND, {
      components: [{ ...DEATH, horizon: 30 }, QOL],
    });
    // Only T1's day-10 death is inside 30 days now; C2's death on day 40 is not.
    expect(capped.components[0]).toMatchObject({ wins: 0, losses: 2 });
    expect(capped.components[1]).toMatchObject({ wins: 1, losses: 0 });
  });

  it("reports the win ratio as not estimable when there are no losses", () => {
    const allWins = winStatistics(
      [
        { id: "T", group: "treatment", outcomes: [{ value: 9 }] },
        { id: "C", group: "control", outcomes: [{ value: 1 }] },
      ],
      { components: [QOL] }
    );
    expect(allWins.winRatio.estimate).toBeNull();
    expect(allWins.netBenefit).toMatchObject({
      estimate: 1,
      standardError: null,
    });
  });

  it("gives one-sided p-values in the direction of treatment benefit", () => {
    const subjects: WinRatioSubject[] = [12, 9, 15, 3, 4, 8].map(
      (value, index) => ({
        id: `S${index}`,
        group: index < 3 ? "treatment" : "control",
        outcomes: [{ value }],
      })
    );
    const component: WinRatioComponent = { ...QOL, margin: 0 };
    const two = winStatistics(subjects, { components: [component] });
    const one = winStatistics(subjects, {
      components: [component],
      sided: "one-sided",
    });
    const reversed = winStatistics(swapGroups(subjects), {
      components: [component],
      sided: "one-sided",
    });
    expect(one.netBenefit.pValue).toBeCloseTo(
      (two.netBenefit.pValue ?? 0) / 2,
      14
    );
    expect(
      (reversed.netBenefit.pValue ?? 0) + (one.netBenefit.pValue ?? 0)
    ).toBeCloseTo(1, 14);
  });

  it("leaves variances empty when a stratum has a single subject in a group", () => {
    const r = winStatistics(HAND.slice(0, 3), { components: [DEATH, QOL] });
    expect(r.winRatio).toMatchObject({
      estimate: 1,
      lower: null,
      pValue: null,
    });
    expect(r.winOdds.standardError).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(() =>
      winStatistics(HAND, { components: [DEATH, QOL], alpha: 1 })
    ).toThrow(/alpha/);
    expect(() =>
      winStatistics(HAND, { components: [{ ...DEATH, horizon: 0 }, QOL] })
    ).toThrow(/horizon/);
    expect(() => winStatistics(HAND, { components: [DEATH, DEATH] })).toThrow(
      /twice/
    );
    const broken = (outcome: { value: number | null; event?: boolean }) => [
      { ...HAND[0], outcomes: [outcome, { value: null }] },
      ...HAND.slice(1),
    ];
    expect(() =>
      winStatistics(broken({ value: -1, event: true }), {
        components: [DEATH, QOL],
      })
    ).toThrow(/negative/);
    expect(() =>
      winStatistics(broken({ value: 5 }), { components: [DEATH, QOL] })
    ).toThrow(/event flag/);
    expect(() =>
      winStatistics(broken({ value: Number.NaN, event: true }), {
        components: [DEATH, QOL],
      })
    ).toThrow(/finite/);
    expect(() =>
      winStatistics(broken({ value: 2 }), {
        components: [{ ...QOL, id: "BIN", kind: "binary" }, QOL],
      })
    ).toThrow(/0 or 1/);
    expect(() => winStatistics(HAND, { components: [] })).toThrow(RangeError);
    expect(() => winStatistics(HAND, { components: [DEATH] })).toThrow(
      /2 outcomes/
    );
    expect(() =>
      winStatistics(HAND, { components: [DEATH, { ...QOL, margin: -1 }] })
    ).toThrow(/margin/);
    expect(() =>
      winStatistics(HAND.slice(0, 2), { components: [DEATH, QOL] })
    ).toThrow(/Both groups/);
    expect(() =>
      winStatistics([...HAND, HAND[0]], { components: [DEATH, QOL] })
    ).toThrow(/twice/);
  });
});

describe("normalQuantile", () => {
  it("matches the 0.975 quantile the Kaplan-Meier limits use", () => {
    expect(normalQuantile(0.975)).toBeCloseTo(NORMAL_QUANTILE_975, 15);
  });

  it("is symmetric and accurate in the tails", () => {
    // qnorm(0.95), qnorm(1e-10) in R 4.3.
    expect(normalQuantile(0.95)).toBeCloseTo(1.6448536269514722, 14);
    expect(normalQuantile(1e-10)).toBeCloseTo(-6.3613409024040557, 12);
    expect(normalQuantile(1e-12)).toBeCloseTo(-7.034483825301132, 12);
    expect(normalQuantile(0.3)).toBeCloseTo(-normalQuantile(0.7), 15);
    expect(() => normalQuantile(1)).toThrow(RangeError);
  });
});

const subjectArbitrary = (index: number) =>
  fc
    .record({
      group: fc.constantFrom<"treatment" | "control">("treatment", "control"),
      stratum: fc.constantFrom("A", "B"),
      time: fc.integer({ min: 1, max: 60 }),
      event: fc.boolean(),
      score: fc.option(fc.integer({ min: -20, max: 20 }), { nil: null }),
    })
    .map(({ group, stratum, time, event, score }): WinRatioSubject => ({
      id: `S${index}`,
      group,
      stratum,
      outcomes: [{ value: time, event }, { value: score }],
    }));

const datasetArbitrary = fc
  .integer({ min: 4, max: 24 })
  .chain((size) =>
    fc.tuple(
      ...Array.from({ length: size }, (_, index) => subjectArbitrary(index))
    )
  )
  .filter((subjects) =>
    ["A", "B"].every(
      (stratum) =>
        subjects.filter((s) => s.stratum === stratum && s.group === "treatment")
          .length > 1 &&
        subjects.filter((s) => s.stratum === stratum && s.group === "control")
          .length > 1
    )
  );

const weightingArbitrary = fc.constantFrom<WinRatioStratumWeighting>(
  "unstratified",
  "mantel-haenszel",
  "equal"
);

function swapGroups(subjects: readonly WinRatioSubject[]): WinRatioSubject[] {
  return subjects.map((s) => ({
    ...s,
    group: s.group === "treatment" ? "control" : "treatment",
  }));
}

describe("winStatistics properties", () => {
  const components = [DEATH, QOL];

  it("adds up: wins, losses and ties make the pairs, components make the wins", () => {
    fc.assert(
      fc.property(
        datasetArbitrary,
        weightingArbitrary,
        (subjects, weighting) => {
          const r = winStatistics(subjects, { components, weighting });
          expect(r.wins + r.losses + r.ties).toBe(r.pairs);
          expect(r.components.reduce((sum, c) => sum + c.wins, 0)).toBe(r.wins);
          expect(r.components.reduce((sum, c) => sum + c.losses, 0)).toBe(
            r.losses
          );
          expect(r.components.at(-1)?.tiesAfter).toBe(r.ties);
          const treatmentWins = r.subjects
            .filter((s) => s.group === "treatment")
            .reduce((sum, s) => sum + s.wins, 0);
          expect(treatmentWins).toBe(r.wins);
        }
      )
    );
  });

  it("inverts when the groups are swapped", () => {
    fc.assert(
      fc.property(
        datasetArbitrary,
        weightingArbitrary,
        (subjects, weighting) => {
          const a = winStatistics(subjects, { components, weighting });
          const b = winStatistics(swapGroups(subjects), {
            components,
            weighting,
          });
          expect(b.wins).toBe(a.losses);
          expect(b.netBenefit.estimate).toBeCloseTo(
            -(a.netBenefit.estimate ?? 0),
            12
          );
          if (a.winOdds.estimate !== null && b.winOdds.estimate !== null) {
            expect(a.winOdds.estimate * b.winOdds.estimate).toBeCloseTo(1, 12);
          }
          if (a.winRatio.pValue !== null && b.winRatio.pValue !== null) {
            expect(b.winRatio.pValue).toBeCloseTo(a.winRatio.pValue, 10);
          }
          expect(
            b.finkelsteinSchoenfeld.statistic +
              a.finkelsteinSchoenfeld.statistic
          ).toBe(0);
          expect(b.finkelsteinSchoenfeld.variance).toBeCloseTo(
            a.finkelsteinSchoenfeld.variance,
            9
          );
        }
      )
    );
  });

  it("does not depend on the order of the subjects", () => {
    fc.assert(
      fc.property(
        datasetArbitrary,
        weightingArbitrary,
        (subjects, weighting) => {
          const a = winStatistics(subjects, { components, weighting });
          const b = winStatistics([...subjects].reverse(), {
            components,
            weighting,
          });
          expect(b.winRatio.estimate).toBe(a.winRatio.estimate);
          expect(b.winRatio.standardError).toBeCloseTo(
            a.winRatio.standardError ?? 0,
            10
          );
          expect(b.finkelsteinSchoenfeld.variance).toBeCloseTo(
            a.finkelsteinSchoenfeld.variance,
            9
          );
        }
      )
    );
  });

  it("is unchanged by a component on which every pair ties", () => {
    const flat: WinRatioComponent = {
      id: "FLAT",
      label: "Always the same",
      kind: "binary",
      better: "higher",
    };
    fc.assert(
      fc.property(datasetArbitrary, (subjects) => {
        const a = winStatistics(subjects, { components });
        const padded = subjects.map((s) => ({
          ...s,
          outcomes: [{ value: 1 }, ...s.outcomes],
        }));
        const b = winStatistics(padded, { components: [flat, ...components] });
        expect(b.wins).toBe(a.wins);
        expect(b.losses).toBe(a.losses);
        expect(b.winRatio.standardError).toBe(a.winRatio.standardError);
      })
    );
  });

  it("equals the treatment-control win difference in the Finkelstein-Schoenfeld total", () => {
    fc.assert(
      fc.property(datasetArbitrary, (subjects) => {
        const r = winStatistics(subjects, { components });
        expect(r.finkelsteinSchoenfeld.statistic).toBe(r.wins - r.losses);
      })
    );
  });
});

interface ReferenceEstimate {
  readonly [key: string]: number;
}

interface ReferenceFixture {
  readonly name: string;
  readonly reference: { readonly r: string; readonly wins: string };
  readonly settings: {
    readonly weighting: "unstratified" | "MH-type" | "equal";
    readonly alpha: number;
    readonly sided: "two-sided";
  };
  readonly components: readonly {
    readonly kind: "tte" | "continuous" | "binary";
    readonly better: "larger" | "smaller";
    readonly margin: number;
    readonly horizon?: number;
  }[];
  readonly subjects: readonly {
    readonly id: number;
    readonly arm: 1 | 2;
    readonly stratum: number;
    readonly values: readonly number[];
    readonly events: readonly (number | null)[];
  }[];
  readonly expected: {
    readonly per_endpoint: readonly {
      readonly wins: number;
      readonly losses: number;
    }[];
    readonly win_ratio: ReferenceEstimate;
    readonly net_benefit: ReferenceEstimate;
    readonly win_odds: ReferenceEstimate;
    readonly z: ReferenceEstimate;
    readonly p: ReferenceEstimate;
    readonly finkelstein_schoenfeld: {
      readonly statistic: number;
      readonly variance: number;
      readonly z: number;
      readonly p_two_sided: number;
    };
  };
}

const FIXTURE_DIR = path.resolve(
  process.cwd(),
  "__tests__/fixtures/study-data/win-ratio"
);

const KIND = {
  tte: "time-to-event",
  continuous: "continuous",
  binary: "binary",
} as const;

const WEIGHTING = {
  unstratified: "unstratified",
  "MH-type": "mantel-haenszel",
  equal: "equal",
} as const;

/** Relative tolerance for estimates, limits and tests against WINS. */
const RELATIVE_TOLERANCE = 1e-12;

function expectClose(actual: number | null, expected: number): void {
  expect(actual).not.toBeNull();
  const scale = Math.max(1, Math.abs(expected));
  expect(Math.abs((actual ?? NaN) - expected)).toBeLessThanOrEqual(
    RELATIVE_TOLERANCE * scale
  );
}

function runFixture(fixture: ReferenceFixture): WinRatioResult {
  const components: WinRatioComponent[] = fixture.components.map(
    (c, index) => ({
      id: `EP${index + 1}`,
      label: `Endpoint ${index + 1}`,
      kind: KIND[c.kind],
      better: c.better === "larger" ? "higher" : "lower",
      margin: c.margin,
      ...(c.kind === "tte" && c.horizon !== undefined
        ? { horizon: c.horizon }
        : {}),
    })
  );
  const subjects: WinRatioSubject[] = fixture.subjects.map((s) => ({
    id: String(s.id),
    group: s.arm === 1 ? "treatment" : "control",
    stratum: String(s.stratum),
    outcomes: components.map((component, index) =>
      component.kind === "time-to-event"
        ? { value: s.values[index], event: s.events[index] === 1 }
        : { value: s.values[index] }
    ),
  }));
  return winStatistics(subjects, {
    components,
    weighting: WEIGHTING[fixture.settings.weighting],
    alpha: fixture.settings.alpha,
    sided: fixture.settings.sided,
  });
}

const fixtures: ReferenceFixture[] = readdirSync(FIXTURE_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) =>
    JSON.parse(readFileSync(path.join(FIXTURE_DIR, file), "utf8"))
  );

describe("parity with R (WINS win.stat and a separate Finkelstein-Schoenfeld)", () => {
  it("has the committed reference fixtures", () => {
    expect(fixtures.map((f) => f.name)).toEqual([
      "bp-fixed-window",
      "cv-stratified-equal",
      "cv-stratified-mh",
      "cv-unstratified",
      "recovery-earlier-better",
    ]);
  });

  describe.each(fixtures.map((f) => [f.name, f] as const))(
    "%s",
    (_, fixture) => {
      const result = runFixture(fixture);
      const { expected } = fixture;

      it("matches the per-component win and loss counts exactly", () => {
        expect(
          result.components.map(({ wins, losses }) => ({ wins, losses }))
        ).toEqual(expected.per_endpoint);
      });

      it("matches the win ratio, net benefit and win odds with their limits", () => {
        expectClose(result.winRatio.estimate, expected.win_ratio.WR);
        expectClose(result.winRatio.lower, expected.win_ratio.WR_L);
        expectClose(result.winRatio.upper, expected.win_ratio.WR_U);
        expectClose(result.netBenefit.estimate, expected.net_benefit.NB);
        expectClose(result.netBenefit.lower, expected.net_benefit.NB_L);
        expectClose(result.netBenefit.upper, expected.net_benefit.NB_U);
        expectClose(result.winOdds.estimate, expected.win_odds.WO);
        expectClose(result.winOdds.lower, expected.win_odds.WO_L);
        expectClose(result.winOdds.upper, expected.win_odds.WO_U);
      });

      it("matches the z statistics and two-sided p-values", () => {
        expectClose(result.winRatio.zStatistic, expected.z.zstat_WR);
        expectClose(result.netBenefit.zStatistic, expected.z.zstat_NB);
        expectClose(result.winOdds.zStatistic, expected.z.zstat_WO);
        expectClose(result.winRatio.pValue, expected.p.pvalue_WR);
        expectClose(result.netBenefit.pValue, expected.p.pvalue_NB);
        expectClose(result.winOdds.pValue, expected.p.pvalue_WO);
      });

      it("matches the Finkelstein-Schoenfeld test", () => {
        const fs = result.finkelsteinSchoenfeld;
        expect(fs.statistic).toBe(expected.finkelstein_schoenfeld.statistic);
        expectClose(fs.variance, expected.finkelstein_schoenfeld.variance);
        expectClose(fs.zStatistic, expected.finkelstein_schoenfeld.z);
        expectClose(fs.pValue, expected.finkelstein_schoenfeld.p_two_sided);
      });
    }
  );
});
