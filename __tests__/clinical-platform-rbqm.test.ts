import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CSM_TESTS,
  DEFAULT_PORTFOLIO_SEED,
  KRI_LIBRARY,
  METRIC_REGISTRY,
  QTL_LIBRARY,
  RISK_SIGNAL_ACTIONS,
  WAREHOUSE_SCHEMA,
  appendRiskSignal,
  assessStudyRisk,
  benjaminiHochberg,
  buildWarehouse,
  centralMonitoring,
  checkRegulatoryWording,
  chiSquareCdf,
  checkRiskSignalLog,
  evaluateMetric,
  fCdf,
  findClinicalClaims,
  generatePortfolio,
  invertMatrix,
  logGamma,
  poissonCdf,
  qualityPlan,
  raiseRiskSignals,
  regularizedBeta,
  regularizedGammaP,
  riskSignalStates,
  type RiskSignalLogEntry,
  type RiskSignalLogInput,
} from "@/lib/clinical-platform";

const portfolio = generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED });
const warehouse = buildWarehouse(portfolio);
const studyIds = warehouse.tables["gold.dim_study"].map((s) =>
  String(s.study_id)
);
const metric = (id: string) => METRIC_REGISTRY.find((m) => m.id === id)!;

/** Sites that carry a planted signal, by kind. */
const planted = new Map(
  portfolio.signals
    .filter((s) => s.siteId !== null)
    .map((s) => [s.siteId!, s.kind])
);
const integritySite = [...planted].find(([, k]) => k === "data-integrity")![0];

describe("RBQM statistics against textbook values (#2631)", () => {
  it("computes the log gamma function", () => {
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 12);
    expect(logGamma(10)).toBeCloseTo(Math.log(362_880), 10);
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 12);
    expect(logGamma(0.1)).toBeCloseTo(Math.log(9.513507698668732), 10);
  });

  it("computes the regularized incomplete gamma and beta functions", () => {
    // P(1, x) = 1 − e^−x.
    expect(regularizedGammaP(1, 2)).toBeCloseTo(1 - Math.exp(-2), 12);
    // P(3, x) = 1 − e^−x (1 + x + x²/2).
    expect(regularizedGammaP(3, 10)).toBeCloseTo(1 - 61 * Math.exp(-10), 12);
    // I_x(a, b) for whole a, b is a binomial tail: P(Bin(a+b−1, x) ≥ a).
    expect(regularizedBeta(0.5, 2, 3)).toBeCloseTo(0.6875, 12);
    expect(regularizedBeta(0.3, 2, 5)).toBeCloseTo(
      1 - 0.7 ** 6 - 6 * 0.3 * 0.7 ** 5,
      12
    );
  });

  it("computes Poisson and F distribution functions", () => {
    expect(poissonCdf(0, 2)).toBeCloseTo(0.1353352832, 9);
    expect(poissonCdf(1, 2)).toBeCloseTo(0.4060058497, 9);
    expect(poissonCdf(3, 2)).toBeCloseTo(0.8571234605, 9);
    expect(poissonCdf(10, 10)).toBeCloseTo(0.5830397502, 9);
    expect(poissonCdf(-1, 2)).toBe(0);
    expect(poissonCdf(4, 0)).toBe(1);
    // Upper 5% points from standard F tables.
    expect(fCdf(3.478, 4, 10)).toBeCloseTo(0.95, 3);
    expect(fCdf(2.711, 5, 20)).toBeCloseTo(0.95, 3);
    expect(fCdf(0, 4, 10)).toBe(0);
  });

  it("computes the chi-square distribution function (#2955)", () => {
    // Upper 5% and 1% points from standard chi-square tables.
    expect(chiSquareCdf(3.841, 1)).toBeCloseTo(0.95, 4);
    expect(chiSquareCdf(18.307, 10)).toBeCloseTo(0.95, 4);
    expect(chiSquareCdf(16.812, 6)).toBeCloseTo(0.99, 4);
    // With 2 degrees of freedom it is an exponential: 1 − e^(−x/2).
    expect(chiSquareCdf(5, 2)).toBeCloseTo(1 - Math.exp(-2.5), 12);
    expect(chiSquareCdf(0, 3)).toBe(0);
    expect(() => chiSquareCdf(1, 0)).toThrow(RangeError);
    expect(() => chiSquareCdf(Number.NaN, 2)).toThrow(RangeError);
  });

  it("reproduces the Benjamini-Hochberg worked example", () => {
    // Benjamini & Hochberg (1995), section 4: 15 p-values, q = 0.05.
    const p = [
      0.0001, 0.0004, 0.0019, 0.0095, 0.0201, 0.0278, 0.0298, 0.0344, 0.0459,
      0.324, 0.4262, 0.5719, 0.6528, 0.759, 1,
    ];
    const adjusted = benjaminiHochberg(p);
    expect(adjusted.filter((q) => q <= 0.05)).toHaveLength(4);
    expect(adjusted[0]).toBeCloseTo(0.0015, 10);
    expect(adjusted[3]).toBeCloseTo(0.035625, 10);
    expect(benjaminiHochberg([])).toEqual([]);
  });

  it("inverts a matrix and refuses a singular one", () => {
    const inverse = invertMatrix([
      [4, 7],
      [2, 6],
    ])!;
    expect(inverse[0][0]).toBeCloseTo(0.6, 12);
    expect(inverse[0][1]).toBeCloseTo(-0.7, 12);
    expect(inverse[1][0]).toBeCloseTo(-0.2, 12);
    expect(inverse[1][1]).toBeCloseTo(0.4, 12);
    expect(
      invertMatrix([
        [1, 2],
        [2, 4],
      ])
    ).toBeNull();
    expect(() => invertMatrix([[1, 2]])).toThrow(RangeError);
  });

  it("throws at the edge of every domain instead of returning NaN", () => {
    expect(() => logGamma(0)).toThrow(RangeError);
    expect(() => logGamma(Number.NaN)).toThrow(RangeError);
    expect(() => regularizedGammaP(1, -1)).toThrow(RangeError);
    expect(() => regularizedBeta(1.5, 1, 1)).toThrow(RangeError);
    expect(() => poissonCdf(1, -0.1)).toThrow(RangeError);
    expect(() => fCdf(1, 0, 3)).toThrow(RangeError);
    expect(() => benjaminiHochberg([0.5, 1.2])).toThrow(RangeError);
  });
});

describe("RBQM statistics, properties (#2631)", () => {
  const options = { seed: 2631, numRuns: 200 };
  const probability = fc.double({ min: 0, max: 1, noNaN: true });

  it("keeps adjusted p-values in order, at or above the raw value and at most 1", () => {
    fc.assert(
      fc.property(fc.array(probability, { maxLength: 40 }), (p) => {
        const q = benjaminiHochberg(p);
        const byP = p.map((v, i) => [v, q[i]]).sort((a, b) => a[0] - b[0]);
        return (
          q.every((v, i) => v >= p[i] - 1e-15 && v <= 1) &&
          byP.every((pair, i) => i === 0 || pair[1] >= byP[i - 1][1])
        );
      }),
      options
    );
  });

  it("gives a Poisson CDF that rises with k and stays in [0, 1]", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.double({ min: 0, max: 150, noNaN: true }),
        (k, mean) => {
          const low = poissonCdf(k, mean);
          const high = poissonCdf(k + 1, mean);
          return low >= 0 && high <= 1 && high >= low - 1e-12;
        }
      ),
      options
    );
  });

  it("satisfies the incomplete beta symmetry I_x(a, b) = 1 − I_(1−x)(b, a)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 0.999, noNaN: true }),
        fc.double({ min: 0.2, max: 40, noNaN: true }),
        fc.double({ min: 0.2, max: 40, noNaN: true }),
        (x, a, b) =>
          Math.abs(
            regularizedBeta(x, a, b) - (1 - regularizedBeta(1 - x, b, a))
          ) < 1e-9
      ),
      options
    );
  });
});

describe("the RBQM library (#2631)", () => {
  it("builds every KRI and QTL on a certified registry metric", () => {
    for (const id of [
      ...KRI_LIBRARY.flatMap((k) => [k.metricId, k.minimum.metricId]),
      ...QTL_LIBRARY.map((q) => q.metricId),
    ]) {
      expect(metric(id)?.status, id).toBe("certified");
    }
  });

  it("orders each KRI's thresholds the way its risk runs, and gives a reason", () => {
    for (const kri of KRI_LIBRARY) {
      if (kri.direction === "high") expect(kri.red).toBeGreaterThan(kri.amber);
      else expect(kri.red).toBeLessThan(kri.amber);
      expect(kri.reason.length, kri.id).toBeGreaterThan(40);
    }
    for (const qtl of QTL_LIBRARY) {
      expect(qtl.rationale.length).toBeGreaterThan(40);
      expect(qtl.response.length).toBeGreaterThan(40);
    }
  });

  it("reads only gold columns that exist", () => {
    const columns = new Set(
      WAREHOUSE_SCHEMA.tables
        .filter((t) => t.layer === "gold")
        .flatMap((t) => t.columns.map((c) => `gold.${t.name}.${c.name}`))
    );
    for (const test of CSM_TESTS) {
      for (const read of test.reads) expect(columns.has(read), read).toBe(true);
    }
  });

  it("links every critical-to-quality factor to the library, or names its gap", () => {
    const kris = new Set(KRI_LIBRARY.map((k) => k.id));
    const qtls = new Set(QTL_LIBRARY.map((q) => q.id));
    for (const productType of ["drug", "device"]) {
      const plan = qualityPlan("X-1", productType, "2025-01-01");
      expect(plan.synthetic).toBe(true);
      expect(plan.qtls.map((q) => q.qtlId).every((id) => qtls.has(id))).toBe(
        true
      );
      for (const q of plan.qtls)
        expect(q.limit).toBeGreaterThan(q.secondaryLimit);
      for (const factor of plan.factors) {
        for (const id of factor.kriIds) expect(kris.has(id), id).toBe(true);
        for (const id of factor.qtlIds) expect(qtls.has(id), id).toBe(true);
        const watched = factor.kriIds.length + factor.qtlIds.length > 0;
        expect(watched || factor.gap !== null, factor.id).toBe(true);
      }
      // Every KRI watches some factor.
      const used = new Set(plan.factors.flatMap((f) => f.kriIds));
      expect([...kris].filter((id) => !used.has(id))).toEqual([]);
    }
    const safety = qualityPlan("X-1", "device", "2025-01-01").factors.find(
      (f) => f.id === "ctq-safety-reporting"
    )!;
    expect(safety.name).toContain("device deficiency");
    expect(safety.gap?.issue).toBe(2776);
  });

  it("makes no compliance or validation claim", () => {
    const text = [
      ...KRI_LIBRARY.flatMap((k) => [k.name, k.reason]),
      ...QTL_LIBRARY.flatMap((q) => [q.name, q.rationale, q.response]),
      ...CSM_TESTS.flatMap((t) => [t.name, t.question, t.method]),
      ...qualityPlan("X-1", "drug", "2025-01-01").factors.flatMap((f) => [
        f.name,
        f.risk,
        f.gap?.reason ?? "",
      ]),
    ].join("\n");
    expect(checkRegulatoryWording(text)).toEqual([]);
    expect(findClinicalClaims(text)).toEqual([]);
  });
});

describe("central statistical monitoring (#2631)", () => {
  const runs = new Map(
    studyIds.map((id) => [id, centralMonitoring(warehouse, id)])
  );
  const flaggedTests = (siteId: string) =>
    [...runs.values()]
      .flatMap((run) => run.results)
      .filter((r) => r.siteId === siteId && r.flagged)
      .map((r) => r.testId);

  it("flags the planted data-integrity site on at least two independent tests", () => {
    const tests = flaggedTests(integritySite);
    // Queries and visit dates are separate data: neither test reads the other's.
    expect(tests).toContain("csm-query-under-reporting");
    expect(tests).toContain("csm-exact-day-visits");
    // It enters every visit at 17:00 UTC; its peers spread over the day.
    expect(tests).toContain("csm-entry-hour");
    expect(tests.length).toBeGreaterThanOrEqual(2);
    const hour = runs
      .get("DEMO-302")!
      .results.find(
        (r) => r.siteId === integritySite && r.testId === "csm-entry-hour"
      )!;
    expect(hour.detail).toMatch(/^(\d+) of \1 entries in the 17:00 UTC hour/);
  });

  it("flags no site without a planted signal at the configured false discovery rate", () => {
    const flagged = [...runs.values()]
      .flatMap((run) => run.results)
      .filter((r) => r.flagged)
      .map((r) => r.siteId);
    expect(flagged.filter((siteId) => !planted.has(siteId))).toEqual([]);
  });

  it("flags the planted site on other seeds too", () => {
    for (const seed of [1, 2]) {
      const other = generatePortfolio({ seed });
      const site = other.signals.find((s) => s.kind === "data-integrity")!;
      expect(site.studyId, `seed ${seed}`).not.toBeNull();
      const run = centralMonitoring(buildWarehouse(other), site.studyId!);
      const tests = run.results
        .filter((r) => r.siteId === site.siteId && r.flagged)
        .map((r) => r.testId);
      expect(tests, `seed ${seed}`).toEqual(
        expect.arrayContaining([
          "csm-query-under-reporting",
          "csm-exact-day-visits",
          "csm-entry-hour",
        ])
      );
    }
  }, 60_000);

  it("adjusts every p-value of a study together and flags by the q-value", () => {
    const run = runs.get("DEMO-302")!;
    const q = benjaminiHochberg(run.results.map((r) => r.pValue));
    run.results.forEach((r, i) => {
      expect(r.qValue).toBeCloseTo(q[i], 12);
      expect(r.flagged).toBe(r.qValue <= run.fdr);
      expect(r.pValue).toBeGreaterThanOrEqual(0);
      expect(r.pValue).toBeLessThanOrEqual(1);
    });
    // A stricter rate flags a subset.
    const strict = centralMonitoring(warehouse, "DEMO-302", 0.001);
    const strictKeys = strict.results
      .filter((r) => r.flagged)
      .map((r) => `${r.siteId} ${r.testId}`);
    const keys = new Set(
      run.results.filter((r) => r.flagged).map((r) => `${r.siteId} ${r.testId}`)
    );
    expect(strictKeys.every((k) => keys.has(k))).toBe(true);
  });

  it("says why a small study or a thin site is left out", () => {
    const small = runs.get("DEMO-101")!;
    expect(small.results).toEqual([]);
    expect(small.excluded.at(-1)).toMatchObject({ siteId: null, testId: null });
    expect(small.excluded.at(-1)!.reason).toMatch(/needs at least 6/);
    for (const run of runs.values()) {
      const tested = new Set(run.results.map((r) => r.siteId));
      for (const site of run.sites) expect(tested.has(site)).toBe(true);
      for (const e of run.excluded) expect(e.reason.length).toBeGreaterThan(10);
    }
  });

  it("leaves the entry-hour test out, saying why, when no entry time is known (#2955)", () => {
    const blank: typeof warehouse = {
      ...warehouse,
      tables: {
        ...warehouse.tables,
        "gold.fct_visit": warehouse.tables["gold.fct_visit"].map((v) => ({
          ...v,
          entry_hour: null,
        })),
      },
    };
    const run = centralMonitoring(blank, "DEMO-302");
    expect(run.results.some((r) => r.testId === "csm-entry-hour")).toBe(false);
    const reasons = run.excluded.filter((e) => e.testId === "csm-entry-hour");
    expect(reasons.map((e) => e.siteId)).toEqual(run.sites);
    for (const e of reasons)
      expect(e.reason).toMatch(/no entered visits with an entry time/);
    // The other tests do not read the entry hour, so they are unchanged.
    const others = (r: { testId: string }) => r.testId !== "csm-entry-hour";
    expect(run.results.map((r) => r.pValue)).toEqual(
      runs
        .get("DEMO-302")!
        .results.filter(others)
        .map((r) => r.pValue)
    );
  });

  it("refuses a rate outside (0, 1) and an unknown study", () => {
    expect(() => centralMonitoring(warehouse, "DEMO-302", 0)).toThrow(
      RangeError
    );
    expect(() => centralMonitoring(warehouse, "DEMO-302", 1)).toThrow(
      RangeError
    );
    expect(() => centralMonitoring(warehouse, "NOPE-1")).toThrow(
      /unknown study/
    );
  });
});

describe("study risk assessment (#2631)", () => {
  const assessments = new Map(
    studyIds.map((id) => [id, assessStudyRisk(warehouse, id)])
  );

  it("assesses every KRI at every activated site with the registry's value", () => {
    const a = assessments.get("DEMO-302")!;
    const activated = warehouse.tables["gold.dim_site"].filter(
      (s) =>
        s.study_id === "DEMO-302" && s.is_current && s.activated_on !== null
    );
    expect(a.kris).toHaveLength(activated.length * KRI_LIBRARY.length);
    for (const kri of KRI_LIBRARY) {
      const values = new Map(
        evaluateMetric(warehouse, metric(kri.metricId), {
          dimensions: ["site"],
          filters: [
            { dimension: "study", operator: "in", values: ["DEMO-302"] },
          ],
        }).rows.map((r) => [r.dimensions.site, r.value])
      );
      for (const row of a.kris.filter((k) => k.kriId === kri.id)) {
        expect(row.value).toBe(values.get(row.siteId) ?? null);
        if (row.status === "insufficient-data" || row.value === null) continue;
        const v = row.value;
        const expected =
          kri.direction === "high"
            ? v >= kri.red
              ? "red"
              : v >= kri.amber
                ? "amber"
                : "green"
            : v <= kri.red
              ? "red"
              : v <= kri.amber
                ? "amber"
                : "green";
        expect(row.status, `${kri.id} ${row.siteId}`).toBe(expected);
      }
    }
  });

  it("holds back a KRI where the site has too little data", () => {
    const thin = [...assessments.values()]
      .flatMap((a) => a.kris)
      .filter((k) => k.status === "insufficient-data");
    expect(thin.length).toBeGreaterThan(0);
    for (const row of thin.slice(0, 20)) {
      const kri = KRI_LIBRARY.find((k) => k.id === row.kriId)!;
      const count =
        evaluateMetric(warehouse, metric(kri.minimum.metricId), {
          dimensions: ["site"],
        }).rows.find((r) => r.dimensions.site === row.siteId)?.value ?? 0;
      expect(row.value === null || count < kri.minimum.value).toBe(true);
    }
  });

  it("detects the QTL breach in DEMO-203 and logs it with its planned response", () => {
    const a = assessments.get("DEMO-203")!;
    const breach = a.qtls.find((q) => q.qtlId === "qtl-early-termination")!;
    expect(breach.status).toBe("breached");
    expect(breach.value).toBe(
      evaluateMetric(warehouse, metric("early_termination_rate"), {
        dimensions: ["study"],
        filters: [{ dimension: "study", operator: "in", values: ["DEMO-203"] }],
      }).rows[0].value
    );
    expect(breach.value!).toBeGreaterThan(breach.limit);
    const entry = a.log.find(
      (e) =>
        e.source?.kind === "qtl" && e.source.qtlId === "qtl-early-termination"
    )!;
    expect(entry.event).toBe("raised");
    expect(entry.on).toBe(warehouse.asOf);
    expect(entry.note).toContain(
      QTL_LIBRARY.find((q) => q.id === "qtl-early-termination")!.response
    );
    // Every other study is within its limits on the default seed.
    const others = [...assessments.values()]
      .filter((x) => x.studyId !== "DEMO-203")
      .flatMap((x) => x.qtls.map((q) => q.status));
    expect(new Set(others)).toEqual(new Set(["within"]));
  });

  it("raises one signal per flagged site, red KRI and QTL breach, in a sound log", () => {
    for (const a of assessments.values()) {
      expect(checkRiskSignalLog(a.log)).toEqual([]);
      expect(Object.isFrozen(a.log)).toBe(true);
      const flaggedSites = new Set(
        a.csm.results.filter((r) => r.flagged).map((r) => r.siteId)
      );
      const reds = a.kris.filter((k) => k.status === "red").length;
      const qtls = a.qtls.filter(
        (q) => q.status === "breached" || q.status === "warning"
      ).length;
      expect(a.log).toHaveLength(flaggedSites.size + reds + qtls);
      expect(a.log.every((e) => e.event === "raised")).toBe(true);
    }
    const integrity = assessments
      .get("DEMO-302")!
      .log.find(
        (e) => e.source?.kind === "csm" && e.source.siteId === integritySite
      )!;
    expect(integrity.note).toContain("Query under-reporting");
    expect(integrity.signalId).toMatch(/^DEMO-302-SIG-\d{3}$/);
  });

  it("follows the study's product type and start date in its quality plan", () => {
    for (const study of warehouse.tables["gold.dim_study"]) {
      const a = assessments.get(String(study.study_id))!;
      expect(a.plan.effectiveOn).toBe(study.start_on);
      expect(a.plan).toEqual(
        qualityPlan(
          String(study.study_id),
          String(study.product_type),
          String(study.start_on)
        )
      );
    }
    expect(() => assessStudyRisk(warehouse, "NOPE-1")).toThrow(/unknown study/);
  });
});

describe("the risk signal log (#2631)", () => {
  const base = raiseRiskSignals("DEMO-302", "2026-09-30", [
    {
      source: {
        kind: "csm",
        siteId: integritySite,
        testIds: ["csm-exact-day-visits"],
      },
      note: "Visits keep to their planned day exactly.",
    },
  ]);
  const step = (
    log: readonly RiskSignalLogEntry[],
    entry: Partial<RiskSignalLogInput>
  ) =>
    appendRiskSignal(log, {
      signalId: "DEMO-302-SIG-001",
      event: "assessed",
      on: "2026-10-02",
      by: "Central monitor",
      note: "Reviewed.",
      source: null,
      action: null,
      ...entry,
    });

  it("walks a signal from raised to closed without changing earlier entries", () => {
    const assessed = step(base, {
      note: "Pattern confirmed across subjects; not explained by site practice.",
    });
    const actioned = step(assessed, {
      event: "actioned",
      on: "2026-10-09",
      by: "Clinical monitoring lead",
      note: "Targeted SDV of all visits since activation.",
      action: "targeted-sdv",
    });
    const audited = step(actioned, {
      event: "actioned",
      on: "2026-10-20",
      by: "Quality assurance",
      note: "For-cause audit scheduled.",
      action: "site-audit",
    });
    const closed = step(audited, {
      event: "closed",
      on: "2026-11-15",
      by: "Study quality lead",
      note: "Audit findings filed; corrective actions tracked in the CAPA log.",
    });
    expect(closed.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(closed.slice(0, 4)).toEqual(audited);
    expect(base).toHaveLength(1);
    expect(Object.isFrozen(closed) && Object.isFrozen(closed[4])).toBe(true);
    expect(checkRiskSignalLog(closed)).toEqual([]);
    expect(riskSignalStates(closed)).toEqual([
      { signalId: "DEMO-302-SIG-001", event: "closed" },
    ]);
    expect(Object.keys(RISK_SIGNAL_ACTIONS)).toContain(closed[2].action);
  });

  it("lets an assessment close a signal that needs no action", () => {
    const assessed = step(base, {
      note: "Explained: the site uses a fixed clinic day.",
    });
    expect(() =>
      step(assessed, { event: "closed", note: "No action needed." })
    ).not.toThrow();
  });

  it("refuses steps out of order, back in time, or with the wrong fields", () => {
    const assessed = step(base, {});
    const closed = step(assessed, { event: "closed", note: "Done." });
    expect(() => step(Object.freeze([]), {})).toThrow(/must be raised/);
    expect(() => step(base, { event: "closed" })).toThrow(
      /cannot be closed after it was raised/
    );
    expect(() =>
      step(closed, { event: "actioned", action: "site-audit" })
    ).toThrow(/after it was closed/);
    expect(() => step(base, { on: "2026-09-01" })).toThrow(/step back/);
    expect(() => step(base, { on: "30/09/2026" })).toThrow(/YYYY-MM-DD/);
    expect(() => step(assessed, { event: "actioned" })).toThrow(
      /action belongs/
    );
    expect(() => step(base, { action: "site-audit" })).toThrow(
      /action belongs/
    );
    expect(() =>
      step(base, { source: { kind: "qtl", qtlId: "qtl-missed-visits" } })
    ).toThrow(/source belongs/);
    expect(() => step(base, { note: "  " })).toThrow(/what was found/);
    expect(() =>
      step(base, {
        event: "raised",
        signalId: "DEMO-302-SIG-001",
        source: { kind: "qtl", qtlId: "qtl-missed-visits" },
      })
    ).toThrow(/cannot be raised after it was raised/);
  });

  it("finds a log that was edited after the fact", () => {
    const log = step(base, {});
    const renumbered = log.map((e, i) => ({
      ...e,
      sequence: i === 1 ? 5 : e.sequence,
    }));
    expect(checkRiskSignalLog(renumbered)).toEqual([
      { sequence: 5, message: "entry 2 carries sequence 5" },
    ]);
    const rewritten = [log[1], log[0]];
    expect(checkRiskSignalLog(rewritten).length).toBeGreaterThan(0);
  });
});
