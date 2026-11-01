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
  ArsOperation,
  ArsSponsorTermRef,
  ArsTerminologyExtension,
  ArsWhereClause,
  Dataset,
  StudyDefinition,
  VisitDefinition,
} from "../../types";
import { DEMO_301_HIERARCHY } from "../adam/hierarchy";

/** An analysis before it is run: everything but its results. */
export type AnalysisSpec = Omit<ArsAnalysis, "results" | "rawDecimals"> & {
  /**
   * Variable whose recorded decimals set the display precision, when it is
   * not the analysis variable itself. CHG is a difference of AVAL values,
   * so it is shown at AVAL's precision rather than with the floating-point
   * noise of the subtraction.
   */
  readonly precisionVariable?: string;
  /**
   * For a two-group comparison, which group of the treatment grouping is
   * the treatment and which the control. ARS 1.0 has no place for the
   * direction of a comparison, so it is left out of the reporting event and
   * written into the analysis name instead.
   */
  readonly comparison?: {
    readonly groupingId: string;
    readonly treatmentGroupId: string;
    readonly controlGroupId: string;
  };
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
  hceComponent: "AnlsGrouping_HCE_COMPONENT",
  winComp: "Mth_WinComp",
  winCompWins: "Mth_WinComp_WINS",
  winCompLosses: "Mth_WinComp_LOSSES",
  winCompTies: "Mth_WinComp_TIES",
  winStat: "Mth_WinStat",
  winPairs: "Mth_WinStat_PAIRS",
  winWins: "Mth_WinStat_WINS",
  winLosses: "Mth_WinStat_LOSSES",
  winTies: "Mth_WinStat_TIES",
  winRatio: "Mth_WinStat_WR",
  winRatioNum: "Mth_WinStat_WR_NUM",
  winRatioDen: "Mth_WinStat_WR_DEN",
  winRatioLcl: "Mth_WinStat_WR_LCL",
  winRatioUcl: "Mth_WinStat_WR_UCL",
  winRatioP: "Mth_WinStat_WR_PVAL",
  netBenefit: "Mth_WinStat_NB",
  netBenefitLcl: "Mth_WinStat_NB_LCL",
  netBenefitUcl: "Mth_WinStat_NB_UCL",
  winOdds: "Mth_WinStat_WO",
  winOddsLcl: "Mth_WinStat_WO_LCL",
  winOddsUcl: "Mth_WinStat_WO_UCL",
  fsZ: "Mth_WinStat_FS_Z",
  fsP: "Mth_WinStat_FS_PVAL",
} as const;

/**
 * The DEMO-301 hierarchical composite, most important component first, as
 * the analysis compares it: the ADHCE parameter, which values are better,
 * and the margin within which two values tie. Read from the DEMO-301
 * hierarchy spec, which ADHCE is derived from.
 */
export const HCE_HIERARCHY = DEMO_301_HIERARCHY.components.map(
  ({ paramcd, label, kind, better, margin, rule }) => ({
    paramcd,
    label,
    kind,
    better,
    ...(margin === undefined ? {} : { margin }),
    rule,
  })
);

/** Decimals the win ratio, win odds and their limits are shown with. */
export const WIN_RATIO_DECIMALS = 2;
/** Decimals the net benefit and its limits are shown with. */
export const NET_BENEFIT_DECIMALS = 3;

/**
 * The comparator of a study, by its arm type (`Placebo Comparator Arm`,
 * `Active Comparator Arm`), and the arms compared with it. `null` when the
 * study has no comparator arm or nothing to compare with it.
 */
export function comparisons(definition: StudyDefinition): {
  readonly control: number;
  readonly treatments: readonly number[];
} | null {
  const arms = definition.design.arms;
  const control = arms.findIndex((arm) => /comparator/i.test(arm.type.decode));
  if (control === -1) return null;
  const treatments = arms.flatMap((_, index) =>
    index === control ? [] : [index]
  );
  return treatments.length === 0 ? null : { control, treatments };
}

/** Ids of the win-ratio analyses of one treatment arm against the comparator. */
export function winRatioIds(armCode: string): {
  readonly subset: string;
  readonly components: string;
  readonly overall: string;
} {
  return {
    subset: `Dss_HCE_${armCode}`,
    components: `An_14_2_3_COMP_${armCode}`,
    overall: `An_14_2_3_WIN_${armCode}`,
  };
}

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

/**
 * The treatments Safety Set subjects received that no arm plans, by name:
 * ADSL `TRT01A` values on `SAFFL = Y` rows that match no arm. A subject
 * dosed with one is in the Safety Set, so the outputs grouped by treatment
 * received need a column for it (#3673).
 *
 * @param definition - The study the run was made from.
 * @param datasets - The run's datasets; only ADSL is read.
 * @returns The unplanned treatments, sorted, or none when ADSL is absent.
 */
export function unplannedTreatments(
  definition: StudyDefinition,
  datasets: readonly Dataset[]
): readonly string[] {
  const adsl = datasets.find(
    (dataset) => dataset.name === "ADSL" && dataset.layer === "adam"
  );
  if (!adsl) return [];
  const planned = new Set(definition.design.arms.map((arm) => arm.name));
  const received = adsl.columns.TRT01A ?? [];
  const safety = adsl.columns.SAFFL ?? [];
  return [
    ...new Set(
      received.filter(
        (value, index): value is string =>
          typeof value === "string" &&
          value !== "" &&
          safety[index] === "Y" &&
          !planned.has(value)
      )
    ),
  ].sort();
}

function treatmentGrouping(
  definition: StudyDefinition,
  variable: "TRT01A" | "TRT01P",
  unplanned: readonly string[] = []
): ArsGroupingFactor {
  const actual = variable === "TRT01A";
  const names = [
    ...definition.design.arms.map((arm) => arm.name),
    ...(actual ? unplanned : []),
  ];
  return {
    id: actual ? IDS.trt01a : IDS.trt01p,
    name: actual ? "Actual treatment" : "Planned treatment",
    label: actual
      ? "Treatment received (TRT01A)"
      : "Treatment assigned (TRT01P)",
    groupingDataset: "ADSL",
    groupingVariable: variable,
    dataDriven: false,
    groups: names.map((name, index) =>
      group(
        variable,
        String(index + 1),
        name,
        name,
        index + 1,
        where("ADSL", variable, "EQ", name)
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

/** An operation that counts, shown as an integer. */
function count(
  id: string,
  name: string,
  label: string,
  order: number
): ArsOperation {
  return {
    id,
    name,
    label: `${label}, an integer`,
    order,
    resultPattern: "XX",
  };
}

const DECIMAL_WORDS: Readonly<Record<number, string>> = {
  2: "two",
  3: "three",
};

/** An operation shown to a fixed number of decimals. */
function decimal(
  id: string,
  name: string,
  label: string,
  order: number,
  decimals: number
): ArsOperation {
  return {
    id,
    name,
    label: `${label}, ${DECIMAL_WORDS[decimals] ?? decimals} decimals`,
    order,
    resultPattern: `X.${"X".repeat(decimals)}`,
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
  {
    id: IDS.winComp,
    name: "Pairs decided on each component of a hierarchy",
    label: "Wins, losses and ties after each component",
    description:
      "Every treatment subject is paired with every control subject. Each pair is compared on the components in priority order and decided on the first component on which one member is better; a pair tied on a component goes on to the next. For each component: the pairs the treatment member won on it, the pairs the control member won on it, and the pairs still tied after it. A missing value ties with every value on that component. Times to an event follow the Gehan rule: a pair is decided only when the earlier time is an event, so a censored time ties with any later time. Continuous values tie when they differ by the component's margin or less.",
    operations: [
      count(
        IDS.winCompWins,
        "Wins",
        "Pairs the treatment member won on the component",
        1
      ),
      count(
        IDS.winCompLosses,
        "Losses",
        "Pairs the control member won on the component",
        2
      ),
      count(
        IDS.winCompTies,
        "Ties after",
        "Pairs still tied after the component",
        3
      ),
    ],
  },
  {
    id: IDS.winStat,
    name: "Win statistics",
    label:
      "Win ratio, net benefit and win odds with 95% CIs, and the Finkelstein-Schoenfeld test",
    description: `Pairs every treatment subject with every control subject and decides each pair on the components of the hierarchy in priority order, as the component method describes. Wins W and losses L are the pairs the treatment and the control member won; ties T are the pairs tied on every component, and P = W + L + T. The win ratio is W/L, the net benefit (W - L)/P and the win odds (W + T/2)/(L + T/2). Their variances are the U-statistic variances of Dong et al. (2016), as the WINS R package computes them. The win ratio and win odds limits are formed on the log scale and the net benefit limits on the natural scale, with the normal quantile for a two-sided 95% interval. The win ratio p-value is two-sided, from the z statistic of log(W/L). The Finkelstein-Schoenfeld test scores every pair of subjects in the pooled sample, sums the treatment subjects' scores and refers the sum to its permutation variance. The win ratio and win odds are shown to ${WIN_RATIO_DECIMALS} decimals and the net benefit to ${NET_BENEFIT_DECIMALS}; a statistic is not estimable (NE) when a count it divides by is 0.`,
    operations: [
      count(IDS.winPairs, "Pairs", "Treatment-control pairs compared", 1),
      count(IDS.winWins, "Wins", "Pairs the treatment member won", 2),
      count(IDS.winLosses, "Losses", "Pairs the control member won", 3),
      count(IDS.winTies, "Ties", "Pairs tied on every component", 4),
      {
        id: IDS.winRatio,
        name: "Win ratio",
        label: `Wins over losses, ${WIN_RATIO_DECIMALS} decimals`,
        order: 5,
        resultPattern: "X.XX",
        referencedOperationRelationships: [
          {
            id: IDS.winRatioNum,
            referencedOperationRole: { controlledTerm: "NUMERATOR" },
            operationId: IDS.winWins,
            description: "Pairs the treatment member won.",
          },
          {
            id: IDS.winRatioDen,
            referencedOperationRole: { controlledTerm: "DENOMINATOR" },
            operationId: IDS.winLosses,
            description: "Pairs the control member won.",
          },
        ],
      },
      decimal(
        IDS.winRatioLcl,
        "Win ratio lower 95% CL",
        "Lower 95% confidence limit, log scale",
        6,
        WIN_RATIO_DECIMALS
      ),
      decimal(
        IDS.winRatioUcl,
        "Win ratio upper 95% CL",
        "Upper 95% confidence limit, log scale",
        7,
        WIN_RATIO_DECIMALS
      ),
      {
        id: IDS.winRatioP,
        name: "Win ratio p-value",
        label:
          "Two-sided p-value of log(win ratio), four decimals, <0.0001 below that",
        order: 8,
        resultPattern: "X.XXXX",
      },
      decimal(
        IDS.netBenefit,
        "Net benefit",
        "Wins less losses over pairs",
        9,
        NET_BENEFIT_DECIMALS
      ),
      decimal(
        IDS.netBenefitLcl,
        "Net benefit lower 95% CL",
        "Lower 95% confidence limit",
        10,
        NET_BENEFIT_DECIMALS
      ),
      decimal(
        IDS.netBenefitUcl,
        "Net benefit upper 95% CL",
        "Upper 95% confidence limit",
        11,
        NET_BENEFIT_DECIMALS
      ),
      decimal(
        IDS.winOdds,
        "Win odds",
        "Wins plus half the ties over losses plus half the ties",
        12,
        WIN_RATIO_DECIMALS
      ),
      decimal(
        IDS.winOddsLcl,
        "Win odds lower 95% CL",
        "Lower 95% confidence limit, log scale",
        13,
        WIN_RATIO_DECIMALS
      ),
      decimal(
        IDS.winOddsUcl,
        "Win odds upper 95% CL",
        "Upper 95% confidence limit, log scale",
        14,
        WIN_RATIO_DECIMALS
      ),
      decimal(
        IDS.fsZ,
        "Finkelstein-Schoenfeld z",
        "Standardised Finkelstein-Schoenfeld statistic",
        15,
        2
      ),
      {
        id: IDS.fsP,
        name: "Finkelstein-Schoenfeld p-value",
        label: "Two-sided p-value, four decimals, <0.0001 below that",
        order: 16,
        resultPattern: "X.XXXX",
      },
    ],
  },
];

/**
 * The reporting plan for a study: Table 14.1.1 (demographics, Safety Set),
 * Table 14.2.1 (systolic blood pressure change from baseline, Full Analysis
 * Set), Table 14.3.1 (TEAEs by system organ class and preferred term,
 * Safety Set), Figure 14.2.2 (Kaplan-Meier estimate of time to first TEAE
 * leading to discontinuation, Safety Set) and, when the study has a
 * comparator arm, Table 14.2.3 (win statistics for the hierarchical
 * composite, each other arm against the comparator, Full Analysis Set).
 * Treatment groups, visits and the days of the number-at-risk table come
 * from the study definition. A treatment a Safety Set subject received that
 * no arm plans adds a treatment-received group after the planned arms, so
 * the groups' N add up to the Safety Set.
 *
 * @param definition - The study the run was made from.
 * @param unplanned - Treatments received that no arm plans, from
 *   {@link unplannedTreatments}; none by default.
 */
export function buildReportingPlan(
  definition: StudyDefinition,
  unplanned: readonly string[] = []
): ReportingPlan {
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

  const exploratory = {
    controlledTerm: "EXPLORATORY OUTCOME MEASURE",
  } as const;
  const compared = comparisons(definition);
  const arms = definition.design.arms;
  const trt01pGroup = (index: number) => `Grp_TRT01P_${index + 1}`;
  const winRatio = compared
    ? {
        groupings: [
          {
            id: IDS.hceComponent,
            name: "Hierarchy component",
            label:
              "Component of the hierarchical composite (PARAMCD), in priority order",
            groupingDataset: "ADHCE",
            groupingVariable: "PARAMCD",
            dataDriven: false,
            groups: HCE_HIERARCHY.map((component, index) =>
              group(
                "HCE",
                component.paramcd,
                component.paramcd,
                `${component.label}: ${component.rule}`,
                index + 1,
                where("ADHCE", "PARAMCD", "EQ", component.paramcd)
              )
            ),
          },
        ] satisfies ArsGroupingFactor[],
        subsets: compared.treatments.map((treatment, index): ArsDataSubset => ({
          id: winRatioIds(arms[treatment].armCode).subset,
          name: `${arms[treatment].name} and ${arms[compared.control].name}`,
          label: `TRT01P IN (${arms[treatment].name}, ${arms[compared.control].name})`,
          level: 1,
          order: 5 + index,
          ...where(
            "ADHCE",
            "TRT01P",
            "IN",
            arms[treatment].name,
            arms[compared.control].name
          ),
        })),
        analyses: [
          ...compared.treatments.flatMap((treatment): AnalysisSpec[] => {
            const ids = winRatioIds(arms[treatment].armCode);
            const versus = `${arms[treatment].name} vs ${arms[compared.control].name}`;
            const comparison = {
              groupingId: IDS.trt01p,
              treatmentGroupId: trt01pGroup(treatment),
              controlGroupId: trt01pGroup(compared.control),
            };
            const common = {
              version: 1,
              reason: SPECIFIED_IN_SAP,
              purpose: exploratory,
              dataset: "ADHCE",
              variable: "AVAL",
              analysisSetId: IDS.fas,
              dataSubsetId: ids.subset,
              comparison,
            };
            return [
              {
                ...common,
                id: ids.components,
                name: `Hierarchical composite, pairs decided on each component: ${versus}`,
                methodId: IDS.winComp,
                orderedGroupings: [
                  { order: 1, groupingId: IDS.trt01p, resultsByGroup: false },
                  {
                    order: 2,
                    groupingId: IDS.hceComponent,
                    resultsByGroup: true,
                  },
                ],
              },
              {
                ...common,
                id: ids.overall,
                name: `Hierarchical composite, win statistics: ${versus}`,
                methodId: IDS.winStat,
                orderedGroupings: [
                  { order: 1, groupingId: IDS.trt01p, resultsByGroup: false },
                  {
                    order: 2,
                    groupingId: IDS.hceComponent,
                    resultsByGroup: false,
                  },
                ],
                referencedAnalysisOperations: [
                  {
                    referencedOperationRelationshipId: IDS.winRatioNum,
                    analysisId: ids.overall,
                  },
                  {
                    referencedOperationRelationshipId: IDS.winRatioDen,
                    analysisId: ids.overall,
                  },
                ],
              },
            ];
          }),
        ],
      }
    : { groupings: [], subsets: [], analyses: [] };

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
      treatmentGrouping(definition, "TRT01A", unplanned),
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
      ...winRatio.groupings,
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
      ...winRatio.subsets,
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
      ...winRatio.analyses,
    ],
  };
}
