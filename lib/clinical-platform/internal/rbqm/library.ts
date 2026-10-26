/**
 * The risk-based quality management library (#2631): key risk indicators,
 * quality tolerance limits, central statistical monitoring tests, and the
 * quality plan each study follows. Every KRI and QTL evaluates a governed
 * registry metric, so its value means what the registry says it means.
 *
 * The KRI set follows the public TransCelerate RBQM risk indicator library
 * where the operational data supports it. The thresholds, limits and
 * responses belong to the synthetic studies' fictional quality plans; each
 * states its reason rather than borrowing authority.
 */
import type {
  CriticalToQualityFactor,
  CsmTestDefinition,
  KriDefinition,
  QtlDefinition,
  QualityPlan,
  QualityPlanQtl,
  RiskSignalAction,
} from "../../types";

/** The issue that adds adverse event KRIs to the library. */
const SAFETY_KRIS_ISSUE = 2980;

const ENROLLED = (value: number) => ({
  metricId: "subjects_enrolled",
  value,
});

/** Key risk indicators, in display order. */
export const KRI_LIBRARY: readonly KriDefinition[] = [
  {
    id: "kri-screen-failure",
    name: "Screen failure rate",
    metricId: "screen_failure_rate",
    direction: "high",
    amber: 0.5,
    red: 0.65,
    reason:
      "The studies plan for about a third of screened subjects to fail. Above half, the site is screening outside the population the protocol assumes; above two in three, it spends more visits screening than enrolling.",
    minimum: { metricId: "subjects_screened", value: 8 },
  },
  {
    id: "kri-early-termination",
    name: "Early termination rate",
    metricId: "early_termination_rate",
    direction: "high",
    amber: 0.2,
    red: 0.3,
    reason:
      "Sample sizes allow for about 10% of subjects lost before the primary endpoint. At twice that, a site's losses start to cost power; at three times, they need action.",
    minimum: ENROLLED(5),
  },
  {
    id: "kri-missed-visits",
    name: "Missed visit rate",
    metricId: "missed_visit_rate",
    direction: "high",
    amber: 0.05,
    red: 0.1,
    reason:
      "A missed visit is missing data. The missing-data assumptions allow about 3% of scheduled visits; 5% is the site's warning and 10% puts its endpoint data at risk.",
    minimum: ENROLLED(3),
  },
  {
    id: "kri-out-of-window",
    name: "Out-of-window visit rate",
    metricId: "out_of_window_visit_rate",
    direction: "high",
    amber: 0.08,
    red: 0.12,
    reason:
      "Visit windows are wide enough for nearly every visit to meet them. Above 8% the site is not managing its schedule; above 12% endpoint timing is in question.",
    minimum: ENROLLED(3),
  },
  {
    id: "kri-entry-lag",
    name: "Data entry lag (mean days)",
    metricId: "data_entry_lag_mean",
    direction: "high",
    amber: 7,
    red: 10,
    reason:
      "The data management plan asks for entry within five working days, seven calendar days. At ten, central monitoring and data cuts read stale data.",
    minimum: ENROLLED(3),
  },
  {
    id: "kri-query-resolution",
    name: "Query resolution time (median days)",
    metricId: "query_resolution_time_median",
    direction: "high",
    amber: 7,
    red: 10,
    reason:
      "Queries should close within a week so cleaning keeps pace with entry. A median above ten days means open questions pile up before each data cut.",
    minimum: ENROLLED(3),
  },
  {
    id: "kri-important-deviations",
    name: "Important deviations per 100 enrolled subjects",
    metricId: "important_deviation_rate",
    direction: "high",
    amber: 30,
    red: 45,
    reason:
      "Across the portfolio about 10 important deviations occur per 100 enrolled subjects. Three times that is the site's warning, four and a half times calls for a root-cause review.",
    minimum: ENROLLED(5),
  },
  {
    id: "kri-sdv",
    name: "Source data verification completion",
    metricId: "sdv_completion",
    direction: "low",
    amber: 0.8,
    red: 0.7,
    reason:
      "The monitoring plans target verifying all critical data due by the next interim visit. Below 80% the backlog outlasts a visit interval; below 70% critical data goes into a data cut unverified.",
    minimum: ENROLLED(1),
  },
];

/** Quality tolerance limits, in display order. */
export const QTL_LIBRARY: readonly QtlDefinition[] = [
  {
    id: "qtl-important-deviation",
    name: "Subjects with an important protocol deviation",
    metricId: "subjects_with_important_deviation",
    rationale:
      "An important deviation can take a subject out of the per-protocol population or call for a sensitivity analysis, so the share of such subjects bounds how far the results can be trusted.",
    response:
      "The study team reviews the deviation categories behind the breach, retrains the sites with the highest rates, and records whether the analysis populations or the statistical analysis plan need to change. The breach and its impact are reported in the clinical study report.",
  },
  {
    id: "qtl-early-termination",
    name: "Subjects who end the study early",
    metricId: "early_termination_rate",
    rationale:
      "A subject who ends the study early has no primary endpoint assessment. Past the planned loss to follow-up the study loses power, and the missing data may not be missing at random.",
    response:
      "The study team reviews the reasons for discontinuation by site and arm, strengthens retention measures, and asks the statistician whether the planned sensitivity analyses for missing data still suffice. The breach and its impact are reported in the clinical study report.",
  },
  {
    id: "qtl-missed-visits",
    name: "Scheduled visits missed",
    metricId: "missed_visit_rate",
    rationale:
      "Missed visits leave gaps in endpoint and safety data; above the limit the planned handling of missing data no longer covers them.",
    response:
      "The study team finds the visits most often missed, checks the schedule's burden on subjects, and agrees any protocol or visit-window change with the sponsor. The breach and its impact are reported in the clinical study report.",
  },
];

/** Central statistical monitoring tests, in display order. */
export const CSM_TESTS: readonly CsmTestDefinition[] = [
  {
    id: "csm-query-under-reporting",
    name: "Query under-reporting",
    question:
      "Does the site raise fewer queries per entered visit than its peers would predict?",
    method:
      "Lower tail of a Poisson count: the site's queries against the peer query rate times the site's entered visits.",
    reads: ["gold.fct_query.query_id", "gold.fct_visit.entry_lag_days"],
  },
  {
    id: "csm-deviation-under-reporting",
    name: "Deviation under-reporting",
    question:
      "Does the site report fewer protocol deviations per visit than its peers would predict?",
    method:
      "Lower tail of a Poisson count: the site's deviations against the peer deviation rate times the site's visits.",
    reads: ["gold.fct_deviation.deviation_id", "gold.fct_visit.visit_date_key"],
  },
  {
    id: "csm-ae-under-reporting",
    name: "Adverse event under-reporting",
    question:
      "Does the site report fewer adverse events per entered visit than its peers would predict?",
    method:
      "Lower tail of a Poisson count: the site's adverse events against the peer adverse event rate times the site's entered visits.",
    reads: ["gold.fct_adverse_event.ae_id", "gold.fct_visit.entry_lag_days"],
  },
  {
    id: "csm-exact-day-visits",
    name: "Visits on their exact planned day",
    question:
      "Do more of the site's scheduled visits fall exactly on their planned day than its peers' rates predict?",
    method:
      "Upper tail of a Poisson count: the site's visits on their planned day against the sum, over its scheduled visits, of the peers' on-day rate for the same planned visit. Visits that are on their planned day everywhere in the study, such as screening, have no window and are left out.",
    reads: ["gold.fct_visit.day_offset", "gold.fct_visit.planned_visit_id"],
  },
  {
    id: "csm-entry-hour",
    name: "Unusual hours of data entry",
    question:
      "Does the site enter its data at different hours of the day from its peers?",
    method:
      "Upper tail of a chi-square goodness of fit: the site's entered visits by UTC entry hour against the peers' pooled distribution of entry hours. Adjacent hours are pooled until each pool expects at least 5 entries, and the statistic has one degree of freedom fewer than there are pools.",
    reads: ["gold.fct_visit.entry_hour"],
  },
  {
    id: "csm-kri-profile",
    name: "Unusual KRI profile",
    question:
      "Taken together, is the site's profile of query rate, deviation rate, mean entry lag and share of visits on their exact planned day far from its peers'?",
    method:
      "Upper tail of Hotelling's T² for one new observation: the Mahalanobis distance from the peer mean under the peer covariance, scaled to an F distribution with 4 and n − 4 degrees of freedom.",
    reads: [
      "gold.fct_query.query_id",
      "gold.fct_deviation.deviation_id",
      "gold.fct_visit.entry_lag_days",
      "gold.fct_visit.day_offset",
      "gold.fct_visit.planned_visit_id",
    ],
  },
];

/** Actions a signal can lead to, with their labels. */
export const RISK_SIGNAL_ACTIONS: Readonly<Record<RiskSignalAction, string>> = {
  "targeted-sdv": "Targeted source data verification",
  "site-retraining": "Site retraining",
  "site-audit": "Site audit",
  "for-cause-visit": "For-cause monitoring visit",
};

/** QTL limits for drug and biologic studies. */
const DRUG_QTLS: readonly QualityPlanQtl[] = [
  { qtlId: "qtl-important-deviation", limit: 0.2, secondaryLimit: 0.15 },
  { qtlId: "qtl-early-termination", limit: 0.25, secondaryLimit: 0.18 },
  { qtlId: "qtl-missed-visits", limit: 0.05, secondaryLimit: 0.035 },
];

/**
 * QTL limits for device studies: shorter follow-up and an implant that
 * stays in place make early termination a stronger threat to the endpoint.
 */
const DEVICE_QTLS: readonly QualityPlanQtl[] = [
  { qtlId: "qtl-important-deviation", limit: 0.2, secondaryLimit: 0.15 },
  { qtlId: "qtl-early-termination", limit: 0.2, secondaryLimit: 0.15 },
  { qtlId: "qtl-missed-visits", limit: 0.05, secondaryLimit: 0.035 },
];

function factors(device: boolean): CriticalToQualityFactor[] {
  return [
    {
      id: "ctq-eligibility",
      name: "Eligibility",
      risk: "Enrolling subjects outside the inclusion and exclusion criteria exposes them to unstudied risk and shifts the population the results describe.",
      kriIds: ["kri-screen-failure", "kri-important-deviations"],
      qtlIds: ["qtl-important-deviation"],
      gap: null,
    },
    {
      id: "ctq-endpoint-data",
      name: "Primary endpoint data",
      risk: "Missed, late or early visits and subjects who leave early take away the assessments the primary endpoint is built from.",
      kriIds: [
        "kri-missed-visits",
        "kri-out-of-window",
        "kri-early-termination",
      ],
      qtlIds: ["qtl-missed-visits", "qtl-early-termination"],
      gap: null,
    },
    {
      id: "ctq-data-reliability",
      name: "Timely and verified data",
      risk: "Late entry, slow query resolution and unverified source data let errors reach the analysis datasets unseen.",
      kriIds: ["kri-entry-lag", "kri-query-resolution", "kri-sdv"],
      qtlIds: [],
      gap: null,
    },
    {
      id: "ctq-safety-reporting",
      name: device
        ? "Adverse event and device deficiency reporting"
        : "Adverse event reporting",
      risk: "Under-reported or late safety events hide risk from subjects, investigators and regulators.",
      kriIds: [],
      qtlIds: [],
      // Central monitoring tests each site's AE rate against its peers
      // (#2956); what is still missing is a KRI to follow it week by week.
      gap: {
        reason: device
          ? "No key risk indicator follows a site's adverse event rate or how long it takes to report an event, and the portfolio has no device deficiency feed. Central monitoring compares each site's adverse event rate with its peers in the meantime."
          : "No key risk indicator follows a site's adverse event rate or how long it takes to report an event. Central monitoring compares each site's rate with its peers in the meantime.",
        issue: SAFETY_KRIS_ISSUE,
      },
    },
  ];
}

/**
 * The quality plan of a study: its critical-to-quality factors and QTL
 * limits, in force from the study's start.
 *
 * @param studyId - Study id.
 * @param productType - `gold.dim_study.product_type`; `device` takes the device limits, and `drug` and `biologic` the drug limits.
 * @param startOn - ISO 8601 study start date, from `gold.dim_study`.
 * @returns The study's synthetic quality plan, version 1.0.
 */
export function qualityPlan(
  studyId: string,
  productType: string,
  startOn: string
): QualityPlan {
  const device = productType === "device";
  return {
    studyId,
    version: "1.0",
    effectiveOn: startOn,
    factors: factors(device),
    qtls: device ? DEVICE_QTLS : DRUG_QTLS,
    synthetic: true,
  };
}
