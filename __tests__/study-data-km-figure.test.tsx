import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import { KmFigure } from "@/components/study-data/KmFigure";
import {
  kaplanMeierEstimate,
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
