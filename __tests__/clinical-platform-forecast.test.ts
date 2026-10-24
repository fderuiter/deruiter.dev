import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  FORECAST_DEFAULT_RUNS,
  FORECAST_DEFAULT_SEED,
  buildWarehouse,
  fitRecruitmentPrior,
  forecastEnrollment,
  generatePortfolio,
  posteriorRate,
  recruitmentLogLikelihood,
  simulateEnrollmentCompletion,
  type EnrollmentSimulationInput,
  type SiteExposure,
} from "@/lib/clinical-platform";

const portfolio = generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED });
const warehouse = buildWarehouse(portfolio);

/** A rate that is all but fixed: a gamma with a huge shape. */
const fixed = (perDay: number) => ({ shape: 1e7, rate: 1e7 / perDay });

/** P(X ≥ k) for X ~ Poisson(mean), by summing the pmf below k. */
function poissonTail(mean: number, k: number): number {
  let pmf = Math.exp(-mean);
  let below = 0;
  for (let j = 0; j < k; j += 1) {
    below += pmf;
    pmf *= mean / (j + 1);
  }
  return 1 - below;
}

/**
 * P(N ≥ k) for a site whose rate is Gamma(a, b), over t days: N is negative
 * binomial with pmf Γ(a + j) / (Γ(a) j!) · p^a (1 − p)^j, p = b / (b + t).
 */
function negativeBinomialTail(a: number, b: number, t: number, k: number) {
  const p = b / (b + t);
  let pmf = p ** a;
  let below = 0;
  for (let j = 0; j < k; j += 1) {
    below += pmf;
    pmf *= ((a + j) / (j + 1)) * (1 - p);
  }
  return 1 - below;
}

/** Share of sorted times at or below `t`. */
const shareBy = (times: readonly number[], t: number) =>
  times.filter((x) => x <= t).length / times.length;

/** Four standard errors of a share estimated from `n` runs, plus a hair. */
const tolerance = (p: number, n: number) =>
  4 * Math.sqrt((p * (1 - p)) / n) + 1e-3;

const base: EnrollmentSimulationInput = {
  remaining: 50,
  sites: [fixed(0.5)],
  laterSites: [],
  runs: 4000,
  streamKey: "test:fixed",
};

describe("enrollment simulation against analytic cases (#2632)", () => {
  it("matches the gamma waiting time of a site with a known rate", () => {
    // With a fixed rate λ the 50th subject arrives by t exactly when a
    // Poisson(λt) count reaches 50.
    const times = simulateEnrollmentCompletion(base);
    for (const t of [80, 100, 120]) {
      const expected = poissonTail(0.5 * t, 50);
      expect(Math.abs(shareBy(times, t) - expected), `t = ${t}`).toBeLessThan(
        tolerance(expected, base.runs)
      );
    }
  });

  it("matches the negative binomial count of a site with a gamma rate", () => {
    const times = simulateEnrollmentCompletion({
      ...base,
      remaining: 20,
      sites: [{ shape: 3, rate: 6 }],
      streamKey: "test:gamma",
    });
    for (const t of [20, 40, 80]) {
      const expected = negativeBinomialTail(3, 6, t, 20);
      expect(Math.abs(shareBy(times, t) - expected), `t = ${t}`).toBeLessThan(
        tolerance(expected, base.runs)
      );
    }
  });

  it("adds a later site's rate from its start day", () => {
    // Λ(t) = 0.2 t + 0.6 (t − 30)⁺.
    const times = simulateEnrollmentCompletion({
      ...base,
      remaining: 30,
      sites: [fixed(0.2)],
      laterSites: [{ ...fixed(0.6), startDay: 30 }],
      streamKey: "test:later",
    });
    for (const t of [40, 50, 60]) {
      const expected = poissonTail(0.2 * t + 0.6 * Math.max(0, t - 30), 30);
      expect(Math.abs(shareBy(times, t) - expected), `t = ${t}`).toBeLessThan(
        tolerance(expected, base.runs)
      );
    }
  });

  it("gives the same runs for the same stream key, and others for another", () => {
    const again = simulateEnrollmentCompletion(base);
    expect(again).toEqual(simulateEnrollmentCompletion(base));
    expect(
      simulateEnrollmentCompletion({ ...base, streamKey: "test:other" })
    ).not.toEqual(again);
  });

  it("never brings completion later by adding sites", () => {
    // Each run shares its base rates and arrivals with the baseline, so
    // every run, and so every order statistic, can only move earlier.
    const input = { ...base, sites: [{ shape: 2, rate: 4 }], runs: 500 };
    const baseline = simulateEnrollmentCompletion(input);
    const more = simulateEnrollmentCompletion({
      ...input,
      laterSites: [{ shape: 2, rate: 4, startDay: 10 }],
    });
    more.forEach((t, i) => expect(t).toBeLessThanOrEqual(baseline[i]));
    expect(more[250]).toBeLessThan(baseline[250]);
  });

  it("refuses inputs outside their domain", () => {
    const run = (patch: Partial<EnrollmentSimulationInput>) => () =>
      simulateEnrollmentCompletion({ ...base, ...patch });
    expect(run({ remaining: 0 })).toThrow(RangeError);
    expect(run({ remaining: 2.5 })).toThrow(RangeError);
    expect(run({ runs: 99 })).toThrow(RangeError);
    expect(run({ runs: 20_001 })).toThrow(RangeError);
    expect(run({ sites: [] })).toThrow(RangeError);
    expect(run({ sites: [{ shape: 0, rate: 1 }] })).toThrow(RangeError);
    expect(run({ sites: [{ shape: 1, rate: Number.NaN }] })).toThrow(
      RangeError
    );
    expect(run({ laterSites: [{ shape: 1, rate: 1, startDay: -1 }] })).toThrow(
      RangeError
    );
  });
});

describe("the Poisson-gamma prior (#2632)", () => {
  const spread: SiteExposure[] = [
    { enrolled: 2, exposureDays: 300 },
    { enrolled: 9, exposureDays: 320 },
    { enrolled: 5, exposureDays: 200 },
    { enrolled: 14, exposureDays: 410 },
    { enrolled: 0, exposureDays: 150 },
    { enrolled: 7, exposureDays: 260 },
  ];

  it("puts the mean at the pooled rate when every site has the same exposure", () => {
    // For equal τ the rate's score equation gives α / β = Σn / (m τ),
    // whatever the shape.
    const sites = [3, 8, 1, 12, 6].map((enrolled) => ({
      enrolled,
      exposureDays: 365,
    }));
    const prior = fitRecruitmentPrior(sites);
    expect(prior.shape / prior.rate).toBeCloseTo(30 / (5 * 365), 9);
  });

  it("finds a maximum of the likelihood", () => {
    const prior = fitRecruitmentPrior(spread);
    const best = recruitmentLogLikelihood(spread, prior);
    for (const [ds, dr] of [
      [1.05, 1],
      [0.95, 1],
      [1, 1.05],
      [1, 0.95],
      [1.05, 1.05],
      [0.95, 0.95],
    ]) {
      expect(
        recruitmentLogLikelihood(spread, {
          shape: prior.shape * ds,
          rate: prior.rate * dr,
        })
      ).toBeLessThan(best);
    }
  });

  it("drives the shape up when every site recruits at one rate", () => {
    const prior = fitRecruitmentPrior(
      [100, 200, 300, 400].map((d) => ({ enrolled: d / 50, exposureDays: d }))
    );
    expect(prior.shape).toBeGreaterThan(1000);
    expect(prior.shape / prior.rate).toBeCloseTo(0.02, 6);
  });

  it("finds a maximum for any spread of sites (property)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            enrolled: fc.integer({ min: 0, max: 60 }),
            exposureDays: fc.integer({ min: 30, max: 900 }),
          }),
          { minLength: 3, maxLength: 20 }
        ),
        (sites) => {
          fc.pre(sites.some((s) => s.enrolled > 0));
          const prior = fitRecruitmentPrior(sites);
          const best = recruitmentLogLikelihood(sites, prior);
          expect(Number.isFinite(best)).toBe(true);
          for (const f of [0.9, 1.1]) {
            expect(
              recruitmentLogLikelihood(sites, {
                shape: prior.shape,
                rate: prior.rate * f,
              })
            ).toBeLessThanOrEqual(best + 1e-9);
          }
        }
      ),
      { seed: 2632, numRuns: 100 }
    );
  });

  it("updates a site's rate with its own enrollment", () => {
    expect(
      posteriorRate({ shape: 2, rate: 100 }, { enrolled: 6, exposureDays: 300 })
    ).toEqual({ shape: 8, rate: 400 });
  });

  it("refuses sites that cannot identify a prior", () => {
    expect(() => fitRecruitmentPrior([spread[0]])).toThrow(RangeError);
    expect(() =>
      fitRecruitmentPrior([
        { enrolled: 0, exposureDays: 100 },
        { enrolled: 0, exposureDays: 200 },
      ])
    ).toThrow(RangeError);
    expect(() =>
      fitRecruitmentPrior([...spread, { enrolled: 1, exposureDays: 0 }])
    ).toThrow(RangeError);
    expect(() =>
      fitRecruitmentPrior([...spread, { enrolled: -1, exposureDays: 10 }])
    ).toThrow(RangeError);
  });
});

describe("the study enrollment forecast (#2632)", () => {
  const enrolling = warehouse.tables["gold.dim_study"]
    .filter((s) => s.study_status === "enrolling")
    .map((s) => String(s.study_id));

  it("forecasts the studies still enrolling at the data cut", () => {
    expect(enrolling).toEqual(["DEMO-302", "DEV-402"]);
  });

  it("counts the study's enrollment and fits every recruiting site", () => {
    for (const studyId of enrolling) {
      const f = forecastEnrollment(warehouse, studyId);
      const study = warehouse.tables["gold.dim_study"].find(
        (s) => s.study_id === studyId
      )!;
      const enrolled = warehouse.tables["gold.fct_enrollment"].filter(
        (e) => e.study_key === study.study_key && e.event_type === "enrolled"
      ).length;
      expect(f.enrolled).toBe(enrolled);
      expect(f.sites.reduce((sum, s) => sum + s.enrolled, 0)).toBe(enrolled);
      expect(f.target).toBe(study.planned_enrollment);
      expect(f.runs).toBe(FORECAST_DEFAULT_RUNS);
      expect(f.seed).toBe(FORECAST_DEFAULT_SEED);
      for (const site of f.sites) {
        expect(site.posterior).toEqual(posteriorRate(f.prior, site));
      }
    }
  });

  it("reads quantiles and a curve that agree with each other", () => {
    for (const studyId of enrolling) {
      const f = forecastEnrollment(warehouse, studyId);
      expect(f.dataCut < f.quantiles.p10).toBe(true);
      expect(f.quantiles.p10 <= f.quantiles.p50).toBe(true);
      expect(f.quantiles.p50 <= f.quantiles.p90).toBe(true);
      const completed = f.curve.map((p) => p.completed);
      completed
        .slice(1)
        .forEach((c, i) => expect(c).toBeGreaterThanOrEqual(completed[i]));
      expect(completed.at(-1)).toBeGreaterThanOrEqual(0.99);
      expect(f.probabilityByPlan).toBeGreaterThanOrEqual(0);
      expect(f.probabilityByPlan).toBeLessThanOrEqual(1);
      // The first curve point at or after the median holds half the runs.
      const atMedian = f.curve.find((p) => p.on >= f.quantiles.p50)!;
      expect(atMedian.completed).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("lets a site activated on the data cut recruit at the prior", () => {
    const baseline = forecastEnrollment(warehouse, "DEV-402");
    const fresh =
      baseline.sites.find((s) => s.enrolled === 0) ?? baseline.sites[0];
    const keys = new Set(
      warehouse.tables["gold.dim_site"]
        .filter((s) => s.site_id === fresh.siteId)
        .map((s) => s.site_key)
    );
    const moved = {
      ...warehouse,
      tables: {
        ...warehouse.tables,
        "gold.dim_site": warehouse.tables["gold.dim_site"].map((s) =>
          s.site_id === fresh.siteId
            ? { ...s, activated_on: warehouse.asOf }
            : s
        ),
        "gold.fct_enrollment": warehouse.tables["gold.fct_enrollment"].filter(
          (e) => !keys.has(e.site_key)
        ),
      },
    };
    const f = forecastEnrollment(moved, "DEV-402");
    const site = f.sites.find((s) => s.siteId === fresh.siteId)!;
    expect(site).toMatchObject({ enrolled: 0, exposureDays: 0 });
    expect(site.posterior).toEqual(f.prior);
    expect(f.prior).toEqual(
      fitRecruitmentPrior(f.sites.filter((s) => s.siteId !== fresh.siteId))
    );
  });

  it("gives no chance of meeting a planned date that has already passed", () => {
    const behind = portfolio.signals.find(
      (s) => s.kind === "study-behind-plan"
    )!;
    const f = forecastEnrollment(warehouse, behind.studyId!);
    expect(f.plannedLastSubjectIn < f.dataCut).toBe(true);
    expect(f.probabilityByPlan).toBe(0);
  });

  it("is the same forecast for the same seed", () => {
    expect(forecastEnrollment(warehouse, "DEV-402")).toEqual(
      forecastEnrollment(warehouse, "DEV-402")
    );
    expect(
      forecastEnrollment(warehouse, "DEV-402", { seed: 7 }).quantiles
    ).not.toEqual(forecastEnrollment(warehouse, "DEV-402").quantiles);
  });

  it("brings completion earlier with what-if sites at the country's rate", () => {
    const baseline = forecastEnrollment(warehouse, "DEMO-302");
    const country = baseline.sites[0].countryCode;
    const whatIf = { countryCode: country, sites: 5, activationDelayDays: 60 };
    const more = forecastEnrollment(warehouse, "DEMO-302", { whatIf });
    expect(more.whatIf).toEqual(whatIf);
    expect(more.quantiles.p50 < baseline.quantiles.p50).toBe(true);
    expect(more.quantiles.p90 <= baseline.quantiles.p90).toBe(true);
    // The country's sites pooled and shrunk to the prior: (α + Σn) / (β + Στ).
    const local = baseline.sites.filter((s) => s.countryCode === country);
    const mean =
      (baseline.prior.shape + local.reduce((t, s) => t + s.enrolled, 0)) /
      (baseline.prior.rate + local.reduce((t, s) => t + s.exposureDays, 0));
    expect(more.whatIfSiteRate!.shape).toBe(baseline.prior.shape);
    expect(more.whatIfSiteRate!.shape / more.whatIfSiteRate!.rate).toBeCloseTo(
      mean,
      12
    );
    // A country with no sites gets the prior unchanged.
    const elsewhere = forecastEnrollment(warehouse, "DEMO-302", {
      whatIf: { ...whatIf, countryCode: "NZ" },
    });
    expect(elsewhere.whatIfSiteRate!.shape).toBe(baseline.prior.shape);
    expect(elsewhere.whatIfSiteRate!.rate).toBeCloseTo(baseline.prior.rate, 9);
  });

  it("refuses a study with nothing to forecast and bad options", () => {
    expect(() => forecastEnrollment(warehouse, "NOPE")).toThrow(
      "unknown study NOPE"
    );
    expect(() => forecastEnrollment(warehouse, "DEMO-101")).toThrow(
      /nothing to forecast/
    );
    const whatIf = { countryCode: "US", sites: 5, activationDelayDays: 60 };
    for (const bad of [
      { ...whatIf, countryCode: "us" },
      { ...whatIf, sites: 0 },
      { ...whatIf, sites: 51 },
      { ...whatIf, activationDelayDays: -1 },
      { ...whatIf, activationDelayDays: 366 },
    ]) {
      expect(() =>
        forecastEnrollment(warehouse, "DEV-402", { whatIf: bad })
      ).toThrow(RangeError);
    }
    expect(() =>
      forecastEnrollment(warehouse, "DEV-402", { seed: -1 })
    ).toThrow(RangeError);
    expect(() =>
      forecastEnrollment(warehouse, "DEV-402", { runs: 10 })
    ).toThrow(RangeError);
  });
});
