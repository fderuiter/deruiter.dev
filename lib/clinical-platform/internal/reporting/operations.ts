/**
 * The clinical operations dashboard (#2630): the same governed report specs
 * at four levels, portfolio, study, country and site. Each level groups by
 * the next one down and filters to the scope above it, so drilling in
 * narrows every number the same way. Every value comes from `buildReport`,
 * and so from the metric registry; what the registry cannot compute yet is
 * listed per section, with the reason the registry records and the issue
 * that will add it.
 */
import type {
  MetricDefinition,
  MetricDimensionId,
  MetricFilter,
  OperationsCrumb,
  OperationsDashboard,
  OperationsGap,
  OperationsLevel,
  OperationsMember,
  OperationsMilestone,
  OperationsRunByOption,
  OperationsScope,
  OperationsSection,
  OperationsSectionId,
  OperationsSource,
  OperationsStudyProfile,
  ReportData,
  ReportSpec,
  ReportTier,
  ReportVisual,
  Warehouse,
  WarehouseRow,
} from "../../types";
import { PRODUCT_REGISTRATIONS } from "../governance/contracts/registry";
import { formulaSources } from "../semantic/plan";
import { METRIC_GAPS, METRIC_REGISTRY } from "../semantic/registry";
import { buildReport } from "./build";
import { formatMetricValue } from "./format";
import { operationsRisk, operationsRiskTables } from "./operations-risk";

/** Run-by choice that keeps the studies the sponsor runs itself. */
const SPONSOR_RUN = "sponsor";

/** Dimension each level groups by: the level below it. */
const GROUP_BY: Readonly<Record<OperationsLevel, MetricDimensionId | null>> = {
  portfolio: "study",
  study: "country",
  country: "site",
  site: null,
};

const LEVEL_BELOW: Readonly<Record<OperationsLevel, OperationsLevel | null>> = {
  portfolio: "study",
  study: "country",
  country: "site",
  site: null,
};

/** Words for the grouping in a report title. */
const BY_WORDS: Readonly<Record<MetricDimensionId, string>> = {
  study: "by study",
  study_status: "by study status",
  therapeutic_area: "by therapeutic area",
  phase: "by phase",
  product_type: "by product type",
  operating_model: "by operating model",
  site: "by site",
  country: "by country",
  region: "by region",
  month: "by month",
  vendor: "by vendor",
  deviation_category: "by deviation category",
  deviation_importance: "by deviation importance",
  queried_form: "by queried form",
};

/**
 * A report on the dashboard, before the level fixes its grouping. `visual`
 * is used where the report groups by the level below; `siteVisual` at a
 * single site, where there is nothing below to group by (`line` groups by
 * month instead). A `breakdown` report groups by its own dimensions at every
 * level instead, still filtered to the scope. A `bands` report's metrics
 * split one count into bands, so a group one band counts reads zero in the
 * others rather than having no rows. `levels` limits where the report
 * appears.
 */
interface Panel {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
  readonly audience: string;
  readonly owner: string;
  readonly tier: Exclude<ReportTier, "certified">;
  readonly metrics: readonly string[];
  readonly visual: ReportVisual;
  readonly siteVisual: ReportVisual;
  readonly refreshSlaHours: number;
  readonly breakdown?: readonly MetricDimensionId[];
  readonly bands?: true;
  readonly levels?: readonly OperationsLevel[];
}

const OPS = "Clinical Operations Lead";
const DM = "Clinical Data Management Lead";
const MONITORING = "Clinical Monitoring Lead";

/** Headline numbers for the scope, shown above the sections. */
const GLANCE: Panel = {
  id: "operations-at-a-glance",
  title: "At a glance",
  purpose:
    "Headline recruitment, data and quality numbers for everything in scope, from the governed metrics.",
  audience: "Clinical operations",
  owner: OPS,
  tier: "managed",
  metrics: [
    "subjects_screened",
    "subjects_enrolled",
    "enrollment_vs_plan",
    "screen_failure_rate",
    "open_query_count",
    "sdv_completion",
    "important_deviation_rate",
  ],
  visual: "table",
  siteVisual: "table",
  refreshSlaHours: 24,
};

interface SectionPlan {
  readonly id: OperationsSectionId;
  readonly title: string;
  readonly summary: string;
  readonly panels: readonly Panel[];
  readonly gaps: (study: OperationsStudyProfile | null) => OperationsGap[];
  readonly levels?: readonly OperationsLevel[];
}

/** A gap the metric registry records, with the issue that will close it. */
function registryGap(name: string, issue: number | null): OperationsGap {
  const gap = METRIC_GAPS.find((candidate) => candidate.name === name);
  if (gap === undefined) throw new Error(`the registry records no gap ${name}`);
  return { name: gap.name, reason: gap.reason, issue };
}

/** The issue that adds adverse event and vital sign feeds and a weekday calendar to the generator. */
const GENERATOR_FEEDS_ISSUE = 2776;
/** The issue that adds activation stages, screen failure reasons and CEC adjudication to gold. */
const GOLD_FACTS_ISSUE = 2760;

const SECTIONS: readonly SectionPlan[] = [
  {
    id: "enrollment",
    title: "Enrollment",
    summary:
      "How recruitment is going against each site's target, and how many screened subjects fail screening or leave early.",
    panels: [
      {
        id: "enrollment-against-plan",
        title: "Enrollment against plan",
        purpose:
          "Subjects enrolled as a share of the enrollment target, so recruitment that is behind stands out.",
        audience: "Study leadership",
        owner: OPS,
        tier: "managed",
        metrics: ["enrollment_vs_plan"],
        visual: "bar",
        siteVisual: "stat",
        refreshSlaHours: 24,
      },
      {
        id: "screening-and-enrollment",
        title: "Subjects screened and enrolled",
        purpose:
          "How many subjects were screened and how many went on to enroll.",
        audience: "Study leadership",
        owner: OPS,
        tier: "managed",
        metrics: ["subjects_screened", "subjects_enrolled"],
        visual: "bar",
        siteVisual: "line",
        refreshSlaHours: 24,
      },
      {
        id: "screening-outcomes",
        title: "Screen failures and early terminations",
        purpose:
          "The share of screened subjects who failed screening and the share of enrolled subjects who left early.",
        audience: "Clinical operations",
        owner: OPS,
        tier: "managed",
        metrics: ["screen_failure_rate", "early_termination_rate"],
        visual: "table",
        siteVisual: "table",
        refreshSlaHours: 24,
      },
    ],
    gaps: () => [
      registryGap("Enrollment against a time-phased plan", null),
      {
        name: "Screen failure reasons",
        reason:
          "The synthetic EDC feed records when a subject was screened, not why a screen failure failed.",
        issue: GOLD_FACTS_ISSUE,
      },
    ],
  },
  {
    id: "activation",
    title: "Site activation",
    summary:
      "How long sites take to open, from protocol finalisation to activation.",
    panels: [
      {
        id: "site-activation",
        title: "Site activation cycle time",
        purpose:
          "Median days from protocol finalisation to site activation, so slow start-up is visible early.",
        audience: "Clinical operations",
        owner: OPS,
        tier: "managed",
        metrics: ["site_activation_cycle_time"],
        visual: "bar",
        siteVisual: "stat",
        refreshSlaHours: 24,
      },
    ],
    gaps: () => [
      {
        name: "Site activation funnel",
        reason:
          "The portfolio records only each site's activation date, not when it was selected, contracted, approved by the IRB or initiated.",
        issue: GOLD_FACTS_ISSUE,
      },
    ],
  },
  {
    id: "data-management",
    title: "Data management",
    summary:
      "How quickly visits are entered and how many queries are raised, open and resolved.",
    panels: [
      {
        id: "data-entry-and-queries",
        title: "Data entry and queries",
        purpose:
          "Data entry lag, query volume, query age and resolution time, ahead of each data cut.",
        audience: "Data management",
        owner: DM,
        tier: "managed",
        metrics: [
          "data_entry_lag_median",
          "data_entry_lag_p90",
          "query_rate_per_100_visits",
          "open_query_count",
          "query_aging_mean",
          "query_resolution_time_median",
        ],
        visual: "table",
        siteVisual: "table",
        refreshSlaHours: 24,
      },
      {
        id: "query-age-bands",
        title: "Open query age at the data cut",
        purpose:
          "Queries not closed at the data cut, by how many days before it they opened, so the oldest stand out.",
        audience: "Data management",
        owner: DM,
        tier: "managed",
        metrics: [
          "open_queries_aged_0_7_days",
          "open_queries_aged_8_30_days",
          "open_queries_aged_31_60_days",
          "open_queries_aged_over_60_days",
        ],
        visual: "table",
        siteVisual: "table",
        refreshSlaHours: 24,
        bands: true,
      },
      {
        id: "queries-by-form",
        title: "Queries by form",
        purpose:
          "Open queries, their age and how long closed queries took to resolve, by the CRF form queried, to find the forms that need clearer completion guidelines or edit checks.",
        audience: "Data management",
        owner: DM,
        tier: "managed",
        metrics: [
          "open_query_count",
          "query_aging_mean",
          "query_resolution_time_median",
        ],
        visual: "table",
        siteVisual: "table",
        refreshSlaHours: 24,
        breakdown: ["queried_form"],
      },
    ],
    gaps: () => [registryGap("Query rate per 100 CRF pages", null)],
  },
  {
    id: "quality",
    title: "Quality and monitoring",
    summary:
      "Protocol deviations, source data verification and monitoring visit reports.",
    panels: [
      {
        id: "protocol-deviations",
        title: "Protocol deviations",
        purpose:
          "Important and other deviations per 100 enrolled subjects, and the share of subjects with an important one.",
        audience: "Clinical operations",
        owner: MONITORING,
        tier: "managed",
        metrics: [
          "important_deviation_rate",
          "non_important_deviation_rate",
          "subjects_with_important_deviation",
        ],
        visual: "table",
        siteVisual: "table",
        refreshSlaHours: 24,
      },
      {
        id: "deviations-by-category",
        title: "Protocol deviations by category and importance",
        purpose:
          "How many deviations of each kind occurred, and whether each kind is important, to aim retraining and protocol clarifications.",
        audience: "Clinical operations",
        owner: MONITORING,
        tier: "managed",
        metrics: ["protocol_deviation_count"],
        visual: "table",
        siteVisual: "table",
        refreshSlaHours: 24,
        breakdown: ["deviation_category", "deviation_importance"],
      },
      {
        id: "monitoring-and-sdv",
        title: "Monitoring and source data verification",
        purpose:
          "Source data verification progress, monitoring report turnaround, and the reports and interim visits overdue against each study's monitoring plan.",
        audience: "Clinical operations",
        owner: MONITORING,
        tier: "managed",
        metrics: [
          "sdv_completion",
          "monitoring_report_cycle_time_median",
          "monitoring_reports_overdue",
          "monitoring_visits_overdue",
        ],
        visual: "table",
        siteVisual: "table",
        refreshSlaHours: 168,
      },
    ],
    gaps: () => [registryGap("eTMF completeness", null)],
  },
  {
    id: "risk",
    title: "Risk",
    summary:
      "Key risk indicators at each site, the study's quality tolerance limits, central statistical monitoring of its sites against their peers, and the signals they raise, under ICH E6(R3) risk-based quality management.",
    levels: ["study", "country", "site"],
    panels: [],
    gaps: () => [
      {
        name: "Adverse event under-reporting",
        reason:
          "The operational portfolio has no adverse event feed, so a site's AE rate cannot be tested against its peers.",
        issue: GENERATOR_FEEDS_ISSUE,
      },
      {
        name: "Digit preference in vital signs",
        reason:
          "The operational portfolio has no vital signs feed to test for rounded or repeated readings.",
        issue: GENERATOR_FEEDS_ISSUE,
      },
      {
        name: "Weekend and holiday visit dates",
        reason:
          "The generator has no weekday calendar, so every site sees weekend visits at the same base rate and the test would find nothing.",
        issue: GENERATOR_FEEDS_ISSUE,
      },
      {
        name: "Time of day of data entry",
        reason: "Gold keeps entry lag in days, not the time data was entered.",
        issue: GENERATOR_FEEDS_ISSUE,
      },
    ],
  },
  {
    id: "milestones",
    title: "Milestones",
    summary:
      "Study milestones, planned against actual, in each study's own vocabulary.",
    levels: ["portfolio", "study"],
    panels: [
      {
        id: "study-timelines",
        title: "Recruitment and close-out durations",
        purpose:
          "Days from first to last subject in, and from last subject last visit to database lock, for studies that reached both milestones.",
        audience: "Portfolio leadership",
        owner: "Portfolio Management Lead",
        tier: "managed",
        metrics: ["fpi_to_lpi_days", "lplv_to_dbl_days"],
        visual: "bar",
        siteVisual: "table",
        refreshSlaHours: 720,
        levels: ["portfolio"],
      },
    ],
    gaps: (study) =>
      study?.hasCecAdjudication
        ? [
            {
              name: "CEC adjudication backlog",
              reason:
                "Clinical events committee adjudications reach silver (silver.cec_adjudication) but no gold fact.",
              issue: GOLD_FACTS_ISSUE,
            },
          ]
        : [],
  },
];

function text(row: WarehouseRow, column: string): string {
  const value = row[column];
  return typeof value === "string" ? value : String(value ?? "");
}

/** `20240603` as `2024-06-03`. */
function isoDate(key: number): string {
  const digits = String(key);
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function rows(warehouse: Warehouse, table: string): readonly WarehouseRow[] {
  const found = warehouse.tables[table];
  if (found === undefined) throw new Error(`the warehouse has no ${table}`);
  return found;
}

const byText =
  (column: string) =>
  (a: WarehouseRow, b: WarehouseRow): number => {
    const x = text(a, column);
    const y = text(b, column);
    return x < y ? -1 : x > y ? 1 : 0;
  };

function studyProfile(
  warehouse: Warehouse,
  study: WarehouseRow
): OperationsStudyProfile {
  const croId = study.cro_vendor_id;
  const cro =
    typeof croId === "string"
      ? rows(warehouse, "gold.dim_vendor").find((v) => v.vendor_id === croId)
      : undefined;
  return {
    id: text(study, "study_id"),
    title: text(study, "study_title"),
    productType: text(study, "product_type"),
    phase: text(study, "phase"),
    regulatoryPath: text(study, "regulatory_path"),
    operatingModel: text(study, "operating_model"),
    croName: cro === undefined ? null : text(cro, "vendor_name"),
    status: text(study, "study_status"),
    hasCecAdjudication: study.has_cec_adjudication === true,
  };
}

/** Studies a run-by choice keeps: every study, the sponsor's, or one CRO's. */
function runByKeeps(runBy: string | undefined, study: WarehouseRow): boolean {
  if (runBy === undefined || runBy === "") return true;
  if (runBy === SPONSOR_RUN) return study.operating_model === SPONSOR_RUN;
  return study.cro_vendor_id === runBy;
}

function runByOptions(warehouse: Warehouse): OperationsRunByOption[] {
  const studies = rows(warehouse, "gold.dim_study");
  const vendors = rows(warehouse, "gold.dim_vendor");
  const count = (id: string) =>
    studies.filter((study) => runByKeeps(id, study)).length;
  const cros = [
    ...new Set(
      studies.flatMap((study) =>
        typeof study.cro_vendor_id === "string" ? [study.cro_vendor_id] : []
      )
    ),
  ].sort();
  return [
    { id: "", label: "All studies", studies: studies.length },
    {
      id: SPONSOR_RUN,
      label: "Run by the sponsor",
      studies: count(SPONSOR_RUN),
    },
    ...cros.map((id) => {
      const vendor = vendors.find((v) => v.vendor_id === id);
      return {
        id,
        label: `Run by ${vendor === undefined ? id : text(vendor, "vendor_name")} (CRO)`,
        studies: count(id),
      };
    }),
  ];
}

interface Resolved {
  readonly scope: OperationsScope;
  readonly level: OperationsLevel;
  readonly notice: string | null;
  readonly study: WarehouseRow | null;
  readonly country: WarehouseRow | null;
  readonly site: WarehouseRow | null;
}

/** A notice naming what was dropped from a scope and what is shown instead. */
function cutBack(dropped: readonly string[], shown: string): string | null {
  return dropped.length === 0 ? null : `${dropped.join(" ")} Showing ${shown}.`;
}

/**
 * Cuts a scope back to its deepest valid level: a study that exists, a
 * country the study has a site in, a site of that study (and of that
 * country, when one is given). A site given without its country takes the
 * site's country. A run-by choice applies on the portfolio level only.
 */
function resolveScope(warehouse: Warehouse, asked: OperationsScope): Resolved {
  const dropped: string[] = [];
  const runBy = asked.runBy || undefined;
  const runByKnown =
    runBy === undefined ||
    runByOptions(warehouse).some((option) => option.id === runBy);
  if (!runByKnown) dropped.push(`No run-by choice ${runBy}.`);
  const none = { study: null, country: null, site: null };
  const portfolio = (): Resolved => ({
    scope: runBy === undefined || !runByKnown ? {} : { runBy },
    level: "portfolio",
    notice: cutBack(dropped, "every study"),
    ...none,
  });
  if (asked.study === undefined) return portfolio();
  const study = rows(warehouse, "gold.dim_study").find(
    (s) => s.study_id === asked.study
  );
  if (study === undefined) {
    dropped.push(`No study ${asked.study} in the portfolio.`);
    return {
      ...portfolio(),
      scope: {},
      notice: cutBack(dropped, "the whole portfolio"),
    };
  }
  const studySites = rows(warehouse, "gold.dim_site").filter(
    (s) => s.is_current && s.study_id === asked.study
  );
  const countries = rows(warehouse, "gold.dim_country");
  if (asked.site !== undefined) {
    const site = studySites.find(
      (s) =>
        s.site_id === asked.site &&
        (asked.country === undefined || s.country_code === asked.country)
    );
    if (site !== undefined) {
      const code = text(site, "country_code");
      return {
        scope: { study: asked.study, country: code, site: asked.site },
        level: "site",
        notice: null,
        study,
        country: countries.find((c) => c.country_code === code) ?? null,
        site,
      };
    }
    dropped.push(
      `No site ${asked.site} in ${asked.study}${asked.country === undefined ? "" : ` in ${asked.country}`}.`
    );
  }
  const atStudy: Resolved = {
    scope: { study: asked.study },
    level: "study",
    notice: cutBack(dropped, asked.study),
    study,
    country: null,
    site: null,
  };
  if (asked.country === undefined) return atStudy;
  const country = countries.find((c) => c.country_code === asked.country);
  if (
    country === undefined ||
    !studySites.some((s) => s.country_code === asked.country)
  ) {
    dropped.push(`${asked.study} has no sites in ${asked.country}.`);
    return { ...atStudy, notice: cutBack(dropped, asked.study) };
  }
  return {
    scope: { study: asked.study, country: asked.country },
    level: "country",
    notice: cutBack(
      dropped,
      `${asked.study} in ${text(country, "country_name")}`
    ),
    study,
    country,
    site: null,
  };
}

/** Filters every report at a scope carries. */
function scopeFilters(
  warehouse: Warehouse,
  resolved: Resolved
): MetricFilter[] {
  const { scope } = resolved;
  if (scope.site !== undefined) {
    return [{ dimension: "site", operator: "in", values: [scope.site] }];
  }
  if (scope.study !== undefined) {
    const filters: MetricFilter[] = [
      { dimension: "study", operator: "in", values: [scope.study] },
    ];
    if (scope.country !== undefined) {
      filters.push({
        dimension: "country",
        operator: "in",
        values: [scope.country],
      });
    }
    return filters;
  }
  if (scope.runBy === undefined) return [];
  // Run-by is a set of studies, so the filter works for every metric,
  // including the ones that cannot be filtered by operating model.
  const kept = rows(warehouse, "gold.dim_study")
    .filter((study) => runByKeeps(scope.runBy, study))
    .map((study) => text(study, "study_id"));
  return [{ dimension: "study", operator: "in", values: kept }];
}

/**
 * A bands report with its empty cells read as zero. Each band counts the
 * rows of one table under one set of default filters, differing only in
 * the band's own condition, so a group any band counts is a group every
 * band looked at: a band with no row for it counted none.
 *
 * @param data - The built report.
 * @returns The report, every missing cell a zero.
 * @throws Error when the metrics are not counts of one table under the
 *   same default filters, where a missing row could mean a group outside a
 *   band's filters rather than a zero.
 */
function zeroFilled(data: ReportData): ReportData {
  const metrics = data.columns.map(
    (c) => METRIC_REGISTRY.find((m) => m.id === c.metricId)!
  );
  const shape = (m: MetricDefinition) =>
    m.formula.kind === "simple" && m.formula.measure.aggregation === "count"
      ? JSON.stringify([m.formula.measure.table, m.defaultFilters])
      : null;
  const shapes = new Set(metrics.map(shape));
  if (shapes.size !== 1 || shapes.has(null)) {
    throw new Error(
      `report ${data.spec.id}: bands must count one table under the same default filters`
    );
  }
  return {
    ...data,
    rows: data.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell, index) =>
        cell.value === null
          ? { value: 0, text: formatMetricValue(metrics[index], 0) }
          : cell
      ),
    })),
  };
}

/**
 * The report spec a panel becomes at a level. Its id and title name the
 * grouping, so the same panel at two levels is two reports. A breakdown
 * groups the same way at every level, so it keeps its own id and title.
 *
 * @param panel - The panel.
 * @param level - The level.
 * @param filters - The scope's filters.
 * @returns The spec.
 */
function panelSpec(
  panel: Panel,
  level: OperationsLevel,
  filters: readonly MetricFilter[]
): ReportSpec {
  if (panel.breakdown !== undefined) {
    return {
      id: panel.id,
      title: panel.title,
      audience: panel.audience,
      purpose: panel.purpose,
      tier: panel.tier,
      owner: panel.owner,
      version: "1.0.0",
      metrics: panel.metrics,
      dimensions: panel.breakdown,
      filters,
      visual: panel.visual,
      refreshSlaHours: panel.refreshSlaHours,
      signOff: null,
    };
  }
  const group = GROUP_BY[level];
  const visual = group === null ? panel.siteVisual : panel.visual;
  const dimensions: MetricDimensionId[] =
    visual === "line"
      ? ["month"]
      : group === null || visual === "stat"
        ? []
        : [group];
  const by = dimensions.length === 0 ? "" : ` ${BY_WORDS[dimensions[0]]}`;
  return {
    id: dimensions.length === 0 ? panel.id : `${panel.id}-by-${dimensions[0]}`,
    title: `${panel.title}${by}`,
    audience: panel.audience,
    purpose: panel.purpose,
    tier: panel.tier,
    owner: panel.owner,
    version: "1.0.0",
    metrics: panel.metrics,
    dimensions,
    filters,
    visual,
    refreshSlaHours: panel.refreshSlaHours,
    signOff: null,
  };
}

/** Dimension that names the scope itself: none for the portfolio. */
const SCOPE_DIMENSION: Readonly<
  Record<OperationsLevel, MetricDimensionId | null>
> = {
  portfolio: null,
  study: "study",
  country: "country",
  site: "site",
};

/**
 * The glance at a level. It groups by the scope's own dimension, so its
 * numbers are exactly the scope's row in the reports one level up: a
 * metric whose filters leave the scope out (the open query count of a
 * closed study, say) has no row there and none here, rather than a zero.
 */
function glanceSpec(
  level: OperationsLevel,
  filters: readonly MetricFilter[]
): ReportSpec {
  const own = SCOPE_DIMENSION[level];
  return {
    ...panelSpec(GLANCE, "site", filters),
    dimensions: own === null ? [] : [own],
  };
}

function shownAt(
  levels: readonly OperationsLevel[] | undefined,
  level: OperationsLevel
) {
  return levels === undefined || levels.includes(level);
}

/**
 * Every report spec the dashboard shows at a scope, the glance first, then
 * each section's in order. Every one passes `checkReportSpec`.
 *
 * @param warehouse - The warehouse the scope is read against.
 * @param scope - Where the dashboard is drilled to; an invalid scope is cut
 *   back as `operationsDashboard` does.
 * @returns The specs.
 */
export function operationsReportSpecs(
  warehouse: Warehouse,
  scope: OperationsScope = {}
): ReportSpec[] {
  const resolved = resolveScope(warehouse, scope);
  const filters = scopeFilters(warehouse, resolved);
  return [
    glanceSpec(resolved.level, filters),
    ...SECTIONS.filter((s) => shownAt(s.levels, resolved.level)).flatMap(
      (section) =>
        section.panels
          .filter((p) => shownAt(p.levels, resolved.level))
          .map((panel) => panelSpec(panel, resolved.level, filters))
    ),
  ];
}

function crumbs(resolved: Resolved): OperationsCrumb[] {
  const { scope } = resolved;
  const trail: OperationsCrumb[] = [
    {
      level: "portfolio",
      label: "Portfolio",
      scope: scope.runBy === undefined ? {} : { runBy: scope.runBy },
    },
  ];
  if (scope.study === undefined) return trail;
  trail.push({
    level: "study",
    label: scope.study,
    scope: { study: scope.study },
  });
  if (scope.country === undefined || resolved.country === null) return trail;
  trail.push({
    level: "country",
    label: text(resolved.country, "country_name"),
    scope: { study: scope.study, country: scope.country },
  });
  if (scope.site === undefined) return trail;
  trail.push({ level: "site", label: scope.site, scope });
  return trail;
}

function members(warehouse: Warehouse, resolved: Resolved): OperationsMember[] {
  const { scope, level } = resolved;
  const sites = rows(warehouse, "gold.dim_site").filter((s) => s.is_current);
  if (level === "portfolio") {
    return rows(warehouse, "gold.dim_study")
      .filter((study) => runByKeeps(scope.runBy, study))
      .slice()
      .sort(byText("study_id"))
      .map((study) => {
        const profile = studyProfile(warehouse, study);
        return {
          id: profile.id,
          label: profile.id,
          detail: profile.title,
          scope: { study: profile.id },
        };
      });
  }
  if (level === "study") {
    const counts = new Map<string, number>();
    for (const site of sites) {
      if (site.study_id !== scope.study) continue;
      const code = text(site, "country_code");
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return rows(warehouse, "gold.dim_country")
      .filter((country) => counts.has(text(country, "country_code")))
      .slice()
      .sort(byText("country_code"))
      .map((country) => {
        const code = text(country, "country_code");
        const n = counts.get(code) ?? 0;
        return {
          id: code,
          label: text(country, "country_name"),
          detail: `${n} ${n === 1 ? "site" : "sites"}`,
          scope: { study: scope.study, country: code },
        };
      });
  }
  if (level === "country") {
    return sites
      .filter(
        (site) =>
          site.study_id === scope.study && site.country_code === scope.country
      )
      .slice()
      .sort(byText("site_id"))
      .map((site) => ({
        id: text(site, "site_id"),
        label: text(site, "site_id"),
        detail: text(site, "site_name"),
        scope: {
          study: scope.study,
          country: scope.country,
          site: text(site, "site_id"),
        },
      }));
  }
  return [];
}

function milestones(
  warehouse: Warehouse,
  study: WarehouseRow
): OperationsMilestone[] {
  const kinds = new Map(
    rows(warehouse, "gold.dim_milestone").map((m) => [m.milestone_key, m])
  );
  return rows(warehouse, "gold.fct_milestone")
    .filter((m) => m.study_key === study.study_key)
    .slice()
    .sort(
      (a, b) =>
        Number(kinds.get(a.milestone_key)?.milestone_sequence) -
        Number(kinds.get(b.milestone_key)?.milestone_sequence)
    )
    .map((m) => ({
      kind: text(kinds.get(m.milestone_key) ?? {}, "milestone_kind"),
      label: text(m, "milestone_label"),
      planned: isoDate(Number(m.planned_date_key)),
      actual:
        typeof m.actual_date_key === "number"
          ? isoDate(m.actual_date_key)
          : null,
      varianceDays:
        typeof m.variance_days === "number" ? m.variance_days : null,
    }));
}

/** The current sites of the study in scope, narrowed to its country or site, with their country codes. */
function scopeSites(
  warehouse: Warehouse,
  resolved: Resolved
): Map<string, string> {
  const { scope } = resolved;
  return new Map(
    rows(warehouse, "gold.dim_site")
      .filter(
        (s) =>
          s.is_current &&
          s.study_id === scope.study &&
          (scope.country === undefined || s.country_code === scope.country) &&
          (scope.site === undefined || s.site_id === scope.site)
      )
      .map((s) => [text(s, "site_id"), text(s, "country_code")])
  );
}

/** Tables the milestone table reads, outside any metric. */
const MILESTONE_TABLES = ["gold.dim_milestone", "gold.fct_milestone"];

/**
 * The data products behind the numbers shown: every gold table a shown
 * metric's formula reads, the milestone tables when the milestone table is
 * shown, and the Risk tab's tables when it is, each with the freshness its
 * data contract promises.
 */
function sources(
  specs: readonly ReportSpec[],
  readsMilestones: boolean,
  readsRisk: boolean
): OperationsSource[] {
  const tables = new Set([
    ...(readsMilestones ? MILESTONE_TABLES : []),
    ...(readsRisk ? operationsRiskTables() : []),
  ]);
  const shown = new Set(specs.flatMap((spec) => spec.metrics));
  for (const metric of METRIC_REGISTRY) {
    if (!shown.has(metric.id)) continue;
    for (const source of formulaSources(metric.formula)) {
      tables.add(source.table);
    }
  }
  return [...tables].sort().map((productId) => {
    const registration = PRODUCT_REGISTRATIONS[productId];
    if (registration === undefined) {
      throw new Error(`${productId} is not a registered data product`);
    }
    return {
      productId,
      name: registration.name,
      freshnessHours: registration.freshnessHours,
      contractVersion: registration.version,
    };
  });
}

/**
 * The operations dashboard at a scope: the glance, one section per tab
 * with its reports and gaps, the breadcrumb trail, the studies, countries
 * or sites to drill into next, and below the portfolio level the study's
 * risk-based quality management narrowed to the scope.
 *
 * @param warehouse - The warehouse to report on.
 * @param scope - Where the dashboard is drilled to. An unknown study,
 *   country or site is dropped, with a notice saying so.
 * @returns The dashboard.
 */
export function operationsDashboard(
  warehouse: Warehouse,
  scope: OperationsScope = {}
): OperationsDashboard {
  const resolved = resolveScope(warehouse, scope);
  const filters = scopeFilters(warehouse, resolved);
  const study =
    resolved.study === null ? null : studyProfile(warehouse, resolved.study);
  const sections: OperationsSection[] = SECTIONS.filter((section) =>
    shownAt(section.levels, resolved.level)
  ).map((section) => ({
    id: section.id,
    title: section.title,
    summary: section.summary,
    reports: section.panels
      .filter((panel) => shownAt(panel.levels, resolved.level))
      .map((panel) => {
        const data = buildReport(
          warehouse,
          panelSpec(panel, resolved.level, filters)
        );
        return panel.bands ? zeroFilled(data) : data;
      }),
    gaps: section.gaps(study),
  }));
  const glance = buildReport(warehouse, glanceSpec(resolved.level, filters));
  const studyMilestones =
    resolved.level === "study" && resolved.study !== null
      ? milestones(warehouse, resolved.study)
      : null;
  const risk =
    resolved.study === null
      ? null
      : operationsRisk(
          warehouse,
          text(resolved.study, "study_id"),
          scopeSites(warehouse, resolved)
        );
  return {
    scope: resolved.scope,
    level: resolved.level,
    notice: resolved.notice,
    dataCut: warehouse.asOf,
    crumbs: crumbs(resolved),
    memberLevel: LEVEL_BELOW[resolved.level],
    members: members(warehouse, resolved),
    runByOptions: resolved.level === "portfolio" ? runByOptions(warehouse) : [],
    study,
    glance,
    sections,
    milestones: studyMilestones,
    risk,
    sources: sources(
      [glance, ...sections.flatMap((section) => section.reports)].map(
        (r) => r.spec
      ),
      studyMilestones !== null,
      risk !== null
    ),
  };
}
