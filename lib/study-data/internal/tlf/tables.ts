/**
 * Table render models built from analysis results. Every cell names the
 * results it shows; nothing here computes a statistic.
 */
import { SYNTHETIC_DATA_NOTICE } from "../../presets";
import type {
  ArsAnalysis,
  ArsResultGroup,
  StudyDefinition,
  TlfCell,
  TlfColumn,
  TlfRow,
  TlfSection,
  TlfTable,
} from "../../types";
import { ResultIndex } from "./evaluate";
import {
  AGE_GROUPS,
  hceComparison,
  hceStrata,
  IDS,
  SEX_GROUPS,
  SUMMARY_OPERATIONS,
  comparisons,
  reportedVisits,
  visitLabel,
  winRatioIds,
  type ReportingPlan,
} from "./plan";

const PRECISION_FOOTNOTE =
  "Mean and median are shown to one more decimal than the data, SD to two more, and percentages to one decimal, rounded half away from zero. SD uses the n - 1 denominator.";
const NOT_ESTIMABLE_FOOTNOTE =
  "NE: not estimable (no values, or fewer than two for SD).";

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function unitOf(definition: StudyDefinition, testCode: string): string {
  for (const activity of definition.design.activities) {
    for (const assessment of activity.assessments) {
      if (assessment.testCode === testCode && assessment.unit) {
        return assessment.unit;
      }
    }
  }
  return "";
}

function withUnit(label: string, unit: string): string {
  return unit ? `${label} (${unit})` : label;
}

class TableBuilder {
  constructor(
    private readonly index: ResultIndex,
    private readonly plan: ReportingPlan
  ) {}

  columns(bigNAnalysisId: string, groupingId: string): TlfColumn[] {
    const factor = this.plan.analysisGroupings.find(
      (item) => item.id === groupingId
    );
    if (!factor) throw new RangeError(`No grouping factor ${groupingId}.`);
    return factor.groups.map((group, position) => {
      const result = this.index.get(bigNAnalysisId, IDS.countN, [
        { groupingId, groupId: group.id },
      ]);
      return {
        id: `col${position + 1}`,
        label: group.label,
        groupingId,
        groupId: group.id,
        bigN: Number(result.rawValue),
        bigNResultId: result.id,
      };
    });
  }

  count(analysisId: string, groups: readonly ArsResultGroup[]): TlfCell {
    const n = this.index.get(analysisId, IDS.countPctN, groups);
    const percent = this.index.get(analysisId, IDS.countPctPct, groups);
    return {
      text:
        n.formattedValue === "0"
          ? "0"
          : `${n.formattedValue} (${percent.formattedValue})`,
      resultIds: [n.id, percent.id],
    };
  }

  /** One result as a cell. */
  value(
    analysisId: string,
    operationId: string,
    groups: readonly ArsResultGroup[] = []
  ): TlfCell {
    const result = this.index.get(analysisId, operationId, groups);
    return { text: result.formattedValue, resultIds: [result.id] };
  }

  /** An estimate and its confidence limits, as `1.23 (0.98, 1.54)`. */
  interval(
    analysisId: string,
    operationIds: readonly [string, string, string]
  ): TlfCell {
    const [estimate, lower, upper] = operationIds.map((operationId) =>
      this.index.get(analysisId, operationId, [])
    );
    return {
      text: `${estimate.formattedValue} (${lower.formattedValue}, ${upper.formattedValue})`,
      resultIds: [estimate.id, lower.id, upper.id],
    };
  }

  countValue(analysisId: string, groups: readonly ArsResultGroup[]): number {
    return Number(this.index.get(analysisId, IDS.countPctN, groups).rawValue);
  }

  summaryRows(
    idPrefix: string,
    analysisId: string,
    columns: readonly TlfColumn[],
    extra: readonly ArsResultGroup[] = []
  ): TlfRow[] {
    return SUMMARY_OPERATIONS.map((operation, position) => ({
      id: `${idPrefix}r${position + 1}`,
      label: operation.label,
      cells: columns.map((column) => {
        const result = this.index.get(analysisId, operation.id, [
          arm(column),
          ...extra,
        ]);
        return { text: result.formattedValue, resultIds: [result.id] };
      }),
    }));
  }
}

function arm(column: TlfColumn): ArsResultGroup {
  return { groupingId: column.groupingId, groupId: column.groupId };
}

function demographics(
  builder: TableBuilder,
  definition: StudyDefinition
): TlfTable {
  const columns = builder.columns(IDS.demogN, IDS.trt01a);
  const unitSys = unitOf(definition, "SYSBP");
  const unitDia = unitOf(definition, "DIABP");
  const categorical = (
    id: string,
    label: string,
    analysisId: string,
    groupingId: string,
    groups: readonly { readonly key: string; readonly label: string }[]
  ): TlfSection => ({
    id,
    label,
    rows: groups.map((group, position) => ({
      id: `${id}r${position + 1}`,
      label: group.label,
      cells: columns.map((column) =>
        builder.count(analysisId, [
          arm(column),
          { groupingId, groupId: `Grp_${group.key}` },
        ])
      ),
    })),
  });
  return {
    outputId: "Out_14_1_1",
    displayId: "Disp_14_1_1",
    number: "14.1.1",
    title: "Demographic and Baseline Characteristics",
    population: "Safety Set",
    stubHeader: "Characteristic",
    columns,
    sections: [
      {
        id: "s1",
        label: "Age (years)",
        rows: builder.summaryRows("s1", IDS.demogAge, columns),
      },
      categorical(
        "s2",
        "Age group (years), n (%)",
        IDS.demogAgeGroup,
        IDS.agegr1,
        AGE_GROUPS.map((value, position) => ({
          key: `AGEGR1_${position + 1}`,
          label: value,
        }))
      ),
      categorical(
        "s3",
        "Sex, n (%)",
        IDS.demogSex,
        IDS.sex,
        SEX_GROUPS.map((sex) => ({ key: `SEX_${sex.value}`, label: sex.label }))
      ),
      {
        id: "s4",
        label: withUnit("Baseline systolic blood pressure", unitSys),
        rows: builder.summaryRows("s4", IDS.demogSysbp, columns),
      },
      {
        id: "s5",
        label: withUnit("Baseline diastolic blood pressure", unitDia),
        rows: builder.summaryRows("s5", IDS.demogDiabp, columns),
      },
    ],
    footnotes: [
      "N is the number of subjects in the Safety Set (SAFFL = Y) in each group, by treatment received (TRT01A). Percentages use N as the denominator.",
      PRECISION_FOOTNOTE,
      NOT_ESTIMABLE_FOOTNOTE,
      "Source: ADSL.",
    ],
    notice: SYNTHETIC_DATA_NOTICE,
    fileBase: "t-14-1-1",
  };
}

function changeFromBaseline(
  builder: TableBuilder,
  definition: StudyDefinition
): TlfTable {
  const columns = builder.columns(IDS.cfbN, IDS.trt01p);
  const unit = unitOf(definition, "SYSBP");
  const { baseline, post } = reportedVisits(definition);
  const sections: TlfSection[] = [];
  const visitGroup = (groupingId: string, visitNum: number) => ({
    groupingId,
    groupId: `Grp_AVISITN_${visitNum}`,
  });
  for (const visit of [baseline, ...post]) {
    const observedId = `s${sections.length + 1}`;
    sections.push({
      id: observedId,
      label: `${visitLabel(visit.name)}, observed value`,
      rows: builder.summaryRows(observedId, IDS.cfbAval, columns, [
        visitGroup(IDS.visitAll, visit.visitNum),
      ]),
    });
    if (visit === baseline) continue;
    const changeId = `s${sections.length + 1}`;
    sections.push({
      id: changeId,
      label: `${visitLabel(visit.name)}, change from baseline`,
      rows: builder.summaryRows(changeId, IDS.cfbChg, columns, [
        visitGroup(IDS.visitPost, visit.visitNum),
      ]),
    });
  }
  return {
    outputId: "Out_14_2_1",
    displayId: "Disp_14_2_1",
    number: "14.2.1",
    title: `${withUnit("Systolic Blood Pressure", unit)}: Observed Values and Change from Baseline by Visit`,
    population: "Full Analysis Set",
    stubHeader: "Visit and statistic",
    columns,
    sections,
    footnotes: [
      "N is the number of subjects in the Full Analysis Set (ITTFL = Y) in each group, by planned treatment (TRT01P). n is the number of subjects with a value at the visit.",
      "Analysis records have PARAMCD = SYSBP and ANL01FL = Y; carried-forward rows (DTYPE = LOCF) are not analysis records. Change from baseline is CHG = AVAL - BASE.",
      PRECISION_FOOTNOTE,
      NOT_ESTIMABLE_FOOTNOTE,
      "Source: ADSL, ADVS.",
    ],
    notice: SYNTHETIC_DATA_NOTICE,
    fileBase: "t-14-2-1",
  };
}

function adverseEvents(
  builder: TableBuilder,
  analyses: readonly ArsAnalysis[]
): TlfTable {
  const columns = builder.columns(IDS.teaeN, IDS.trt01a);
  const observed = (analysisId: string) =>
    analyses.find((analysis) => analysis.id === analysisId)?.results ?? [];
  const valueOf = (groups: readonly ArsResultGroup[], groupingId: string) =>
    groups.find((group) => group.groupingId === groupingId)?.groupValue;
  const socs = [
    ...new Set(
      observed(IDS.teaeSoc).flatMap((result) => {
        const value = valueOf(result.resultGroups, IDS.soc);
        return value === undefined ? [] : [value];
      })
    ),
  ].sort(compareCodePoints);
  const total = (analysisId: string, groups: readonly ArsResultGroup[]) =>
    columns.reduce(
      (sum, column) =>
        sum + builder.countValue(analysisId, [arm(column), ...groups]),
      0
    );
  const sections: TlfSection[] = [
    {
      id: "s1",
      label: "Subjects with at least one TEAE",
      cells: columns.map((column) => builder.count(IDS.teaeAny, [arm(column)])),
      rows: [],
    },
  ];
  for (const soc of socs) {
    const socGroup = { groupingId: IDS.soc, groupValue: soc };
    const terms = [
      ...new Set(
        observed(IDS.teaePt).flatMap((result) => {
          if (valueOf(result.resultGroups, IDS.soc) !== soc) return [];
          const value = valueOf(result.resultGroups, IDS.pt);
          return value === undefined ? [] : [value];
        })
      ),
    ]
      .map((term) => ({
        term,
        total: total(IDS.teaePt, [
          socGroup,
          { groupingId: IDS.pt, groupValue: term },
        ]),
      }))
      .sort((a, b) => b.total - a.total || compareCodePoints(a.term, b.term));
    const id = `s${sections.length + 1}`;
    sections.push({
      id,
      label: soc,
      cells: columns.map((column) =>
        builder.count(IDS.teaeSoc, [arm(column), socGroup])
      ),
      rows: terms.map(({ term }, position) => ({
        id: `${id}r${position + 1}`,
        label: term,
        cells: columns.map((column) =>
          builder.count(IDS.teaePt, [
            arm(column),
            socGroup,
            { groupingId: IDS.pt, groupValue: term },
          ])
        ),
      })),
    });
  }
  return {
    outputId: "Out_14_3_1",
    displayId: "Disp_14_3_1",
    number: "14.3.1",
    title:
      "Treatment-Emergent Adverse Events by System Organ Class and Preferred Term",
    population: "Safety Set",
    stubHeader: "System organ class / Preferred term",
    columns,
    sections,
    footnotes: [
      "N is the number of subjects in the Safety Set (SAFFL = Y) in each group, by treatment received (TRT01A). Percentages use N as the denominator.",
      "TEAE: treatment-emergent adverse event (TRTEMFL = Y). A subject is counted once for each system organ class and once for each preferred term, however many events they had.",
      "System organ classes are in alphabetical order; preferred terms by descending total count, then alphabetically.",
      "Percentages are shown to one decimal, rounded half away from zero.",
      "Source: ADSL, ADAE.",
    ],
    notice: SYNTHETIC_DATA_NOTICE,
    fileBase: "t-14-3-1",
  };
}

function winStatistics(
  builder: TableBuilder,
  definition: StudyDefinition
): TlfTable | null {
  const compared = comparisons(definition);
  if (!compared) return null;
  const arms = definition.design.arms;
  const control = arms[compared.control];
  const hce = hceComparison(definition);
  const strata = hceStrata(hce);
  const fas = builder.columns(IDS.cfbN, IDS.trt01p);
  const columns = compared.treatments.map((treatment, position) => ({
    ...fas[treatment],
    id: `col${position + 1}`,
    label: `${arms[treatment].name} vs ${control.name}`,
  }));
  const ids = compared.treatments.map((treatment) =>
    winRatioIds(arms[treatment].armCode)
  );
  const row = (
    id: string,
    label: string,
    cell: (analyses: ReturnType<typeof winRatioIds>) => TlfCell
  ): TlfRow => ({ id, label, cells: ids.map(cell) });
  const sections: TlfSection[] = hce.components.map((component, position) => {
    const id = `s${position + 1}`;
    const groups = [
      { groupingId: IDS.hceComponent, groupId: `Grp_HCE_${component.paramcd}` },
    ];
    return {
      id,
      label: `${position + 1}. ${component.label}`,
      rows: [
        row(`${id}r1`, "Wins", (analyses) =>
          builder.value(analyses.components, IDS.winCompWins, groups)
        ),
        row(`${id}r2`, "Losses", (analyses) =>
          builder.value(analyses.components, IDS.winCompLosses, groups)
        ),
        row(`${id}r3`, "Ties after this component", (analyses) =>
          builder.value(analyses.components, IDS.winCompTies, groups)
        ),
      ],
    };
  });
  const overall = `s${sections.length + 1}`;
  sections.push({
    id: overall,
    label: "All components",
    rows: [
      row(`${overall}r1`, "Pairs compared", (analyses) =>
        builder.value(analyses.overall, IDS.winPairs)
      ),
      row(`${overall}r2`, "Wins", (analyses) =>
        builder.value(analyses.overall, IDS.winWins)
      ),
      row(`${overall}r3`, "Losses", (analyses) =>
        builder.value(analyses.overall, IDS.winLosses)
      ),
      row(`${overall}r4`, "Ties", (analyses) =>
        builder.value(analyses.overall, IDS.winTies)
      ),
      row(`${overall}r5`, "Win ratio (95% CI)", (analyses) =>
        builder.interval(analyses.overall, [
          IDS.winRatio,
          IDS.winRatioLcl,
          IDS.winRatioUcl,
        ])
      ),
      row(`${overall}r6`, "Win ratio p-value", (analyses) =>
        builder.value(analyses.overall, IDS.winRatioP)
      ),
      row(`${overall}r7`, "Net benefit (95% CI)", (analyses) =>
        builder.interval(analyses.overall, [
          IDS.netBenefit,
          IDS.netBenefitLcl,
          IDS.netBenefitUcl,
        ])
      ),
      row(`${overall}r8`, "Win odds (95% CI)", (analyses) =>
        builder.interval(analyses.overall, [
          IDS.winOdds,
          IDS.winOddsLcl,
          IDS.winOddsUcl,
        ])
      ),
      row(`${overall}r9`, "Finkelstein-Schoenfeld z", (analyses) =>
        builder.value(analyses.overall, IDS.fsZ)
      ),
      row(`${overall}r10`, "Finkelstein-Schoenfeld p-value", (analyses) =>
        builder.value(analyses.overall, IDS.fsP)
      ),
    ],
  });
  strata.forEach((stratum, position) => {
    const id = `s${sections.length + 1}`;
    const groups = [
      { groupingId: IDS.hceStratum, groupId: `Grp_STRATUM_${position + 1}` },
    ];
    sections.push({
      id,
      label: `Stratum: ${stratum.label}`,
      rows: [
        row(`${id}r1`, "Pairs compared", (analyses) =>
          builder.value(analyses.strata, IDS.winStrataPairs, groups)
        ),
        row(`${id}r2`, "Wins", (analyses) =>
          builder.value(analyses.strata, IDS.winStrataWins, groups)
        ),
        row(`${id}r3`, "Losses", (analyses) =>
          builder.value(analyses.strata, IDS.winStrataLosses, groups)
        ),
        row(`${id}r4`, "Ties", (analyses) =>
          builder.value(analyses.strata, IDS.winStrataTies, groups)
        ),
      ],
    });
  });
  const controlN = builder.columns(IDS.cfbN, IDS.trt01p)[compared.control];
  const factors = hce.strata
    .map((factor) => `${factor.factor} (${factor.adslVariable})`)
    .join(" and ");
  return {
    outputId: "Out_14_2_3",
    displayId: "Disp_14_2_3",
    number: "14.2.3",
    title:
      "Hierarchical Composite Endpoint: Win Ratio, Net Benefit and Win Odds",
    population: "Full Analysis Set",
    stubHeader: "Component and statistic",
    columns,
    sections,
    footnotes: [
      strata.length === 0
        ? `N is the number of subjects in the Full Analysis Set (ITTFL = Y) in the arm, by planned treatment (TRT01P). Each arm is compared with ${control.name} (N=${controlN.bigN}): every subject of the arm is paired with every subject of ${control.name}.`
        : `N is the number of subjects in the Full Analysis Set (ITTFL = Y) in the arm, by planned treatment (TRT01P). Each arm is compared with ${control.name} (N=${controlN.bigN}): every subject of the arm is paired with every subject of ${control.name} randomised in the same stratum of ${factors}.`,
      `A pair is decided on the first component, in the order shown, on which one subject is better: ${hce.components.map((component) => `${component.label} (${component.rule})`).join("; ")}. Wins are pairs decided in favour of the subject of the arm, losses pairs decided in favour of the ${control.name} subject.`,
      "Times to an event follow the Gehan rule: a pair is decided only when the earlier time is an event, so a censored time ties with any later time. A missing value ties with every value on that component.",
      strata.length === 0
        ? "Win ratio: wins over losses. Net benefit: wins less losses over pairs. Win odds: wins plus half the ties over losses plus half the ties. Confidence intervals use the U-statistic variances of Dong et al. (2016), on the log scale for the win ratio and win odds. Both p-values are two-sided."
        : `Pairs, wins, losses and ties are counted within each stratum; the strata's counts sum to the counts for all components. The win ratio, net benefit and win odds combine the strata with ${hce.weighting === "mantel-haenszel" ? "Mantel-Haenszel-type weights, each stratum's counts weighted by 1 over its number of subjects" : "equal weights"}: win ratio, weighted wins over weighted losses; net benefit, weighted wins less weighted losses over weighted pairs; win odds, weighted wins plus half the weighted ties over weighted losses plus half the weighted ties. Confidence intervals use the stratified U-statistic variances of Dong et al. (2018), on the log scale for the win ratio and win odds. The Finkelstein-Schoenfeld test sums the scores and variances of the strata. Both p-values are two-sided.`,
      "NE: not estimable.",
      "Source: ADSL, ADHCE.",
    ],
    notice: SYNTHETIC_DATA_NOTICE,
    fileBase: "t-14-2-3",
  };
}

/**
 * The tables, in output order: 14.1.1, 14.2.1, 14.2.3 when the study has a
 * comparator arm, and 14.3.1.
 */
export function buildTables(
  definition: StudyDefinition,
  plan: ReportingPlan,
  analyses: readonly ArsAnalysis[]
): readonly TlfTable[] {
  const builder = new TableBuilder(new ResultIndex(analyses), plan);
  const winRatio = winStatistics(builder, definition);
  return [
    demographics(builder, definition),
    changeFromBaseline(builder, definition),
    ...(winRatio ? [winRatio] : []),
    adverseEvents(builder, analyses),
  ];
}
