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
  IDS,
  SEX_GROUPS,
  SUMMARY_OPERATIONS,
  reportedVisits,
  visitLabel,
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

/** The three tables, in output order: 14.1.1, 14.2.1 and 14.3.1. */
export function buildTables(
  definition: StudyDefinition,
  plan: ReportingPlan,
  analyses: readonly ArsAnalysis[]
): readonly TlfTable[] {
  const builder = new TableBuilder(new ResultIndex(analyses), plan);
  return [
    demographics(builder, definition),
    changeFromBaseline(builder, definition),
    adverseEvents(builder, analyses),
  ];
}
