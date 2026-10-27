import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { findClinicalClaims } from "@/lib/clinical-platform";
import {
  DEMO_301_STUDY,
  KM_CONFIDENCE_LEVEL,
  NORMAL_QUANTILE_975,
  SYNTHETIC_DATA_NOTICE,
  buildTlfOutputs,
  chiSquareSurvival,
  formatPValue,
  indexAdamRows,
  kaplanMeierEstimate,
  logRankTest,
  resolveResultRows,
  rowSetRowIds,
  runPipeline,
  writeArsJson,
  writeKmFigureHtml,
  writeKmFigureSvg,
  writeTlfFiles,
  type ArsOperationResult,
  type ArsRowSet,
  type CellValue,
  type Dataset,
  type PipelineRun,
  type SurvivalObservation,
  type TlfKmFigure,
  type TlfOutputs,
} from "@/lib/study-data";

/**
 * Worked example: the Freireich et al. (1963) leukemia remission data,
 * weeks in remission for 21 patients on 6-mercaptopurine (6-MP) and 21 on
 * placebo (Blood 21:699-716; the two-sample data set Gehan 1965 and most
 * survival texts reuse). The 6-MP arm has a three-way tie of events at
 * week 6 with a censoring at the same week, an event and a censoring tied
 * at week 10, and two censorings tied at week 32. The placebo arm has
 * tied events at weeks 1, 2, 4, 5, 8 (four), 11, 12 and no censoring.
 */
const SIX_MP: readonly SurvivalObservation[] = [
  ...[6, 6, 6, 7, 10, 13, 16, 22, 23].map((time) => ({ time, event: true })),
  ...[6, 9, 10, 11, 17, 19, 20, 25, 32, 32, 34, 35].map((time) => ({
    time,
    event: false,
  })),
];
const PLACEBO: readonly SurvivalObservation[] = [
  1, 1, 2, 2, 3, 4, 4, 5, 5, 8, 8, 8, 8, 11, 11, 12, 12, 15, 17, 22, 23,
].map((time) => ({ time, event: true }));

/**
 * Published product-limit estimates and Greenwood standard errors, from the
 * Minitab "Kaplan-Meier Estimates" output for the same data in T. O'Brien,
 * "First Survival Analysis Handout" (Biostatistics, Loyola University
 * Chicago, 2 March 2010), page 2, which reproduces the leukemia example of
 * Vittinghoff et al., Regression Methods in Biostatistics, p. 55:
 * https://webpages.math.luc.edu/~tobrien/courses/newab/SurviveHO1.pdf
 * Columns: time, number at risk, number failed, survival, standard error.
 */
const PUBLISHED_SIX_MP = [
  [6, 21, 3, 0.857143, 0.07636],
  [7, 17, 1, 0.806723, 0.086935],
  [10, 15, 1, 0.752941, 0.09635],
  [13, 12, 1, 0.690196, 0.106815],
  [16, 11, 1, 0.627451, 0.114054],
  [22, 7, 1, 0.537815, 0.128234],
  [23, 6, 1, 0.448179, 0.134591],
] as const;
const PUBLISHED_PLACEBO = [
  [1, 21, 2, 0.904762, 0.064056],
  [2, 19, 2, 0.809524, 0.085689],
  [3, 17, 1, 0.761905, 0.092943],
  [4, 16, 2, 0.666667, 0.102869],
  [5, 14, 2, 0.571429, 0.10799],
  [8, 12, 4, 0.380952, 0.105971],
  [11, 8, 2, 0.285714, 0.098581],
  [12, 6, 2, 0.190476, 0.085689],
  [15, 4, 1, 0.142857, 0.07636],
  [17, 3, 1, 0.095238, 0.064056],
  [22, 2, 1, 0.047619, 0.046471],
  [23, 1, 1, 0, 0],
] as const;

/**
 * Published log-log 95% limits for the 6-MP arm, from the S-Plus
 * `surv.fit(..., conf.type = "log-log")` output in the lecture notes
 * "Estimating the Survival Function" (lect2notes, University of Michigan
 * biostatistics course notes, 2001), page 34; the Stata `sts list` output
 * on pages 27 and 31 prints the same limits to four decimals:
 * https://websites.umich.edu/~yili/lect2notes.pdf
 * Columns: time, lower, upper.
 */
const PUBLISHED_SIX_MP_LOG_LOG = [
  [6, 0.619718, 0.9515517],
  [7, 0.5631466, 0.922809],
  [10, 0.5031995, 0.8893618],
  [13, 0.4316102, 0.849066],
  [16, 0.3675109, 0.8049122],
  [22, 0.2677789, 0.7467907],
  [23, 0.188052, 0.6801426],
] as const;

const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
const outputs = buildTlfOutputs(DEMO_301_STUDY, run);
const event = outputs.reportingEvent;
const rows = indexAdamRows(run.datasets);
const figure = outputs.figures[0];

function adam(source: PipelineRun, name: string): Dataset {
  const found = source.datasets.find(
    (dataset) => dataset.name === name && dataset.layer === "adam"
  );
  if (!found) throw new Error(`No ${name}`);
  return found;
}

function resultsOf(source: TlfOutputs): Map<string, ArsOperationResult> {
  return new Map(
    source.reportingEvent.analyses.flatMap((analysis) =>
      analysis.results.map((result) => [result.id, result] as const)
    )
  );
}

/** A run whose ADTTE keeps only the rows `keep` selects, with `edit` applied. */
function withAdtte(
  source: PipelineRun,
  keep: (row: number) => boolean,
  edit: (name: string, value: CellValue) => CellValue = (_, value) => value
): PipelineRun {
  return {
    ...source,
    datasets: source.datasets.map((dataset) => {
      if (dataset.name !== "ADTTE" || dataset.layer !== "adam") return dataset;
      const kept = Array.from(
        { length: dataset.rowCount },
        (_, row) => row
      ).filter(keep);
      return {
        ...dataset,
        rowCount: kept.length,
        columns: Object.fromEntries(
          Object.entries(dataset.columns).map(([name, values]) => [
            name,
            kept.map((row) => edit(name, values[row] ?? null)),
          ])
        ),
        ...(dataset.lineage
          ? { lineage: kept.map((row) => dataset.lineage![row]) }
          : {}),
      };
    }),
  };
}

function plottedValuesResolve(source: PipelineRun, built: TlfOutputs): void {
  const index = indexAdamRows(source.datasets);
  const lookup = resultsOf(built);
  for (const curve of built.figures[0].curves) {
    for (const point of curve.points) {
      for (const id of point.resultIds) {
        const resolved = resolveResultRows(
          built.reportingEvent,
          index,
          lookup.get(id)!
        );
        expect(resolved.length, id).toBeGreaterThan(0);
      }
      const survival = resolveResultRows(
        built.reportingEvent,
        index,
        lookup.get(point.resultIds[3])!
      );
      expect(
        survival.filter((row) => row.dataset === "ADTTE").length,
        point.resultIds[3]
      ).toBeGreaterThan(0);
    }
  }
}

describe("Kaplan-Meier estimate: Freireich 6-MP worked example", () => {
  const sixMp = kaplanMeierEstimate(SIX_MP);
  const placebo = kaplanMeierEstimate(PLACEBO);

  it("matches the published survival estimates and Greenwood SEs to 4 decimals (6-MP: ties and censoring)", () => {
    for (const [time, atRisk, events, survival, se] of PUBLISHED_SIX_MP) {
      const step = sixMp.steps.find((item) => item.time === time)!;
      expect(step, `week ${time}`).toMatchObject({ atRisk, events });
      // Within 5e-6 of the six-decimal published value, so equal to 4 dp.
      expect(step.survival).toBeCloseTo(survival, 5);
      expect(step.standardError).toBeCloseTo(se, 5);
    }
  });

  it("matches the published estimates for the placebo arm, tied events and no censoring, down to zero", () => {
    expect(placebo.steps.map((step) => step.time)).toEqual(
      PUBLISHED_PLACEBO.map(([time]) => time)
    );
    for (const [time, atRisk, events, survival, se] of PUBLISHED_PLACEBO) {
      const step = placebo.steps.find((item) => item.time === time)!;
      expect(step).toMatchObject({ atRisk, events, censored: 0 });
      expect(step.survival).toBeCloseTo(survival, 5);
      expect(step.standardError).toBeCloseTo(se, 5);
    }
    expect(placebo.steps.at(-1)).toMatchObject({
      survival: 0,
      standardError: 0,
      lower: null,
      upper: null,
    });
  });

  it("matches the published log-log 95% limits", () => {
    expect(sixMp.confidenceTransform).toBe("log-log");
    expect(sixMp.confidenceLevel).toBe(KM_CONFIDENCE_LEVEL);
    expect(NORMAL_QUANTILE_975).toBeCloseTo(1.959964, 6);
    for (const [time, lower, upper] of PUBLISHED_SIX_MP_LOG_LOG) {
      const step = sixMp.steps.find((item) => item.time === time)!;
      expect(step.lower!).toBeCloseTo(lower, 6);
      expect(step.upper!).toBeCloseTo(upper, 6);
    }
  });

  it("keeps censored subjects at risk at their own time and steps once per tied time", () => {
    // Stata sts list, lect2notes p. 27: Beg. Total, Fail, Net Lost.
    expect(
      sixMp.steps.map((step) => [
        step.time,
        step.atRisk,
        step.events,
        step.censored,
      ])
    ).toEqual([
      [6, 21, 3, 1],
      [7, 17, 1, 0],
      [9, 16, 0, 1],
      [10, 15, 1, 1],
      [11, 13, 0, 1],
      [13, 12, 1, 0],
      [16, 11, 1, 0],
      [17, 10, 0, 1],
      [19, 9, 0, 1],
      [20, 8, 0, 1],
      [22, 7, 1, 0],
      [23, 6, 1, 0],
      [25, 5, 0, 1],
      [32, 4, 0, 2],
      [34, 2, 0, 1],
      [35, 1, 0, 1],
    ]);
    // A censoring-only time carries the estimate and its SE unchanged.
    const at7 = sixMp.steps[1];
    const at9 = sixMp.steps[2];
    expect(at9.survival).toBe(at7.survival);
    expect(at9.standardError).toBe(at7.standardError);
    expect(sixMp).toMatchObject({ n: 21, events: 9, censored: 12 });
  });

  it("matches the published log-rank test", () => {
    // SAS PROC LIFETEST output in the O'Brien handout, page 6: log-rank
    // rank statistic -10.251 (6-MP), variance 6.25696, chi-square 16.7929
    // on 1 DF. Minitab, page 2, prints the same chi-square.
    const test = logRankTest([SIX_MP, PLACEBO]);
    expect(test.observed).toEqual([9, 21]);
    expect(test.observed[0] - test.expected[0]).toBeCloseTo(-10.251, 3);
    expect(test.observed[1] - test.expected[1]).toBeCloseTo(10.251, 3);
    expect(test.covariance[0][0]).toBeCloseTo(6.25696, 5);
    expect(test.covariance[0][1]).toBeCloseTo(-6.25696, 5);
    expect(test.degreesOfFreedom).toBe(1);
    expect(test.chiSquare!).toBeCloseTo(16.7929, 4);
    // p is P(chi-square on 1 DF >= 16.7929), the two-sided normal tail at
    // the square root of the statistic; the sources print it as < .0001.
    expect(test.pValue!).toBeLessThan(0.0001);
    expect(formatPValue(test.pValue!)).toBe("<0.0001");
  });

  it("gives the same test whichever order the groups are in", () => {
    const forward = logRankTest([SIX_MP, PLACEBO]);
    const reverse = logRankTest([PLACEBO, SIX_MP]);
    expect(reverse.chiSquare!).toBeCloseTo(forward.chiSquare!, 10);
  });
});

describe("chi-square tail probability", () => {
  it.each([
    // Upper 5%, 1% and 0.1% points of the chi-square distribution.
    [3.841458820694124, 1, 0.05],
    [6.634896601021214, 1, 0.01],
    [10.827566170662733, 1, 0.001],
    [5.991464547107979, 2, 0.05],
    [7.814727903251178, 3, 0.05],
    [9.487729036781154, 4, 0.05],
  ])("P(X >= %f | %i df) is %f", (x, df, p) => {
    expect(chiSquareSurvival(x, df)).toBeCloseTo(p, 10);
  });

  it("is exp(-x / 2) on 2 degrees of freedom and decreases in x", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        fc.integer({ min: 1, max: 12 }),
        (x, step, df) => {
          expect(chiSquareSurvival(x, 2)).toBeCloseTo(Math.exp(-x / 2), 12);
          expect(chiSquareSurvival(x + step, df)).toBeLessThanOrEqual(
            chiSquareSurvival(x, df) + 1e-15
          );
        }
      )
    );
    expect(chiSquareSurvival(0, 3)).toBe(1);
  });

  it("rejects arguments outside its domain", () => {
    expect(() => chiSquareSurvival(-1, 1)).toThrow(RangeError);
    expect(() => chiSquareSurvival(Number.NaN, 1)).toThrow(RangeError);
    expect(() => chiSquareSurvival(1, 0)).toThrow(RangeError);
    expect(() => chiSquareSurvival(1, 1.5)).toThrow(RangeError);
    expect(() => formatPValue(1.5)).toThrow(RangeError);
    expect(formatPValue(0.05)).toBe("0.0500");
  });
});

describe("boundary defences", () => {
  it("returns no steps for no subjects, and a log-rank test that is not estimable", () => {
    expect(kaplanMeierEstimate([])).toEqual({
      n: 0,
      events: 0,
      censored: 0,
      confidenceLevel: KM_CONFIDENCE_LEVEL,
      confidenceTransform: "log-log",
      steps: [],
    });
    expect(logRankTest([[], []])).toMatchObject({
      observed: [0, 0],
      expected: [0, 0],
      degreesOfFreedom: 0,
      chiSquare: null,
      pValue: null,
    });
    expect(logRankTest([])).toMatchObject({ chiSquare: null, pValue: null });
  });

  it("stays at 1 with every subject censored, with limits not estimable", () => {
    const estimate = kaplanMeierEstimate([
      { time: 3, event: false },
      { time: 3, event: false },
      { time: 8, event: false },
    ]);
    expect(estimate.steps).toEqual([
      {
        time: 3,
        atRisk: 3,
        events: 0,
        censored: 2,
        survival: 1,
        standardError: 0,
        lower: null,
        upper: null,
      },
      {
        time: 8,
        atRisk: 1,
        events: 0,
        censored: 1,
        survival: 1,
        standardError: 0,
        lower: null,
        upper: null,
      },
    ]);
    const test = logRankTest([
      [{ time: 3, event: false }],
      [{ time: 5, event: false }],
    ]);
    expect(test).toMatchObject({ degreesOfFreedom: 0, chiSquare: null });
  });

  it("handles a single subject, with an event or censored", () => {
    expect(kaplanMeierEstimate([{ time: 4, event: true }]).steps).toEqual([
      {
        time: 4,
        atRisk: 1,
        events: 1,
        censored: 0,
        survival: 0,
        standardError: 0,
        lower: null,
        upper: null,
      },
    ]);
    expect(kaplanMeierEstimate([{ time: 0, event: false }]).steps).toEqual([
      expect.objectContaining({ time: 0, survival: 1, censored: 1 }),
    ]);
    expect(logRankTest([[{ time: 4, event: true }], []])).toMatchObject({
      degreesOfFreedom: 0,
      chiSquare: null,
      pValue: null,
    });
  });

  it("drops a group with no subjects from the degrees of freedom", () => {
    const two = logRankTest([SIX_MP, PLACEBO]);
    const withEmpty = logRankTest([SIX_MP, [], PLACEBO]);
    expect(withEmpty.degreesOfFreedom).toBe(1);
    expect(withEmpty.chiSquare!).toBeCloseTo(two.chiSquare!, 10);
    expect(withEmpty.observed).toEqual([9, 0, 21]);
  });

  it("rejects times and flags it cannot use", () => {
    expect(() => kaplanMeierEstimate([{ time: -1, event: true }])).toThrow(
      RangeError
    );
    expect(() =>
      kaplanMeierEstimate([{ time: Number.POSITIVE_INFINITY, event: true }])
    ).toThrow(RangeError);
    expect(() => logRankTest([[{ time: Number.NaN, event: false }]])).toThrow(
      RangeError
    );
  });

  it("keeps estimates and limits inside [0, 1] and the estimate non-increasing", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            time: fc.integer({ min: 0, max: 40 }),
            event: fc.boolean(),
          }),
          { maxLength: 60 }
        ),
        (observations) => {
          const { steps } = kaplanMeierEstimate(observations);
          let previous = 1;
          let total = 0;
          for (const step of steps) {
            expect(step.survival).toBeLessThanOrEqual(previous);
            expect(step.survival).toBeGreaterThanOrEqual(0);
            expect(step.standardError).toBeGreaterThanOrEqual(0);
            if (step.lower !== null && step.upper !== null) {
              expect(step.lower).toBeGreaterThanOrEqual(0);
              expect(step.lower).toBeLessThanOrEqual(step.survival);
              expect(step.upper).toBeGreaterThanOrEqual(step.survival);
              expect(step.upper).toBeLessThanOrEqual(1);
            }
            previous = step.survival;
            total += step.events + step.censored;
          }
          expect(total).toBe(observations.length);
          const test = logRankTest([observations, observations]);
          if (test.chiSquare !== null) {
            expect(test.chiSquare).toBeCloseTo(0, 8);
          }
        }
      )
    );
  });

  it("builds the figure with an arm that has no subjects", () => {
    const keepArm = DEMO_301_STUDY.design.arms[0].name;
    const adtte = adam(run, "ADTTE");
    const oneArm = withAdtte(
      run,
      (row) => adtte.columns.TRT01A[row] === keepArm
    );
    const built = buildTlfOutputs(DEMO_301_STUDY, oneArm);
    const [kept, ...empty] = built.figures[0].curves;
    expect(kept.points.length).toBeGreaterThan(1);
    for (const curve of empty) expect(curve.points).toEqual([]);
    expect(built.figures[0].test.text).toMatch(/not estimable/);
    expect(built.figures[0].summary).toContain(
      `${empty[0].label}: no subjects with a time to event.`
    );
    for (const row of built.figures[0].atRisk.slice(1)) {
      expect(row.cells.every((cell) => cell.text === "0")).toBe(true);
    }
    plottedValuesResolve(oneArm, built);
    expect(() => writeTlfFiles(built)).not.toThrow();
  });

  it("builds the figure with every subject censored", () => {
    const censored = withAdtte(
      run,
      () => true,
      (name, value) => (name === "CNSR" ? 1 : value)
    );
    const built = buildTlfOutputs(DEMO_301_STUDY, censored);
    for (const curve of built.figures[0].curves) {
      for (const point of curve.points) {
        expect(point.survivalText).toBe("1.0000");
        expect(point.limitsText).toBe("NE");
        expect(point.events).toBe(0);
      }
    }
    expect(built.figures[0].test.text).toMatch(/not estimable/);
    plottedValuesResolve(censored, built);
    expect(writeKmFigureSvg(built.figures[0])).not.toContain("fill-opacity");
  });

  it("builds the figure for a single subject", () => {
    const parameters = run.datasets.find((dataset) => dataset.name === "ADTTE")!
      .columns.PARAMCD;
    const eighth = parameters
      .map((value, row) => (value === "TTADISC" ? row : -1))
      .filter((row) => row >= 0)[7];
    const single = withAdtte(run, (row) => row === eighth);
    const built = buildTlfOutputs(DEMO_301_STUDY, single);
    const curves = built.figures[0].curves.filter(
      (curve) => curve.points.length > 0
    );
    expect(curves).toHaveLength(1);
    expect(curves[0].points.map((point) => point.atRisk)).toEqual([1, 1]);
    expect(built.figures[0].test.text).toMatch(/not estimable/);
    plottedValuesResolve(single, built);
  });

  it("builds the figure from tiny pipeline runs", () => {
    for (const [seed, nSubjects] of [
      [5, 1],
      [1, 6],
      [9, 12],
    ] as const) {
      const small = runPipeline(DEMO_301_STUDY, { seed, nSubjects });
      const built = buildTlfOutputs(DEMO_301_STUDY, small);
      plottedValuesResolve(small, built);
      expect(writeKmFigureHtml(built.figures[0])).toContain(
        SYNTHETIC_DATA_NOTICE
      );
    }
  });

  it("refuses more groups than it has distinct line styles", () => {
    const crowded: TlfKmFigure = {
      ...figure,
      curves: Array.from({ length: 9 }, () => figure.curves[0]),
    };
    expect(() => writeKmFigureSvg(crowded)).toThrow(RangeError);
  });
});

describe("Figure 14.2.2 in the reporting event", () => {
  const results = resultsOf(outputs);
  const adtte = adam(run, "ADTTE");
  const arms = DEMO_301_STUDY.design.arms.map((arm) => arm.name);

  it("is declared as an ARS output with its analyses, method and analysis set", () => {
    const output = event.outputs.find((item) => item.id === "Out_14_2_2")!;
    expect(output.fileSpecifications.map((file) => file.name)).toEqual([
      "f-14-2-2.html",
      "f-14-2-2.svg",
    ]);
    expect(output.displays[0].display.displayTitle).toBe(
      "Figure 14.2.2: Kaplan-Meier Estimate of Time to First TEAE Leading to Discontinuation (Safety Set)"
    );
    const item = event.mainListOfContents.contentsList.listItems.find(
      (entry) => entry.outputId === "Out_14_2_2"
    )!;
    expect(item.sublist!.listItems.map((entry) => entry.analysisId)).toEqual([
      "An_14_2_2_N",
      "An_14_2_2_KM",
      "An_14_2_2_ATRISK",
      "An_14_2_2_LOGRANK",
    ]);
    const km = event.analyses.find(
      (analysis) => analysis.id === "An_14_2_2_KM"
    )!;
    expect(km).toMatchObject({
      dataset: "ADTTE",
      variable: "AVAL",
      analysisSetId: "AnalysisSet_SAF",
      dataSubsetId: "Dss_TTADISC",
      methodId: "Mth_KM",
    });
    expect(
      event.dataSubsets.find((subset) => subset.id === "Dss_TTADISC")
    ).toMatchObject({
      condition: {
        dataset: "ADTTE",
        variable: "PARAMCD",
        comparator: "EQ",
        value: ["TTADISC"],
      },
    });
    const method = event.methods.find((item) => item.id === "Mth_KM")!;
    expect(method.description).toMatch(/log-log/);
    expect(method.description).toMatch(/Greenwood/);
    expect(method.operations.map((operation) => operation.id)).toEqual([
      "Mth_KM_NRISK",
      "Mth_KM_NEVENT",
      "Mth_KM_NCENS",
      "Mth_KM_SURV",
      "Mth_KM_SE",
      "Mth_KM_LCL",
      "Mth_KM_UCL",
    ]);
    expect(
      event.methods
        .find((item) => item.id === "Mth_LogRank")!
        .operations.map((operation) => operation.name)
    ).toEqual(["Chi-square", "DF", "p-value"]);
  });

  it("resolves every plotted value to a non-empty set of ADTTE rows", () => {
    let points = 0;
    for (const curve of figure.curves) {
      for (const point of curve.points) {
        points += 1;
        expect(point.resultIds).toHaveLength(7);
        const linked = point.resultIds.flatMap((id) =>
          resolveResultRows(event, rows, results.get(id)!)
        );
        expect(
          linked.filter(
            (row) => row.dataset === "ADTTE" && row.role === "analysis"
          ).length
        ).toBeGreaterThan(0);
        for (const id of point.resultIds) {
          expect(
            resolveResultRows(event, rows, results.get(id)!).length,
            id
          ).toBeGreaterThan(0);
        }
      }
    }
    expect(points).toBeGreaterThan(20);
  });

  it("links each at-risk, event and censoring count to exactly the rows it counts", () => {
    for (const curve of figure.curves) {
      for (const point of curve.points) {
        const [risk, events, censored] = point.resultIds.map((id) =>
          resolveResultRows(event, rows, results.get(id)!).filter(
            (row) => row.role === "analysis"
          )
        );
        expect(risk).toHaveLength(point.atRisk);
        expect(events).toHaveLength(point.events);
        expect(censored).toHaveLength(point.censored);
        for (const row of risk) {
          expect(adtte.columns.AVAL[row.rowIndex]).toBeGreaterThanOrEqual(
            point.time
          );
          expect(adtte.columns.TRT01A[row.rowIndex]).toBe(curve.label);
        }
        for (const row of events) {
          expect(adtte.columns.AVAL[row.rowIndex]).toBe(point.time);
          expect(adtte.columns.CNSR[row.rowIndex]).toBe(0);
        }
        for (const row of censored) {
          expect(adtte.columns.AVAL[row.rowIndex]).toBe(point.time);
          expect(adtte.columns.CNSR[row.rowIndex]).toBe(1);
        }
      }
    }
  });

  it("links each number-at-risk cell to the subjects still at risk", () => {
    figure.atRisk.forEach((row, rowIndex) => {
      row.cells.forEach((cell, cellIndex) => {
        const day = figure.atRiskTimes[cellIndex].time;
        const linked = resolveResultRows(
          event,
          rows,
          results.get(cell.resultIds[0])!
        );
        const analysed = linked.filter((item) => item.role === "analysis");
        expect(String(analysed.length)).toBe(cell.text);
        expect(linked.length).toBeGreaterThan(0);
        for (const item of analysed) {
          expect(item.dataset).toBe("ADTTE");
          expect(adtte.columns.AVAL[item.rowIndex]).toBeGreaterThanOrEqual(day);
          expect(adtte.columns.TRT01A[item.rowIndex]).toBe(arms[rowIndex]);
        }
      });
    });
    expect(figure.atRiskTimes.map((day) => day.time)).toEqual([
      1, 15, 29, 57, 85, 99,
    ]);
  });

  it("matches estimates computed directly from ADTTE", () => {
    const n = adtte.rowCount;
    figure.curves.forEach((curve, index) => {
      const observations = Array.from({ length: n }, (_, row) => row)
        .filter(
          (row) =>
            adtte.columns.TRT01A[row] === arms[index] &&
            adtte.columns.SAFFL[row] === "Y" &&
            adtte.columns.PARAMCD[row] === "TTADISC"
        )
        .map((row) => ({
          time: adtte.columns.AVAL[row] as number,
          event: adtte.columns.CNSR[row] === 0,
        }));
      const estimate = kaplanMeierEstimate(observations);
      expect(curve.points.slice(1).map((point) => point.time)).toEqual(
        estimate.steps.map((step) => step.time)
      );
      expect(curve.points[0]).toMatchObject({
        time: 0,
        atRisk: observations.length,
        survival: 1,
        limitsText: "NE",
      });
      curve.points.slice(1).forEach((point, position) => {
        expect(point.survival).toBe(estimate.steps[position].survival);
        expect(point.lower).toBe(estimate.steps[position].lower);
      });
    });
    const test = logRankTest(
      arms.map((arm) =>
        Array.from({ length: n }, (_, row) => row)
          .filter(
            (row) =>
              adtte.columns.TRT01A[row] === arm &&
              adtte.columns.PARAMCD[row] === "TTADISC"
          )
          .map((row) => ({
            time: adtte.columns.AVAL[row] as number,
            event: adtte.columns.CNSR[row] === 0,
          }))
      )
    );
    expect(figure.test.text).toBe(
      `Log-rank chi-square = ${test.chiSquare!.toFixed(2)} on 2 degrees of freedom, p = ${formatPValue(test.pValue!)}.`
    );
  });

  it("gives byte-identical ARS JSON and figure files for the same seed", () => {
    const again = buildTlfOutputs(
      DEMO_301_STUDY,
      runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 })
    );
    expect(writeArsJson(again.reportingEvent)).toBe(writeArsJson(event));
    expect(writeKmFigureSvg(again.figures[0])).toBe(writeKmFigureSvg(figure));
    expect(writeKmFigureHtml(again.figures[0])).toBe(writeKmFigureHtml(figure));
  });
});

describe("compact risk sets in the reporting event (#2729)", () => {
  const results = resultsOf(outputs);
  const adtte = event.rowSets.filter((set) => set.dataset === "ADTTE");
  const analysisSet = (result: ArsOperationResult) =>
    result.rowReferences.find((reference) => reference.role === "analysis")
      ?.rowSetId;

  it("lists each ADTTE row once, however many risk sets hold it", () => {
    const listed = adtte.flatMap((set) => set.rowIds);
    expect(new Set(listed).size).toBe(listed.length);
    expect(adtte.some((set) => (set.includes?.length ?? 0) > 0)).toBe(true);
    for (const set of adtte) {
      const ids = rowSetRowIds(event, set.id);
      expect(new Set(ids).size, set.id).toBe(ids.length);
      expect(ids.length, set.id).toBeGreaterThan(0);
    }
  });

  it("shares one row set between each number-at-risk cell and the Kaplan-Meier risk set on or after its day", () => {
    let shared = 0;
    figure.atRisk.forEach((row, rowIndex) => {
      const points = figure.curves[rowIndex].points;
      row.cells.forEach((cell, cellIndex) => {
        const day = figure.atRiskTimes[cellIndex].time;
        const point = points.find((item) => item.time >= day);
        const cellSet = analysisSet(results.get(cell.resultIds[0])!);
        if (!point) {
          expect(cellSet).toBeUndefined();
          return;
        }
        expect(cellSet).toBe(analysisSet(results.get(point.resultIds[0])!));
        shared += 1;
      });
    });
    expect(shared).toBeGreaterThan(figure.atRisk.length);
  });

  it("resolves composed sets to each row once, in dataset order", () => {
    for (const analysis of event.analyses.filter((item) =>
      item.id.startsWith("An_14_2_2_")
    )) {
      for (const result of analysis.results) {
        for (const reference of result.rowReferences) {
          const linked = resolveResultRows(event, rows, {
            ...result,
            rowReferences: [reference],
          });
          expect(linked).toHaveLength(
            rowSetRowIds(event, reference.rowSetId).length
          );
          linked.slice(1).forEach((row, index) => {
            expect(row.rowIndex, result.id).toBeGreaterThan(
              linked[index].rowIndex
            );
          });
        }
      }
    }
  });

  it("rejects an include that is missing, listed after its set, of another dataset, or the set itself", () => {
    const [first, second] = adtte.filter((set) => set.rowIds.length > 0);
    const adsl = event.rowSets.find((set) => set.dataset === "ADSL")!;
    const nesting = (sets: readonly ArsRowSet[]) => ({
      ...event,
      rowSets: sets,
    });
    const result: ArsOperationResult = {
      ...results.values().next().value!,
      rowReferences: [{ role: "analysis", rowSetId: "Outer" }],
    };
    const outer = (includes: readonly string[]): ArsRowSet => ({
      id: "Outer",
      dataset: "ADTTE",
      rowIds: [],
      includes,
    });
    const cases: readonly [readonly ArsRowSet[], RegExp][] = [
      [[first, outer(["Missing"])], /does not hold/],
      [[outer([first.id]), first], /not listed before it/],
      [[adsl, outer([adsl.id])], /holds ADSL rows, not ADTTE/],
      [[first, outer(["Outer"])], /not listed before it/],
    ];
    for (const [sets, message] of cases) {
      expect(() => rowSetRowIds(nesting(sets), "Outer")).toThrow(message);
      expect(() => resolveResultRows(nesting(sets), rows, result)).toThrow(
        RangeError
      );
    }
    expect(() => rowSetRowIds(event, "Missing")).toThrow(RangeError);
    expect(
      rowSetRowIds(
        nesting([first, second, outer([first.id, second.id])]),
        "Outer"
      )
    ).toHaveLength(new Set([...first.rowIds, ...second.rowIds]).size);
  });
});

describe("accessible figure files", () => {
  const svg = writeKmFigureSvg(figure);
  const html = writeKmFigureHtml(figure);

  it("writes an SVG image with a text alternative and the notice", () => {
    expect(
      svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns=')
    ).toBe(true);
    expect(svg).toContain(
      'role="img" aria-labelledby="f-14-2-2-svg-title f-14-2-2-svg-desc"'
    );
    expect(svg).toContain(
      '<title id="f-14-2-2-svg-title">Figure 14.2.2: Kaplan-Meier Estimate of Time to First TEAE Leading to Discontinuation (Safety Set)</title>'
    );
    expect(svg).toMatch(/<desc id="f-14-2-2-svg-desc">Kaplan-Meier curves/);
    expect(svg).toContain(SYNTHETIC_DATA_NOTICE);
    expect(svg).toContain("Number at risk");
    expect(svg).toContain(figure.test.text);
    expect(svg).toContain("@media (prefers-color-scheme: dark)");
    // Groups differ by line pattern as well as colour.
    expect(svg).toContain('stroke-dasharray="8 4"');
  });

  it("marks censored times on the curves", () => {
    const censoredTimes = figure.curves.flatMap((curve) =>
      curve.points.filter((point) => point.censored > 0)
    );
    expect(censoredTimes.length).toBeGreaterThan(0);
    const marks = svg.match(/<path d="M[^"]*" fill="none" stroke-width="1.5"/g);
    expect(marks).toHaveLength(
      figure.curves.filter((curve) =>
        curve.points.some((point) => point.censored > 0)
      ).length
    );
    const crosses = marks!.join("").match(/ V/g)!.length;
    expect(crosses).toBe(censoredTimes.length);
  });

  it("writes HTML with a captioned figure and a data-table fallback", () => {
    expect(html).toMatch(/^<!DOCTYPE html>\n<html lang="en">/);
    expect(html).toContain(
      '<figure id="f-14-2-2" aria-describedby="f-14-2-2-notes">'
    );
    expect(html).toContain(
      '<figcaption><span class="number">Figure 14.2.2</span>'
    );
    expect(html.match(/<table /g)).toHaveLength(2);
    const pointRows = figure.curves.reduce(
      (sum, curve) => sum + curve.points.length,
      0
    );
    expect(html.match(/<tr><th scope="row">Day \d+<\/th>/g)).toHaveLength(
      pointRows
    );
    expect(html).toContain("95% CI (log-log)");
    for (const note of figure.footnotes) {
      expect(html).toContain(note.replaceAll("'", "&#39;"));
    }
    expect(html).toContain(SYNTHETIC_DATA_NOTICE);
    expect(html).toContain('data-ars-results="An_14_2_2_KM.004"');
    // The inline SVG leaves the caption, notice and test to the page.
    expect(html).not.toContain('class="heading">Figure 14.2.2');
    expect(svg).toContain('class="heading">Figure 14.2.2');
    expect(html.match(/class="heading">Number at risk</g)).toHaveLength(1);
  });

  it("states the confidence method and makes no compliance claims", () => {
    expect(figure.footnotes.join(" ")).toMatch(
      /Greenwood's variance on the log-log scale/
    );
    for (const text of [svg, html, writeArsJson(event)]) {
      expect(findClinicalClaims(text)).toEqual([]);
      expect(text).not.toMatch(/\b(?:compliant|validated)\b|Part 11/i);
    }
  });
});
