/**
 * The Kaplan-Meier figure as a render model built from analysis results.
 * Every plotted point and at-risk count names the results it shows;
 * nothing here computes a statistic.
 */
import { SYNTHETIC_DATA_NOTICE } from "../../presets";
import type {
  ArsAnalysis,
  ArsOperationResult,
  StudyDefinition,
  TlfAtRiskRow,
  TlfKmCurve,
  TlfKmFigure,
  TlfKmPoint,
} from "../../types";
import { ResultIndex } from "./evaluate";
import {
  IDS,
  KM_OPERATIONS,
  KM_PARAMCD,
  atRiskDays,
  type ReportingPlan,
} from "./plan";

const NOT_ESTIMABLE = "NE";

function numberOf(result: ArsOperationResult | undefined): number | null {
  if (result?.rawValue === undefined) return null;
  return Number(result.rawValue);
}

function curvePoints(
  analysis: ArsAnalysis | undefined,
  groupId: string
): TlfKmPoint[] {
  const byTime = new Map<string, Map<string, ArsOperationResult>>();
  for (const result of analysis?.results ?? []) {
    const arm = result.resultGroups.find(
      (group) => group.groupingId === IDS.trt01a
    );
    const time = result.resultGroups.find(
      (group) => group.groupingId === IDS.tteTime
    )?.groupValue;
    if (arm?.groupId !== groupId || time === undefined) continue;
    const operations = byTime.get(time) ?? new Map();
    operations.set(result.operationId, result);
    byTime.set(time, operations);
  }
  return [...byTime.entries()]
    .map(([time, operations]) => {
      const get = (id: string): ArsOperationResult => {
        const found = operations.get(id);
        if (!found) {
          throw new RangeError(`No ${id} result for ${groupId} at ${time}.`);
        }
        return found;
      };
      const lower = get(IDS.kmLcl);
      const upper = get(IDS.kmUcl);
      return {
        time: Number(time),
        atRisk: numberOf(get(IDS.kmNRisk)) ?? 0,
        events: numberOf(get(IDS.kmNEvent)) ?? 0,
        censored: numberOf(get(IDS.kmNCens)) ?? 0,
        survival: numberOf(get(IDS.kmSurv)) ?? 1,
        lower: numberOf(lower),
        upper: numberOf(upper),
        survivalText: get(IDS.kmSurv).formattedValue,
        standardErrorText: get(IDS.kmSe).formattedValue,
        limitsText:
          lower.rawValue === undefined || upper.rawValue === undefined
            ? NOT_ESTIMABLE
            : `(${lower.formattedValue}, ${upper.formattedValue})`,
        resultIds: KM_OPERATIONS.map((operation) => get(operation.id).id),
      };
    })
    .sort((a, b) => a.time - b.time);
}

function describeCurve(curve: TlfKmCurve): string {
  if (curve.points.length === 0) {
    return `${curve.label}: no subjects with a time to event.`;
  }
  const subjects = curve.points[0].atRisk;
  const events = curve.points.reduce((sum, point) => sum + point.events, 0);
  const last = curve.points[curve.points.length - 1];
  return `${curve.label}: ${subjects} subject${subjects === 1 ? "" : "s"}, ${events} event${events === 1 ? "" : "s"}, ${subjects - events} censored; estimated probability of no event ${last.survivalText} at day ${last.time}, the last observed time.`;
}

/**
 * Figure 14.2.2: Kaplan-Meier estimate of time to first TEAE leading to
 * discontinuation by treatment received, Safety Set, with the number at
 * risk on each scheduled day and the log-rank test.
 */
export function buildKmFigure(
  definition: StudyDefinition,
  plan: ReportingPlan,
  analyses: readonly ArsAnalysis[]
): TlfKmFigure {
  const index = new ResultIndex(analyses);
  const factor = plan.analysisGroupings.find((item) => item.id === IDS.trt01a);
  if (!factor) throw new RangeError(`No grouping factor ${IDS.trt01a}.`);
  const curveAnalysis = analyses.find(
    (analysis) => analysis.id === IDS.kmCurve
  );
  const days = atRiskDays(definition);
  const curves: TlfKmCurve[] = factor.groups.map((group, position) => {
    const bigN = index.get(IDS.kmN, IDS.countN, [
      { groupingId: factor.id, groupId: group.id },
    ]);
    return {
      id: `curve${position + 1}`,
      label: group.label,
      groupingId: factor.id,
      groupId: group.id,
      bigN: Number(bigN.rawValue),
      bigNResultId: bigN.id,
      points: curvePoints(curveAnalysis, group.id),
    };
  });
  const atRisk: TlfAtRiskRow[] = curves.map((curve) => ({
    curveId: curve.id,
    label: curve.label,
    cells: days.map((day) => {
      const result = index.get(IDS.kmAtRisk, IDS.countN, [
        { groupingId: curve.groupingId, groupId: curve.groupId },
        { groupingId: IDS.atRiskDay, groupId: `Grp_ATRISK_${day.time}` },
      ]);
      return { text: result.formattedValue, resultIds: [result.id] };
    }),
  }));
  const chiSquare = index.get(IDS.kmLogRank, IDS.logRankChiSq, []);
  const degrees = index.get(IDS.kmLogRank, IDS.logRankDf, []);
  const pValue = index.get(IDS.kmLogRank, IDS.logRankP, []);
  const testText =
    chiSquare.rawValue === undefined
      ? "Log-rank test: not estimable (no events, or fewer than two treatment groups with subjects at risk at an event time)."
      : `Log-rank chi-square = ${chiSquare.formattedValue} on ${degrees.formattedValue} degree${degrees.formattedValue === "1" ? "" : "s"} of freedom, p ${pValue.formattedValue.startsWith("<") ? pValue.formattedValue.replace("<", "< ") : `= ${pValue.formattedValue}`}.`;
  const summary = [
    "Kaplan-Meier curves of the probability of no TEAE leading to discontinuation, by study day, one curve per treatment group.",
    ...curves.map(describeCurve),
    testText,
    "The data tables give every plotted value and the number at risk.",
  ].join(" ");
  return {
    outputId: "Out_14_2_2",
    displayId: "Disp_14_2_2",
    number: "14.2.2",
    title:
      "Kaplan-Meier Estimate of Time to First TEAE Leading to Discontinuation",
    population: "Safety Set",
    xLabel: "Study day (Day 1 is the first dose)",
    yLabel: "Probability of no TEAE leading to discontinuation",
    curves,
    atRiskTimes: days,
    atRisk,
    test: {
      text: testText,
      resultIds: [chiSquare.id, degrees.id, pValue.id],
    },
    summary,
    footnotes: [
      `Time to event is ADTTE.AVAL for PARAMCD = ${KM_PARAMCD}, in days from the first dose (Day 1). CNSR = 0 is an event; subjects without one are censored at the earlier of last known contact and discontinuation for another reason. Censored times are marked + on the curves.`,
      "Product-limit (Kaplan-Meier) estimate; tied events at one time make a single step, and subjects censored at that time are counted at risk for it.",
      "Shaded bands are pointwise 95% confidence intervals from Greenwood's variance on the log-log scale, exp(-exp(log(-log S) +/- 1.96 sigma)); NE where S is 1 or 0.",
      "Number at risk: subjects whose AVAL is on or after the day. Groups are by treatment received (TRT01A); N is the number of subjects in the Safety Set (SAFFL = Y).",
      "Unstratified log-rank test across treatment groups.",
      "Source: ADSL, ADTTE.",
    ],
    notice: SYNTHETIC_DATA_NOTICE,
    fileBase: "f-14-2-2",
  };
}
