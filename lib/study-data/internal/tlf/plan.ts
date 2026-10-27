/**
 * The reporting plan, declared as data: analysis sets, grouping factors,
 * data subsets, methods and analyses, in the shape of ARS 1.0. The engine
 * in `evaluate.ts` reads this plan and knows nothing about the outputs: the
 * tables and the Kaplan-Meier figure each add their own groupings, subsets,
 * methods and analyses here.
 */
import type {
  ArsAnalysis,
  ArsAnalysisMethod,
  ArsAnalysisSet,
  ArsCondition,
  ArsDataSubset,
  ArsGroup,
  ArsGroupingFactor,
  ArsNestedWhereClause,
  ArsSponsorTermRef,
  ArsTerminologyExtension,
  ArsWhereClause,
  StudyDefinition,
  VisitDefinition,
} from "../../types";

/** An analysis before it is run: everything but its results. */
export type AnalysisSpec = Omit<ArsAnalysis, "results" | "rawDecimals"> & {
  /**
   * Variable whose recorded decimals set the display precision, when it is
   * not the analysis variable itself. CHG is a difference of AVAL values,
   * so it is shown at AVAL's precision rather than with the floating-point
   * noise of the subtraction.
   */
  readonly precisionVariable?: string;
};

/** Everything the engine needs to run the analyses. */
export interface ReportingPlan {
  readonly analysisSets: readonly ArsAnalysisSet[];
  readonly analysisGroupings: readonly ArsGroupingFactor[];
  readonly dataSubsets: readonly ArsDataSubset[];
  readonly methods: readonly ArsAnalysisMethod[];
  readonly analyses: readonly AnalysisSpec[];
}

/** Ids the table builders look results up by. */
export const IDS = {
  saf: "AnalysisSet_SAF",
  fas: "AnalysisSet_FAS",
  trt01a: "AnlsGrouping_TRT01A",
  trt01p: "AnlsGrouping_TRT01P",
  agegr1: "AnlsGrouping_AGEGR1",
  sex: "AnlsGrouping_SEX",
  soc: "AnlsGrouping_AEBODSYS",
  pt: "AnlsGrouping_AEDECOD",
  visitAll: "AnlsGrouping_AVISITN",
  visitPost: "AnlsGrouping_AVISITN_POST",
  teae: "Dss_TEAE",
  sysbp: "Dss_SYSBP_ANL",
  sysbpPost: "Dss_SYSBP_ANL_POST",
  count: "Mth_Count",
  countN: "Mth_Count_N",
  countPct: "Mth_CountPct",
  countPctN: "Mth_CountPct_n",
  countPctPct: "Mth_CountPct_Pct",
  countPctNum: "Mth_CountPct_Pct_NUM",
  countPctDen: "Mth_CountPct_Pct_DEN",
  summ: "Mth_Summ",
  summN: "Mth_Summ_n",
  summMean: "Mth_Summ_Mean",
  summSd: "Mth_Summ_SD",
  summMedian: "Mth_Summ_Median",
  summMin: "Mth_Summ_Min",
  summMax: "Mth_Summ_Max",
  demogN: "An_14_1_1_N",
  demogAge: "An_14_1_1_AGE",
  demogAgeGroup: "An_14_1_1_AGEGR1",
  demogSex: "An_14_1_1_SEX",
  demogSysbp: "An_14_1_1_BSYSBP",
  demogDiabp: "An_14_1_1_BDIABP",
  cfbN: "An_14_2_1_N",
  cfbAval: "An_14_2_1_AVAL",
  cfbChg: "An_14_2_1_CHG",
  teaeN: "An_14_3_1_N",
  teaeAny: "An_14_3_1_ANY",
  teaeSoc: "An_14_3_1_SOC",
  teaePt: "An_14_3_1_PT",
  tteTime: "AnlsGrouping_ADTTE_AVAL",
  atRiskDay: "AnlsGrouping_ADTTE_ATRISK",
  ttadisc: "Dss_TTADISC",
  km: "Mth_KM",
  kmNRisk: "Mth_KM_NRISK",
  kmNEvent: "Mth_KM_NEVENT",
  kmNCens: "Mth_KM_NCENS",
  kmSurv: "Mth_KM_SURV",
  kmSe: "Mth_KM_SE",
  kmLcl: "Mth_KM_LCL",
  kmUcl: "Mth_KM_UCL",
  logRank: "Mth_LogRank",
  logRankChiSq: "Mth_LogRank_CHISQ",
  logRankDf: "Mth_LogRank_DF",
  logRankP: "Mth_LogRank_PVAL",
  kmN: "An_14_2_2_N",
  kmAtRisk: "An_14_2_2_ATRISK",
  kmCurve: "An_14_2_2_KM",
  kmLogRank: "An_14_2_2_LOGRANK",
} as const;

/** Decimals the survival estimate, its SE and its limits are shown with. */
export const KM_DECIMALS = 4;

/** Kaplan-Meier operations in display order, with what each reports. */
export const KM_OPERATIONS = [
  {
    id: IDS.kmNRisk,
    name: "n at risk",
    kind: "atRisk",
    label: "Subjects with AVAL at or after t, an integer",
    resultPattern: "XX",
  },
  {
    id: IDS.kmNEvent,
    name: "n events",
    kind: "events",
    label: "Events at t, an integer",
    resultPattern: "XX",
  },
  {
    id: IDS.kmNCens,
    name: "n censored",
    kind: "censored",
    label: "Censorings at t, an integer",
    resultPattern: "XX",
  },
  {
    id: IDS.kmSurv,
    name: "Survival",
    kind: "survival",
    label: `Survival estimate after t, ${KM_DECIMALS} decimals`,
    resultPattern: "X.XXXX",
  },
  {
    id: IDS.kmSe,
    name: "SE",
    kind: "standardError",
    label: `Greenwood standard error, ${KM_DECIMALS} decimals`,
    resultPattern: "X.XXXX",
  },
  {
    id: IDS.kmLcl,
    name: "Lower 95% CL",
    kind: "lower",
    label: `Lower 95% confidence limit, log-log transform, ${KM_DECIMALS} decimals`,
    resultPattern: "X.XXXX",
  },
  {
    id: IDS.kmUcl,
    name: "Upper 95% CL",
    kind: "upper",
    label: `Upper 95% confidence limit, log-log transform, ${KM_DECIMALS} decimals`,
    resultPattern: "X.XXXX",
  },
] as const;

/** The ADTTE parameter the figure analyses. */
export const KM_PARAMCD = "TTADISC";

/** Summary operations in display order, with their row labels. */
export const SUMMARY_OPERATIONS = [
  { id: IDS.summN, label: "n", kind: "n" },
  { id: IDS.summMean, label: "Mean", kind: "mean" },
  { id: IDS.summSd, label: "SD", kind: "sd" },
  { id: IDS.summMedian, label: "Median", kind: "median" },
  { id: IDS.summMin, label: "Min", kind: "min" },
  { id: IDS.summMax, label: "Max", kind: "max" },
] as const;

/** Pre-specified age groups, matching the ADSL AGEGR1 derivation. */
export const AGE_GROUPS = ["<40", "40-64", "65+"] as const;

/** Pre-specified sex groups and their labels. */
export const SEX_GROUPS = [
  { value: "F", label: "Female" },
  { value: "M", label: "Male" },
] as const;

const SPECIFIED_IN_SAP = { controlledTerm: "SPECIFIED IN SAP" } as const;

/**
 * Sponsor terms for values ARS 1.0 terminology does not list. ARS lists
 * outcome measures as analysis purposes, and pdf, rtf and txt as output
 * file types: demographics describe the population rather than measure an
 * endpoint, and the figure and the tables are also written as HTML and SVG.
 */
export const TERMINOLOGY_EXTENSIONS: readonly ArsTerminologyExtension[] = [
  {
    id: "TermExt_AnalysisPurpose",
    enumeration: "AnalysisPurposeEnum",
    sponsorTerms: [
      {
        id: "SponsorTerm_Purpose_BASELINE",
        submissionValue: "BASELINE CHARACTERISTICS",
        description:
          "Describes the analysis population at baseline. It measures no study endpoint.",
      },
    ],
  },
  {
    id: "TermExt_OutputFileType",
    enumeration: "OutputFileTypeEnum",
    sponsorTerms: [
      {
        id: "SponsorTerm_FileType_HTML",
        submissionValue: "html",
        description: "An accessible HTML document.",
      },
      {
        id: "SponsorTerm_FileType_SVG",
        submissionValue: "svg",
        description: "A Scalable Vector Graphics image.",
      },
    ],
  },
];

const BASELINE_PURPOSE: ArsSponsorTermRef = {
  sponsorTermId: "SponsorTerm_Purpose_BASELINE",
};

function where(
  dataset: string,
  variable: string,
  comparator: ArsCondition["comparator"],
  ...value: string[]
): ArsWhereClause {
  return { condition: { dataset, variable, comparator, value } };
}

/**
 * A clause placed inside a compound expression at `level` and `order`. A
 * compound clause moved down a level takes its own clauses down with it.
 */
function nested(
  clause: ArsWhereClause,
  level: number,
  order: number
): ArsNestedWhereClause {
  if ("condition" in clause)
    return { level, order, condition: clause.condition };
  const { logicalOperator, whereClauses } = clause.compoundExpression;
  return {
    level,
    order,
    compoundExpression: {
      logicalOperator,
      whereClauses: whereClauses.map((inner, index) =>
        nested(inner, level + 1, index + 1)
      ),
    },
  };
}

/** Clauses joined by AND, for an analysis set, group or subset at level 1. */
function and(...whereClauses: ArsWhereClause[]): ArsWhereClause {
  return {
    compoundExpression: {
      logicalOperator: "AND",
      whereClauses: whereClauses.map((clause, index) =>
        nested(clause, 2, index + 1)
      ),
    },
  };
}

function group(
  factor: string,
  key: string,
  name: string,
  label: string,
  order: number,
  clause: ArsWhereClause
): ArsGroup {
  return {
    id: `Grp_${factor}_${key}`,
    name,
    label,
    level: 1,
    order,
    ...clause,
  };
}

/** A visit name in sentence case: `WEEK 12` becomes `Week 12`. */
export function visitLabel(name: string): string {
  const lower = name.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * The visits the change-from-baseline table reports: the baseline visit (the
 * first planned on or after day 1) and every later visit, in schedule order.
 */
export function reportedVisits(definition: StudyDefinition): {
  readonly baseline: VisitDefinition;
  readonly post: readonly VisitDefinition[];
} {
  const visits = [...definition.design.visits]
    .filter((visit) => visit.targetDay >= 1)
    .sort((a, b) => a.targetDay - b.targetDay || a.visitNum - b.visitNum);
  const [baseline, ...post] = visits;
  if (!baseline) {
    throw new RangeError(
      `${definition.studyId} has no visit on or after day 1 to use as baseline.`
    );
  }
  return { baseline, post };
}

/**
 * The days of the number-at-risk table: the scheduled day of every visit on
 * or after day 1, in schedule order. AVAL counts the first-dose day as day
 * 1, so a subject is at risk on day t when AVAL is t or later.
 */
export function atRiskDays(
  definition: StudyDefinition
): readonly { readonly time: number; readonly label: string }[] {
  const days = [
    ...new Set(
      definition.design.visits
        .map((visit) => visit.targetDay)
        .filter((day) => day >= 1)
    ),
  ].sort((a, b) => a - b);
  return days.map((time) => ({ time, label: `Day ${time}` }));
}

function treatmentGrouping(
  definition: StudyDefinition,
  variable: "TRT01A" | "TRT01P"
): ArsGroupingFactor {
  const actual = variable === "TRT01A";
  return {
    id: actual ? IDS.trt01a : IDS.trt01p,
    name: actual ? "Actual treatment" : "Planned treatment",
    label: actual
      ? "Treatment received (TRT01A)"
      : "Treatment assigned (TRT01P)",
    groupingDataset: "ADSL",
    groupingVariable: variable,
    dataDriven: false,
    groups: definition.design.arms.map((arm, index) =>
      group(
        variable,
        String(index + 1),
        arm.name,
        arm.name,
        index + 1,
        where("ADSL", variable, "EQ", arm.name)
      )
    ),
  };
}

function visitGrouping(
  id: string,
  name: string,
  visits: readonly VisitDefinition[]
): ArsGroupingFactor {
  return {
    id,
    name,
    label: name,
    groupingDataset: "ADVS",
    groupingVariable: "AVISITN",
    dataDriven: false,
    groups: visits.map((visit, index) =>
      group(
        "AVISITN",
        String(visit.visitNum),
        visit.name,
        visitLabel(visit.name),
        index + 1,
        where("ADVS", "AVISITN", "EQ", String(visit.visitNum))
      )
    ),
  };
}

const METHODS: readonly ArsAnalysisMethod[] = [
  {
    id: IDS.count,
    name: "Count of subjects",
    label: "Number of subjects",
    description:
      "The number of distinct subjects (USUBJID) in the analysis set and group.",
    operations: [
      {
        id: IDS.countN,
        name: "N",
        label: "Number of subjects, an integer",
        order: 1,
        resultPattern: "XX",
      },
    ],
  },
  {
    id: IDS.countPct,
    name: "Count and percentage of subjects",
    label: "n (%)",
    description:
      "The number of distinct subjects (USUBJID) with at least one record in the group, and that number as a percentage of the subjects in the analysis set and treatment group. A subject with several records in a group is counted once.",
    operations: [
      {
        id: IDS.countPctN,
        name: "n",
        label: "Number of subjects, an integer",
        order: 1,
        resultPattern: "XX",
      },
      {
        id: IDS.countPctPct,
        name: "%",
        label: "Percentage of N, one decimal, rounded half away from zero",
        order: 2,
        resultPattern: "(XX.X)",
        referencedOperationRelationships: [
          {
            id: IDS.countPctNum,
            referencedOperationRole: { controlledTerm: "NUMERATOR" },
            operationId: IDS.countPctN,
            description: "Subjects counted in the group.",
          },
          {
            id: IDS.countPctDen,
            referencedOperationRole: { controlledTerm: "DENOMINATOR" },
            operationId: IDS.countN,
            description: "Subjects in the analysis set and treatment group.",
          },
        ],
      },
    ],
  },
  {
    id: IDS.summ,
    name: "Summary of a continuous variable",
    label: "n, mean, SD, median, min, max",
    description:
      "Descriptive statistics of the non-missing values. SD uses the n - 1 denominator; the median of an even count is the mean of the two middle values. Min and max are shown with the data's decimals, mean and median with one more, SD with two more.",
    operations: SUMMARY_OPERATIONS.map((operation, index) => ({
      id: operation.id,
      name: operation.label,
      label:
        operation.kind === "n"
          ? "Number of non-missing values, an integer"
          : operation.kind === "sd"
            ? "Sample SD (n - 1 denominator), two more decimals than the data"
            : operation.kind === "mean" || operation.kind === "median"
              ? `${operation.label}, one more decimal than the data`
              : `${operation.label}, the data's decimals`,
      order: index + 1,
      ...(operation.kind === "n" ? { resultPattern: "XX" } : {}),
    })),
  },
  {
    id: IDS.km,
    name: "Kaplan-Meier estimate",
    label: "Product-limit estimate with Greenwood SE and log-log 95% CI",
    description:
      "The product-limit estimate of the probability of no event, at every time at which an event (CNSR = 0) or a censoring (CNSR = 1) was observed, from the time variable AVAL in days. Every subject whose time is t is at risk at t; the d events at t make one factor of (1 - d/n), and censorings at t leave the risk set after it. The standard error is Greenwood's, S(t) times the square root of the sum of d/(n(n - d)) over event times up to t, and 0 once S(t) is 0. The 95% confidence limits are pointwise, on the log-log scale: exp(-exp(log(-log S) +/- 1.96 sigma)), where sigma is the square root of Greenwood's sum divided by |log S|; they are not estimable (NE) where S is 1 or 0. A result at time 0 gives the start of the curve.",
    operations: KM_OPERATIONS.map((operation, index) => ({
      id: operation.id,
      name: operation.name,
      label: operation.label,
      order: index + 1,
      resultPattern: operation.resultPattern,
    })),
  },
  {
    id: IDS.logRank,
    name: "Log-rank test",
    label: "Log-rank chi-square, degrees of freedom and p-value",
    description:
      "The unstratified log-rank test that the treatment groups have the same survival distribution. At each distinct event time each group contributes observed minus expected events, n_j d / n, with the hypergeometric covariance. The statistic is U'V-U, with V- a generalised inverse of the covariance, referred to a chi-square distribution with degrees of freedom equal to the rank of V: the number of groups with information, less one. Not estimable (NE) with no events or fewer than two such groups.",
    operations: [
      {
        id: IDS.logRankChiSq,
        name: "Chi-square",
        label: "Log-rank chi-square statistic, two decimals",
        order: 1,
        resultPattern: "XX.XX",
      },
      {
        id: IDS.logRankDf,
        name: "DF",
        label: "Degrees of freedom, an integer",
        order: 2,
        resultPattern: "X",
      },
      {
        id: IDS.logRankP,
        name: "p-value",
        label:
          "Upper-tail chi-square probability, four decimals, <0.0001 below that",
        order: 3,
        resultPattern: "X.XXXX",
      },
    ],
  },
];

/**
 * The reporting plan for a study: Table 14.1.1 (demographics, Safety Set),
 * Table 14.2.1 (systolic blood pressure change from baseline, Full Analysis
 * Set), Table 14.3.1 (TEAEs by system organ class and preferred term,
 * Safety Set) and Figure 14.2.2 (Kaplan-Meier estimate of time to first TEAE
 * leading to discontinuation, Safety Set). Treatment groups, visits and the
 * days of the number-at-risk table come from the study definition.
 */
export function buildReportingPlan(definition: StudyDefinition): ReportingPlan {
  const { baseline, post } = reportedVisits(definition);
  const countPct = (
    id: string,
    name: string,
    dataset: string,
    variable: string,
    analysisSetId: string,
    groupings: readonly string[],
    denominator: string,
    extra: Partial<AnalysisSpec> = {}
  ): AnalysisSpec => ({
    id,
    name,
    version: 1,
    reason: SPECIFIED_IN_SAP,
    purpose: extra.purpose ?? BASELINE_PURPOSE,
    dataset,
    variable,
    analysisSetId,
    ...(extra.dataSubsetId ? { dataSubsetId: extra.dataSubsetId } : {}),
    methodId: IDS.countPct,
    orderedGroupings: groupings.map((groupingId, index) => ({
      order: index + 1,
      groupingId,
      resultsByGroup: true,
    })),
    referencedAnalysisOperations: [
      { referencedOperationRelationshipId: IDS.countPctNum, analysisId: id },
      {
        referencedOperationRelationshipId: IDS.countPctDen,
        analysisId: denominator,
      },
    ],
  });
  const bigN = (
    id: string,
    name: string,
    analysisSetId: string,
    grouping: string,
    purpose: AnalysisSpec["purpose"]
  ): AnalysisSpec => ({
    id,
    name,
    version: 1,
    reason: SPECIFIED_IN_SAP,
    purpose,
    dataset: "ADSL",
    variable: "USUBJID",
    analysisSetId,
    methodId: IDS.count,
    orderedGroupings: [
      { order: 1, groupingId: grouping, resultsByGroup: true },
    ],
  });
  const summary = (
    id: string,
    name: string,
    dataset: string,
    variable: string,
    analysisSetId: string,
    groupings: readonly string[],
    extra: Partial<AnalysisSpec> = {}
  ): AnalysisSpec => ({
    id,
    name,
    version: 1,
    reason: SPECIFIED_IN_SAP,
    purpose: extra.purpose ?? BASELINE_PURPOSE,
    dataset,
    variable,
    analysisSetId,
    ...(extra.dataSubsetId ? { dataSubsetId: extra.dataSubsetId } : {}),
    methodId: IDS.summ,
    orderedGroupings: groupings.map((groupingId, index) => ({
      order: index + 1,
      groupingId,
      resultsByGroup: true,
    })),
    ...(extra.precisionVariable
      ? { precisionVariable: extra.precisionVariable }
      : {}),
  });
  const primary = { controlledTerm: "PRIMARY OUTCOME MEASURE" } as const;
  const secondary = { controlledTerm: "SECONDARY OUTCOME MEASURE" } as const;
  const sysbp = and(
    where("ADVS", "PARAMCD", "EQ", "SYSBP"),
    where("ADVS", "ANL01FL", "EQ", "Y")
  );
  const timeToEvent = (
    id: string,
    name: string,
    methodId: string,
    resultsByGroup: boolean
  ): AnalysisSpec => ({
    id,
    name,
    version: 1,
    reason: SPECIFIED_IN_SAP,
    purpose: secondary,
    dataset: "ADTTE",
    variable: "AVAL",
    analysisSetId: IDS.saf,
    dataSubsetId: IDS.ttadisc,
    methodId,
    orderedGroupings: [
      { order: 1, groupingId: IDS.trt01a, resultsByGroup },
      ...(resultsByGroup
        ? [{ order: 2, groupingId: IDS.tteTime, resultsByGroup: true }]
        : []),
    ],
  });

  return {
    analysisSets: [
      {
        id: IDS.saf,
        name: "Safety Set",
        label: "Safety Set: subjects who received at least one dose",
        level: 1,
        order: 1,
        ...where("ADSL", "SAFFL", "EQ", "Y"),
      },
      {
        id: IDS.fas,
        name: "Full Analysis Set",
        label:
          "Full Analysis Set: randomized subjects who received at least one dose",
        level: 1,
        order: 2,
        ...where("ADSL", "ITTFL", "EQ", "Y"),
      },
    ],
    analysisGroupings: [
      treatmentGrouping(definition, "TRT01A"),
      treatmentGrouping(definition, "TRT01P"),
      {
        id: IDS.agegr1,
        name: "Age group",
        label: "Age group (years)",
        groupingDataset: "ADSL",
        groupingVariable: "AGEGR1",
        dataDriven: false,
        groups: AGE_GROUPS.map((value, index) =>
          group(
            "AGEGR1",
            String(index + 1),
            value,
            value,
            index + 1,
            where("ADSL", "AGEGR1", "EQ", value)
          )
        ),
      },
      {
        id: IDS.sex,
        name: "Sex",
        label: "Sex",
        groupingDataset: "ADSL",
        groupingVariable: "SEX",
        dataDriven: false,
        groups: SEX_GROUPS.map((sex, index) =>
          group(
            "SEX",
            sex.value,
            sex.value,
            sex.label,
            index + 1,
            where("ADSL", "SEX", "EQ", sex.value)
          )
        ),
      },
      {
        id: IDS.soc,
        name: "System organ class",
        label: "System organ class (AEBODSYS)",
        groupingDataset: "ADAE",
        groupingVariable: "AEBODSYS",
        dataDriven: true,
        groups: [],
      },
      {
        id: IDS.pt,
        name: "Preferred term",
        label: "Preferred term (AEDECOD)",
        groupingDataset: "ADAE",
        groupingVariable: "AEDECOD",
        dataDriven: true,
        groups: [],
      },
      visitGrouping(IDS.visitAll, "Analysis visit", [baseline, ...post]),
      visitGrouping(IDS.visitPost, "Postbaseline analysis visit", post),
      {
        id: IDS.tteTime,
        name: "Analysis time",
        label: "Time to event or censoring in days (AVAL)",
        groupingDataset: "ADTTE",
        groupingVariable: "AVAL",
        dataDriven: true,
        groups: [],
      },
      {
        id: IDS.atRiskDay,
        name: "At risk on a scheduled day",
        label:
          "Subjects still at risk on a scheduled study day (AVAL on or after the day)",
        groupingDataset: "ADTTE",
        groupingVariable: "AVAL",
        dataDriven: false,
        groups: atRiskDays(definition).map((day, index) =>
          group(
            "ATRISK",
            String(day.time),
            day.label,
            `At risk on ${day.label}`,
            index + 1,
            where("ADTTE", "AVAL", "GE", String(day.time))
          )
        ),
      },
    ],
    dataSubsets: [
      {
        id: IDS.teae,
        name: "Treatment-emergent adverse events",
        label: "TRTEMFL = Y",
        level: 1,
        order: 1,
        ...where("ADAE", "TRTEMFL", "EQ", "Y"),
      },
      {
        id: IDS.sysbp,
        name: "Systolic blood pressure, primary analysis records",
        label: "PARAMCD = SYSBP and ANL01FL = Y",
        level: 1,
        order: 2,
        ...sysbp,
      },
      {
        id: IDS.sysbpPost,
        name: "Systolic blood pressure, postbaseline primary analysis records",
        label: `PARAMCD = SYSBP, ANL01FL = Y and AVISITN > ${baseline.visitNum}`,
        level: 1,
        order: 3,
        ...and(
          sysbp,
          where("ADVS", "AVISITN", "GT", String(baseline.visitNum))
        ),
      },
      {
        id: IDS.ttadisc,
        name: "Time to first TEAE leading to discontinuation",
        label: `PARAMCD = ${KM_PARAMCD}`,
        level: 1,
        order: 4,
        ...where("ADTTE", "PARAMCD", "EQ", KM_PARAMCD),
      },
    ],
    methods: METHODS,
    analyses: [
      bigN(
        IDS.demogN,
        "Subjects in the Safety Set by treatment received",
        IDS.saf,
        IDS.trt01a,
        BASELINE_PURPOSE
      ),
      summary(IDS.demogAge, "Age (years)", "ADSL", "AGE", IDS.saf, [
        IDS.trt01a,
      ]),
      countPct(
        IDS.demogAgeGroup,
        "Age group",
        "ADSL",
        "AGEGR1",
        IDS.saf,
        [IDS.trt01a, IDS.agegr1],
        IDS.demogN
      ),
      countPct(
        IDS.demogSex,
        "Sex",
        "ADSL",
        "SEX",
        IDS.saf,
        [IDS.trt01a, IDS.sex],
        IDS.demogN
      ),
      summary(
        IDS.demogSysbp,
        "Baseline systolic blood pressure",
        "ADSL",
        "BSYSBP",
        IDS.saf,
        [IDS.trt01a]
      ),
      summary(
        IDS.demogDiabp,
        "Baseline diastolic blood pressure",
        "ADSL",
        "BDIABP",
        IDS.saf,
        [IDS.trt01a]
      ),
      bigN(
        IDS.cfbN,
        "Subjects in the Full Analysis Set by planned treatment",
        IDS.fas,
        IDS.trt01p,
        primary
      ),
      summary(
        IDS.cfbAval,
        "Systolic blood pressure by visit",
        "ADVS",
        "AVAL",
        IDS.fas,
        [IDS.trt01p, IDS.visitAll],
        { dataSubsetId: IDS.sysbp, purpose: primary }
      ),
      summary(
        IDS.cfbChg,
        "Change from baseline in systolic blood pressure by visit",
        "ADVS",
        "CHG",
        IDS.fas,
        [IDS.trt01p, IDS.visitPost],
        {
          dataSubsetId: IDS.sysbpPost,
          purpose: primary,
          precisionVariable: "AVAL",
        }
      ),
      bigN(
        IDS.teaeN,
        "Subjects in the Safety Set by treatment received",
        IDS.saf,
        IDS.trt01a,
        secondary
      ),
      countPct(
        IDS.teaeAny,
        "Subjects with at least one TEAE",
        "ADAE",
        "USUBJID",
        IDS.saf,
        [IDS.trt01a],
        IDS.teaeN,
        { dataSubsetId: IDS.teae, purpose: secondary }
      ),
      countPct(
        IDS.teaeSoc,
        "Subjects with a TEAE by system organ class",
        "ADAE",
        "USUBJID",
        IDS.saf,
        [IDS.trt01a, IDS.soc],
        IDS.teaeN,
        { dataSubsetId: IDS.teae, purpose: secondary }
      ),
      countPct(
        IDS.teaePt,
        "Subjects with a TEAE by system organ class and preferred term",
        "ADAE",
        "USUBJID",
        IDS.saf,
        [IDS.trt01a, IDS.soc, IDS.pt],
        IDS.teaeN,
        { dataSubsetId: IDS.teae, purpose: secondary }
      ),
      bigN(
        IDS.kmN,
        "Subjects in the Safety Set by treatment received",
        IDS.saf,
        IDS.trt01a,
        secondary
      ),
      {
        id: IDS.kmAtRisk,
        name: "Subjects at risk on each scheduled day",
        version: 1,
        reason: SPECIFIED_IN_SAP,
        purpose: secondary,
        dataset: "ADTTE",
        variable: "USUBJID",
        analysisSetId: IDS.saf,
        dataSubsetId: IDS.ttadisc,
        methodId: IDS.count,
        orderedGroupings: [
          { order: 1, groupingId: IDS.trt01a, resultsByGroup: true },
          { order: 2, groupingId: IDS.atRiskDay, resultsByGroup: true },
        ],
      },
      timeToEvent(
        IDS.kmCurve,
        "Kaplan-Meier estimate of time to first TEAE leading to discontinuation",
        IDS.km,
        true
      ),
      timeToEvent(
        IDS.kmLogRank,
        "Log-rank test across treatment groups",
        IDS.logRank,
        false
      ),
    ],
  };
}
