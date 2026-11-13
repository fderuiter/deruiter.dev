import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import { KmFigure } from "@/components/study-data/KmFigure";
import { TlfPanel } from "@/components/study-data/TlfPanel";
import {
  DEMO_301_STUDY,
  buildTlfOutputs,
  kaplanMeierEstimate,
  runPipeline,
  writeKmFigureHtml,
  writeKmFigureSvg,
  type ArsOperationResult,
  type CellValue,
  type PipelineRun,
  type SurvivalObservation,
  type TlfKmCurve,
  type TlfKmFigure,
} from "@/lib/study-data";

/**
 * The Kaplan-Meier figure drawn from the real product-limit estimator over a
 * fixed event list with censored subjects, with no engine mocks (#3483).
 */

afterEach(cleanup);

/**
 * Two events tie at day 10 and two censorings tie at day 15, so a step is
 * one per event time and a tick one per censoring time, not per subject.
 */
const OBSERVATIONS: readonly SurvivalObservation[] = [
  { time: 10, event: true },
  { time: 10, event: true },
  { time: 15, event: false },
  { time: 15, event: false },
  { time: 20, event: true },
  { time: 25, event: false },
  { time: 30, event: true },
  { time: 42, event: false },
];

function curveFrom(
  id: string,
  label: string,
  observations: readonly SurvivalObservation[]
): TlfKmCurve {
  const estimate = kaplanMeierEstimate(observations);
  return fromPartial<TlfKmCurve>({
    id,
    label,
    bigN: estimate.n,
    points: [
      {
        time: 0,
        atRisk: estimate.n,
        events: 0,
        censored: 0,
        survival: 1,
        lower: null,
        upper: null,
      },
      ...estimate.steps.map((step) => ({
        time: step.time,
        atRisk: step.atRisk,
        events: step.events,
        censored: step.censored,
        survival: step.survival,
        lower: step.lower,
        upper: step.upper,
      })),
    ],
  });
}

function figureOf(curves: TlfKmCurve[]): TlfKmFigure {
  return fromPartial<TlfKmFigure>({
    number: "14.2.2",
    title: "Kaplan-Meier test figure",
    population: "Safety Set",
    summary: "Two curves from a fixed event list.",
    xLabel: "Study day",
    yLabel: "Probability",
    curves,
    atRiskTimes: [{ time: 0 }, { time: 14 }, { time: 28 }],
  });
}

const eventTimes = [
  ...new Set(OBSERVATIONS.filter((o) => o.event).map((o) => o.time)),
];
const censorTimes = [
  ...new Set(OBSERVATIONS.filter((o) => !o.event).map((o) => o.time)),
];

/** The step path of each curve: the unfilled 2px strokes in the plot. */
function stepPaths(container: HTMLElement): SVGPathElement[] {
  const plot = container.querySelector('svg[role="img"]')!;
  return [...plot.querySelectorAll<SVGPathElement>('path[fill="none"]')];
}

/** Censoring ticks: 8px vertical strokes. */
function ticks(container: HTMLElement): SVGPathElement[] {
  const plot = container.querySelector('svg[role="img"]')!;
  return [...plot.querySelectorAll<SVGPathElement>("path")].filter((p) =>
    / v8$/.test(p.getAttribute("d") ?? "")
  );
}

describe("KmFigure", () => {
  it("draws one drop per event time and one tick per censoring time", () => {
    const { container } = render(
      <KmFigure
        figure={figureOf([curveFrom("curve1", "Placebo", OBSERVATIONS)])}
      />
    );

    const [step] = stepPaths(container);
    const drops = (step.getAttribute("d") ?? "").match(/V/g) ?? [];
    expect(drops).toHaveLength(eventTimes.length);
    expect(ticks(container)).toHaveLength(censorTimes.length);
  });

  it("draws each curve with its own series and lists it in the legend", () => {
    const second = OBSERVATIONS.map((o) => ({ ...o, time: o.time + 3 }));
    const { container, getByText, getByRole } = render(
      <KmFigure
        figure={figureOf([
          curveFrom("curve1", "Placebo", OBSERVATIONS),
          curveFrom("curve2", "Drug 10 mg", second),
        ])}
      />
    );

    const steps = stepPaths(container);
    expect(steps).toHaveLength(2);
    expect(steps[0].getAttribute("stroke")).not.toBe(
      steps[1].getAttribute("stroke")
    );
    expect(ticks(container)).toHaveLength(censorTimes.length * 2);
    expect(getByText("Placebo (N=8)")).toBeTruthy();
    expect(getByText("Drug 10 mg (N=8)")).toBeTruthy();
    expect(
      getByRole("img", { name: /Figure 14\.2\.2: Kaplan-Meier test figure/ })
    ).toBeTruthy();
  });

  it("draws nothing for a group with no records", () => {
    const empty = fromPartial<TlfKmCurve>({
      id: "curve1",
      label: "Empty",
      bigN: 0,
      points: [],
    });
    const { container } = render(<KmFigure figure={figureOf([empty])} />);
    expect(stepPaths(container)[0].getAttribute("d")).toBe("");
    expect(ticks(container)).toHaveLength(0);
  });
});

function withUpdatedAdtte(
  source: PipelineRun,
  mapRow: (row: {
    trt: CellValue;
    paramcd: CellValue;
    aval: CellValue;
    cnsr: CellValue;
  }) => { aval: CellValue; cnsr: CellValue }
): PipelineRun {
  return {
    ...source,
    datasets: source.datasets.map((dataset) => {
      if (dataset.name !== "ADTTE" || dataset.layer !== "adam") return dataset;
      const avals: CellValue[] = [];
      const cnsrs: CellValue[] = [];
      for (let i = 0; i < dataset.rowCount; i += 1) {
        const mapped = mapRow({
          trt: dataset.columns.TRT01A[i] ?? null,
          paramcd: dataset.columns.PARAMCD[i] ?? null,
          aval: dataset.columns.AVAL[i] ?? null,
          cnsr: dataset.columns.CNSR[i] ?? null,
        });
        avals.push(mapped.aval);
        cnsrs.push(mapped.cnsr);
      }
      return {
        ...dataset,
        columns: {
          ...dataset.columns,
          AVAL: avals,
          CNSR: cnsrs,
        },
      };
    }),
  };
}

function logRankResultsOf(
  analyses: readonly { readonly id: string; readonly results: readonly ArsOperationResult[] }[]
): readonly ArsOperationResult[] {
  const analysis = analyses.find((item) => item.id === "An_14_2_2_LOGRANK");
  if (!analysis) {
    throw new Error("Missing An_14_2_2_LOGRANK analysis");
  }
  return analysis.results;
}

describe("KmFigure log-rank p-value formatting and sink escaping (#3829)", () => {
  const baseRun = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });

  it("formats threshold p-values (<0.0001) as 'p < 0.0001.' across React DOM, SVG, and HTML sinks", () => {
    const separatedRun = withUpdatedAdtte(baseRun, ({ trt, paramcd, aval, cnsr }) => {
      if (paramcd !== "TTADISC") return { aval, cnsr };
      return trt === "Placebo" ? { aval: 5, cnsr: 0 } : { aval: 100, cnsr: 1 };
    });
    const built = buildTlfOutputs(DEMO_301_STUDY, separatedRun);
    const kmFigure = built.figures[0];
    const logRankResults = logRankResultsOf(built.reportingEvent.analyses);
    const [chiSquare, degrees, pValue] = logRankResults;

    expect(chiSquare.rawValue).toBeDefined();
    expect(pValue.formattedValue).toBe("<0.0001");
    expect(kmFigure.test.resultIds).toEqual([
      chiSquare.id,
      degrees.id,
      pValue.id,
    ]);
    expect(kmFigure.test.text).toContain("p < 0.0001.");
    expect(kmFigure.summary).toContain("p < 0.0001.");
    expect(kmFigure.test.text).not.toContain("p <0.0001.");
    expect(kmFigure.test.text).not.toContain("p = <0.0001.");

    const { container: kmContainer } = render(<KmFigure figure={kmFigure} />);
    const desc = kmContainer.querySelector("desc");
    expect(desc?.textContent).toContain("p < 0.0001.");
    cleanup();

    const { container: panelContainer } = render(
      <TlfPanel
        tables={[]}
        figures={[kmFigure]}
        current={kmFigure.outputId}
        onCurrent={() => {}}
        selected={null}
        onTrace={() => {}}
      />
    );
    const testButton = panelContainer.querySelector(
      `button[data-ars-results="${kmFigure.test.resultIds.join(" ")}"]`
    );
    expect(testButton?.textContent).toContain("p < 0.0001.");

    const svg = writeKmFigureSvg(kmFigure);
    expect(svg).toContain("p &lt; 0.0001.");
    expect(svg).not.toContain("p < 0.0001.");
    expect(svg).not.toContain("p &lt;0.0001.");

    const html = writeKmFigureHtml(kmFigure);
    expect(html).toContain("p &lt; 0.0001.");
    expect(html).not.toContain("p < 0.0001.");
    expect(html).not.toContain("p &lt;0.0001.");
  });

  it("preserves ordinary p-values and not-estimable log-rank output", () => {
    const ordinaryBuilt = buildTlfOutputs(DEMO_301_STUDY, baseRun);
    const ordinaryFigure = ordinaryBuilt.figures[0];
    const [ordChiSq, ordDf, ordP] = logRankResultsOf(
      ordinaryBuilt.reportingEvent.analyses
    );

    expect(ordChiSq.rawValue).toBeDefined();
    expect(ordP.formattedValue).toBe("0.5162");
    expect(ordinaryFigure.test.resultIds).toEqual([
      ordChiSq.id,
      ordDf.id,
      ordP.id,
    ]);
    expect(ordinaryFigure.test.text).toBe(
      `Log-rank chi-square = ${ordChiSq.formattedValue} on ${ordDf.formattedValue} degrees of freedom, p = 0.5162.`
    );
    expect(ordinaryFigure.summary).toContain("p = 0.5162.");

    const censoredRun = withUpdatedAdtte(baseRun, ({ aval }) => ({
      aval,
      cnsr: 1,
    }));
    const notEstimableBuilt = buildTlfOutputs(DEMO_301_STUDY, censoredRun);
    const notEstimableFigure = notEstimableBuilt.figures[0];
    const [neChiSq, neDf, neP] = logRankResultsOf(
      notEstimableBuilt.reportingEvent.analyses
    );

    expect(neChiSq.rawValue).toBeUndefined();
    expect(notEstimableFigure.test.resultIds).toEqual([
      neChiSq.id,
      neDf.id,
      neP.id,
    ]);
    expect(notEstimableFigure.test.text).toBe(
      "Log-rank test: not estimable (no events, or fewer than two treatment groups with subjects at risk at an event time)."
    );
    expect(notEstimableFigure.summary).toContain("Log-rank test: not estimable");
  });

  it("escapes synthetic markup-looking text in React DOM and SVG/HTML exports", () => {
    const payload = '<script>alert("xss")</script>';
    const baseFigure = buildTlfOutputs(DEMO_301_STUDY, baseRun).figures[0];
    const taintedFigure: TlfKmFigure = {
      ...baseFigure,
      title: `${baseFigure.title} ${payload}`,
      population: `${baseFigure.population} ${payload}`,
      summary: `${baseFigure.summary} ${payload}`,
      test: {
        ...baseFigure.test,
        text: `${baseFigure.test.text} ${payload}`,
      },
    };

    const { container: kmContainer } = render(
      <KmFigure figure={taintedFigure} />
    );
    expect(kmContainer.querySelector("script")).toBeNull();
    expect(kmContainer.querySelector("title")?.textContent).toContain(payload);
    expect(kmContainer.querySelector("desc")?.textContent).toContain(payload);
    cleanup();

    const { container: panelContainer } = render(
      <TlfPanel
        tables={[]}
        figures={[taintedFigure]}
        current={taintedFigure.outputId}
        onCurrent={() => {}}
        selected={null}
        onTrace={() => {}}
      />
    );
    expect(panelContainer.querySelector("script")).toBeNull();
    expect(panelContainer.querySelector("h3")?.textContent).toContain(payload);
    expect(
      panelContainer.querySelector(
        `button[data-ars-results="${taintedFigure.test.resultIds.join(" ")}"]`
      )?.textContent
    ).toContain(payload);

    const expectedEscaped = "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;";
    const svg = writeKmFigureSvg(taintedFigure);
    expect(svg).toContain(expectedEscaped);
    expect(svg).not.toContain(payload);
    expect(svg).not.toContain("&amp;lt;script&amp;gt;");

    const html = writeKmFigureHtml(taintedFigure);
    expect(html).toContain(expectedEscaped);
    expect(html).not.toContain(payload);
    expect(html).not.toContain("&amp;lt;script&amp;gt;");
  });
});
