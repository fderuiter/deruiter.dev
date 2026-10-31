import { describe, expect, it } from "vitest";
import {
  DATA_QUALITY_RULES,
  DEFAULT_PORTFOLIO_SEED,
  DQ_DIMENSIONS,
  DQ_ISSUE_LOG,
  DQ_SCENARIOS,
  STUDY_DATA_PRODUCT_ID,
  WAREHOUSE_SCHEMA,
  appendDqIssueEvent,
  applyDqScenario,
  assessDataQuality,
  breakDataQualityRule,
  buildWarehouse,
  dataProducts,
  dataQualityTrend,
  dqIssues,
  generatePortfolio,
  withOpenDqIssues,
  type DqAssessment,
  type DqIssueEvent,
  type Warehouse,
} from "@/lib/clinical-platform";
import {
  CONFORMANCE_RULES,
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  runPipeline,
  type PipelineRun,
} from "@/lib/study-data";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const run = runPipeline(DEMO_301_STUDY, {
  seed: DEFAULT_SEED,
  nSubjects: DEFAULT_SUBJECT_COUNT,
});
const baseline = assessDataQuality(warehouse, run);
const products = new Map(dataProducts(run).map((p) => [p.id, p]));

const platformRules = DATA_QUALITY_RULES.filter((r) => r.source === "platform");
const resultOf = (assessment: DqAssessment, ruleId: string) => {
  const result = assessment.results.find((r) => r.ruleId === ruleId);
  if (result === undefined) throw new Error(`no result for ${ruleId}`);
  return result;
};
/** Rules whose failing count is higher in `after` than in the baseline. */
const raised = (after: DqAssessment) =>
  after.results
    .filter((r) => r.failed > resultOf(baseline, r.ruleId).failed)
    .map((r) => r.ruleId);
/** Tables of `after` that are not the same array as in `before`. */
const changedTables = (before: Warehouse, after: Warehouse) =>
  Object.keys(after.tables).filter((t) => after.tables[t] !== before.tables[t]);

describe("data quality rule catalog", () => {
  it("lists the platform's rules, then every conformance rule", () => {
    expect(platformRules).toHaveLength(48);
    expect(DATA_QUALITY_RULES.slice(48).map((r) => r.id)).toEqual(
      CONFORMANCE_RULES.map((r) => r.id)
    );
    expect(new Set(DATA_QUALITY_RULES.map((r) => r.id)).size).toBe(
      DATA_QUALITY_RULES.length
    );
    expect(Object.isFrozen(DATA_QUALITY_RULES)).toBe(true);
  });

  it("covers every DAMA dimension with platform rules", () => {
    for (const dimension of DQ_DIMENSIONS) {
      expect(
        platformRules.some((r) => r.dimension === dimension),
        dimension
      ).toBe(true);
    }
    for (const rule of platformRules) {
      expect(rule.id).toMatch(/^DQ-[CVUKTA]\d{2}$/);
      expect("CVUKTA".indexOf(rule.id[3])).toBe(
        DQ_DIMENSIONS.indexOf(rule.dimension)
      );
    }
  });

  it("checks published warehouse tables, owned by their product's steward", () => {
    const tables = new Set(
      WAREHOUSE_SCHEMA.tables.map((t) => `${t.layer}.${t.name}`)
    );
    for (const rule of DATA_QUALITY_RULES) {
      if (rule.source === "platform") {
        expect(tables.has(rule.productId), rule.id).toBe(true);
        expect(rule.dataset).toBeNull();
        expect(rule.citation).toBeNull();
      }
      expect(rule.owner, rule.id).toBe(products.get(rule.productId)?.steward);
      expect(rule.threshold, rule.id).toBeGreaterThan(0);
      expect(rule.threshold, rule.id).toBeLessThanOrEqual(1);
      expect(rule.name.length, rule.id).toBeGreaterThan(10);
      expect(rule.rationale.length, rule.id).toBeGreaterThan(10);
    }
  });

  it("ingests conformance rules with their dataset, citation and severity", () => {
    for (const source of CONFORMANCE_RULES) {
      const rule = DATA_QUALITY_RULES.find((r) => r.id === source.id);
      expect(rule).toMatchObject({
        productId: STUDY_DATA_PRODUCT_ID,
        dataset: source.scope.domain,
        source: "conformance",
        citation: source.citation,
        threshold: 1,
        severity: source.severity === "error" ? "critical" : "minor",
      });
    }
    const dimension = (id: string) =>
      DATA_QUALITY_RULES.find((r) => r.id === id)?.dimension;
    expect(dimension("SD-001")).toBe("completeness");
    expect(dimension("SD-009")).toBe("uniqueness");
    expect(dimension("SD-014")).toBe("validity");
    expect(dimension("SD-021")).toBe("validity");
    expect(dimension("SD-025")).toBe("consistency");
    expect(dimension("SD-031")).toBe("accuracy");
    expect(dimension("AD-003")).toBe("consistency");
  });
});

describe("platform rules on the default portfolio", () => {
  it("pass, except the two timeliness targets the generated operations miss", () => {
    const failing = baseline.results
      .filter((r) => r.status === "fail")
      .map((r) => r.ruleId);
    // Monitoring reports finalize 3 to 25 days after a visit against a 15 or
    // 20 day deadline, and TMF filing lands either side of the due date.
    expect(failing).toEqual(["DQ-T03", "DQ-T04"]);
    for (const rule of platformRules) {
      const result = resultOf(baseline, rule.id);
      expect(result.checked, rule.id).toBeGreaterThan(0);
      expect(result.passRate, rule.id).toBe(1 - result.failed / result.checked);
    }
  });

  /** A copy of the warehouse with every row of one table changed. */
  const mapRows = (
    w: Warehouse,
    table: string,
    change: (row: Warehouse["tables"][string][number]) => object
  ): Warehouse => ({
    ...w,
    tables: {
      ...w.tables,
      [table]: w.tables[table].map((row) => ({ ...row, ...change(row) })),
    },
  });
  /**
   * Passing fixtures for the two rules the default data fails: the same
   * data with the target met, so each still has a pass and a fail case.
   */
  const PASSING: Readonly<Record<string, (w: Warehouse) => Warehouse>> = {
    "DQ-T03": (w) =>
      mapRows(w, "silver.ctms_monitoring_visit", (r) => ({
        report_final_on: r.visit_date,
      })),
    "DQ-T04": (w) =>
      mapRows(w, "silver.etmf_document", (r) =>
        String(r.due_on) <= w.asOf ? { filed_on: r.due_on } : {}
      ),
  };

  it.each(platformRules.map((r) => [r.id, r] as const))(
    "%s passes its passing fixture and catches its fault, which changes one table",
    (id, rule) => {
      const passing = PASSING[id]?.(warehouse) ?? warehouse;
      const before = resultOf(assessDataQuality(passing, run), id);
      expect(before.status).toBe("pass");
      const broken = breakDataQualityRule(passing, id);
      expect(changedTables(passing, broken)).toHaveLength(1);
      const after = resultOf(assessDataQuality(broken, run), id);
      expect(after.failed).toBeGreaterThan(before.failed);
      if (rule.threshold === 1) expect(after.status).toBe("fail");
      expect(after.sample.length).toBeGreaterThan(0);
      expect(after.sample.length).toBeLessThanOrEqual(5);
      expect([...after.sample].sort()).toEqual(after.sample);
    }
  );

  it("leaves the warehouse it breaks unchanged", () => {
    const before = warehouse.tables["silver.edc_visit"];
    const snapshot = JSON.stringify(before.slice(0, 50));
    breakDataQualityRule(warehouse, "DQ-C01");
    expect(warehouse.tables["silver.edc_visit"]).toBe(before);
    expect(JSON.stringify(before.slice(0, 50))).toBe(snapshot);
  });

  it("only breaks platform rules", () => {
    expect(() => breakDataQualityRule(warehouse, "SD-001")).toThrow(
      /not a platform data quality rule/
    );
    expect(() => breakDataQualityRule(warehouse, "DQ-Z99")).toThrow();
  });
});

describe("conformance results", () => {
  it("take the pipeline gate's status on the default run", () => {
    const results = baseline.results.slice(48);
    expect(results.map((r) => r.ruleId)).toEqual(
      CONFORMANCE_RULES.map((r) => r.id)
    );
    expect(
      results.filter((r) => r.status === "warn").map((r) => r.ruleId)
    ).toEqual(["SD-031", "SD-032", "SD-033", "SD-034"]);
    // SD-036 to SD-039 (duplicates and units, #2605), the 13 lineage
    // rules (#2930), the EG rules SD-048 to SD-054 (#2942), the ADEG
    // rules AD-011 to AD-013 (#2943), the ECG review rules AD-014 and
    // AD-015 (#2944), the CM rules SD-055 to SD-063 (#2961), the MH rules
    // SD-064 to SD-070 (#2963), the IE rules SD-071 to SD-075 (#2964), the
    // ADCM rules AD-016 to AD-018 (#2962), the RELREC rules SD-076 to
    // SD-078 (#3414) and the SE and CO rules SD-079 to SD-088 (#2711) pass
    // on the plain run.
    expect(results.filter((r) => r.status === "pass")).toHaveLength(102);
    const visits = resultOf(baseline, "SD-031");
    expect(visits.checked).toBe(
      run.datasets.find((d) => d.name === "SV" && d.layer === "sdtm")?.rowCount
    );
    expect(visits.failed).toBeGreaterThan(0);
    expect(visits.sample[0]).toMatch(/^SV row \d+$/);
  });

  it("fail on an error and are not applicable without their dataset", () => {
    const broken: PipelineRun = {
      ...run,
      datasets: run.datasets.filter((d) => d.name !== "DS"),
      findings: [
        ...run.findings,
        {
          ruleId: "SD-021",
          severity: "error",
          layer: "sdtm",
          dataset: "DM",
          variable: "SEX",
          row: 2,
          message: "X is outside CL_SEX (invalid code).",
        },
      ],
      conformance: {
        ...run.conformance,
        ruleResults: run.conformance.ruleResults.map((r) =>
          r.ruleId === "SD-021"
            ? { ...r, status: "error" as const, findingCount: 1 }
            : r
        ),
      },
    };
    const assessment = assessDataQuality(warehouse, broken);
    expect(resultOf(assessment, "SD-021")).toMatchObject({
      status: "fail",
      failed: 1,
      sample: ["DM row 3"],
    });
    expect(resultOf(assessment, "SD-007")).toEqual({
      ruleId: "SD-007",
      checked: 0,
      failed: 0,
      passRate: null,
      status: "not-applicable",
      sample: [],
    });
  });
});

describe("scorecards", () => {
  it("score the mean pass rate of the rules that checked something", () => {
    const mean = (ids: readonly string[]) => {
      const rates = baseline.results
        .filter((r) => ids.includes(r.ruleId) && r.passRate !== null)
        .map((r) => r.passRate ?? 0);
      return rates.reduce((a, b) => a + b, 0) / rates.length;
    };
    expect(baseline.dataCut).toBe(warehouse.asOf);
    expect(baseline.overall).toMatchObject({
      key: "overall",
      rules: 154,
      passing: 152,
    });
    expect(baseline.overall.score).toBeCloseTo(
      mean(DATA_QUALITY_RULES.map((r) => r.id)),
      12
    );
    expect(baseline.byDimension.map((s) => s.key)).toEqual(DQ_DIMENSIONS);
    // A rule whose dataset the run lacks checks nothing and is not scored:
    // DEMO-301 collects no adjudicated events, so SD-089 (CE lineage,
    // #3417) is the one rule that does not apply.
    const checked = (ids: readonly string[]) =>
      ids.filter(
        (id) => baseline.results.find((r) => r.ruleId === id)?.passRate !== null
      );
    expect(
      baseline.results.filter((r) => r.passRate === null).map((r) => r.ruleId)
    ).toEqual(["SD-089"]);
    for (const score of baseline.byDimension) {
      const ids = DATA_QUALITY_RULES.filter(
        (r) => r.dimension === score.key
      ).map((r) => r.id);
      expect(score.rules).toBe(checked(ids).length);
      expect(score.score).toBeCloseTo(mean(ids), 12);
    }
  });

  it("score every product with rules, in id order, by its registered name", () => {
    const keys = baseline.byProduct.map((s) => s.key);
    expect(keys).toEqual([...keys].sort());
    expect(keys).toEqual(
      [...new Set(DATA_QUALITY_RULES.map((r) => r.productId))].sort()
    );
    for (const score of baseline.byProduct) {
      expect(score.label).toBe(products.get(score.key)?.name);
    }
    const tmf = baseline.byProduct.find(
      (s) => s.key === "silver.etmf_document"
    );
    expect(tmf).toMatchObject({ rules: 2, passing: 1 });
  });

  it("are deterministic", () => {
    expect(assessDataQuality(warehouse, run)).toEqual(baseline);
  });
});

describe("fault scenarios", () => {
  it("have unique ids and name rules in rule order", () => {
    expect(new Set(DQ_SCENARIOS.map((s) => s.id)).size).toBe(
      DQ_SCENARIOS.length
    );
    const order = DATA_QUALITY_RULES.map((r) => r.id);
    for (const scenario of DQ_SCENARIOS) {
      const at = scenario.ruleIds.map((id) => order.indexOf(id));
      expect(at.every((i) => i >= 0)).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
    }
  });

  it.each(DQ_SCENARIOS.map((s) => [s.id, s] as const))(
    "%s raises exactly the rules it names",
    (id, scenario) => {
      const after = assessDataQuality(applyDqScenario(warehouse, id), run);
      expect(raised(after)).toEqual(scenario.ruleIds);
    }
  );

  it("can leave a threshold rule passing: one site's late entry", () => {
    const after = assessDataQuality(
      applyDqScenario(warehouse, "late-edc-entry"),
      run
    );
    expect(resultOf(after, "DQ-T01").status).toBe("pass");
  });

  it("rejects an unknown scenario", () => {
    expect(() => applyDqScenario(warehouse, "nope")).toThrow(
      /no data quality scenario/
    );
  });
});

describe("issue log", () => {
  const detected: DqIssueEvent = {
    issueId: "DQI-100",
    status: "detected",
    on: "2026-09-01",
    actor: "Data quality rules",
    note: "Kit dispensed after expiry.",
    scenarioId: "expired-kit-dispensed",
    ruleIds: ["DQ-K08"],
  };
  const next = (status: DqIssueEvent["status"], on = "2026-09-02") => ({
    ...detected,
    status,
    on,
    scenarioId: null,
    ruleIds: [],
  });

  it("is chronological and folds into six issues, four closed", () => {
    const dates = DQ_ISSUE_LOG.map((e) => e.on);
    expect(dates).toEqual([...dates].sort());
    expect(Object.isFrozen(DQ_ISSUE_LOG)).toBe(true);
    const issues = dqIssues(DQ_ISSUE_LOG);
    expect(issues.map((i) => [i.issueId, i.status, i.fixedOn])).toEqual([
      ["DQI-001", "verified", "2026-07-28"],
      ["DQI-002", "verified", "2026-08-19"],
      ["DQI-003", "verified", "2026-09-02"],
      ["DQI-004", "verified", "2026-09-09"],
      ["DQI-005", "root-cause", null],
      ["DQI-006", "assigned", null],
    ]);
    for (const issue of issues) {
      expect(issue.ruleIds).toEqual(
        DQ_SCENARIOS.find((s) => s.id === issue.scenarioId)?.ruleIds
      );
    }
  });

  it("appends without changing the log it is given", () => {
    const log = appendDqIssueEvent([], detected);
    const longer = appendDqIssueEvent(log, next("assigned"));
    expect(log).toHaveLength(1);
    expect(longer).toHaveLength(2);
    expect(dqIssues(longer)[0].status).toBe("assigned");
  });

  it("refuses an entry that skips, repeats or predates a step", () => {
    const log = appendDqIssueEvent([], detected);
    expect(() => appendDqIssueEvent(log, next("root-cause"))).toThrow(
      /expected assigned, got root-cause/
    );
    expect(() => appendDqIssueEvent(log, detected)).toThrow(
      /expected assigned/
    );
    expect(() =>
      appendDqIssueEvent(log, next("assigned", "2026-08-31"))
    ).toThrow(/predates/);
    expect(() => appendDqIssueEvent([], next("assigned"))).toThrow(
      /expected detected/
    );
    const closed = (
      ["assigned", "root-cause", "fixed", "verified"] as const
    ).reduce((l, status) => appendDqIssueEvent(l, next(status)), log);
    expect(() => appendDqIssueEvent(closed, next("verified"))).toThrow(
      /expected no further entry/
    );
  });

  it("refuses a detection without a known defect and rules", () => {
    expect(() =>
      appendDqIssueEvent([], { ...detected, scenarioId: "nope" })
    ).toThrow(/unknown defect/);
    expect(() => appendDqIssueEvent([], { ...detected, ruleIds: [] })).toThrow(
      /known rules/
    );
    expect(() =>
      appendDqIssueEvent([], { ...detected, ruleIds: ["DQ-Z99"] })
    ).toThrow(/known rules/);
    expect(() =>
      appendDqIssueEvent(appendDqIssueEvent([], detected), {
        ...next("assigned"),
        ruleIds: ["DQ-K08"],
      })
    ).toThrow(/only detection/);
    expect(() =>
      appendDqIssueEvent([], { ...detected, on: "2026-9-1" })
    ).toThrow(/ISO 8601/);
  });
});

describe("weekly trend", () => {
  const trend = dataQualityTrend(warehouse, run, DQ_ISSUE_LOG);

  it("covers twelve weeks ending on the data cut", () => {
    expect(trend).toHaveLength(12);
    expect(trend[0].weekEnding).toBe("2026-07-15");
    expect(trend[11].weekEnding).toBe(warehouse.asOf);
  });

  it("puts back the defects open each week and nothing else", () => {
    expect(trend.map((p) => p.openIssueIds)).toEqual([
      ["DQI-001"],
      ["DQI-001"],
      ["DQI-002"],
      ["DQI-002"],
      ["DQI-002", "DQI-003"],
      ["DQI-003"],
      ["DQI-003", "DQI-004"],
      ["DQI-004"],
      ["DQI-005"],
      ["DQI-005"],
      ["DQI-005", "DQI-006"],
      ["DQI-005", "DQI-006"],
    ]);
    expect(trend[11].failingRuleIds).toEqual([
      "DQ-K02",
      "DQ-K08",
      "DQ-T03",
      "DQ-T04",
    ]);
    expect(trend[5].failingRuleIds).toEqual([
      "DQ-C02",
      "DQ-K07",
      "DQ-T03",
      "DQ-T04",
      "DQ-A03",
    ]);
  });

  it("ends on the scorecard of the cut with its open defects", () => {
    const atCut = assessDataQuality(
      withOpenDqIssues(warehouse, DQ_ISSUE_LOG, warehouse.asOf),
      run
    );
    expect(trend[11].overall).toEqual(atCut.overall);
    expect(trend[11].byDimension).toEqual(atCut.byDimension);
  });

  it("refuses a bad window or a log past the cut", () => {
    expect(() => dataQualityTrend(warehouse, run, DQ_ISSUE_LOG, 0)).toThrow();
    expect(() => dataQualityTrend(warehouse, run, DQ_ISSUE_LOG, 53)).toThrow();
    expect(() => dataQualityTrend(warehouse, run, DQ_ISSUE_LOG, 2.5)).toThrow();
    const late = appendDqIssueEvent(DQ_ISSUE_LOG, {
      issueId: "DQI-007",
      status: "detected",
      on: "2026-10-07",
      actor: "Data quality rules",
      note: "After the cut.",
      scenarioId: "late-edc-entry",
      ruleIds: ["DQ-T01"],
    });
    expect(() => dataQualityTrend(warehouse, run, late)).toThrow(
      /past the data cut/
    );
  });
});
