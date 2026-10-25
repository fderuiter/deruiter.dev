/**
 * Clinical Data Platform: report spec, certification tier, catalog and pack
 * types.
 */
import type { ReportData, ReportTier, ReportVisual } from "./platform";
import type {
  CsmExclusion,
  CsmResult,
  CsmTestDefinition,
  CriticalToQualityFactor,
  KriStatus,
  QtlStatus,
  RiskSignalLogEntry,
} from "./rbqm";

/** A broken report rule, as found by `checkReportSpec`. */
export interface ReportFinding {
  /** Report the finding is about. */
  readonly reportId: string;
  /**
   * Rule family: the spec's own fields, its use of metrics, its visual, or
   * its tier's sign-off.
   */
  readonly rule: "spec" | "metric" | "visual" | "tier";
  /** What is wrong, in one sentence. */
  readonly message: string;
}

/** One entry of the report catalog. */
export interface ReportCatalogEntry {
  /** Report id. */
  readonly id: string;
  /** Title. */
  readonly title: string;
  /** Audience. */
  readonly audience: string;
  /** Purpose. */
  readonly purpose: string;
  /** Tier. */
  readonly tier: ReportTier;
  /** Owner. */
  readonly owner: string;
  /** Spec version. */
  readonly version: string;
  /** Visual. */
  readonly visual: ReportVisual;
  /** Names of the metrics shown. */
  readonly metricNames: readonly string[];
  /** ISO 8601 data cut of the last refresh, or `null` when not known. */
  readonly lastRefresh: string | null;
  /** Refresh SLA in hours. */
  readonly refreshSlaHours: number;
  /** Recorded views, or `null` when no usage count was supplied. */
  readonly views: number | null;
}

/** A search of the report catalog. Every given criterion must match. */
export interface ReportCatalogQuery {
  /** Words matched, case-insensitively, against title, purpose, audience, owner and metric names. */
  readonly text?: string;
  /** Tiers kept; empty or absent keeps every tier. */
  readonly tiers?: readonly ReportTier[];
  /** Audience kept, exactly; absent keeps every audience. */
  readonly audience?: string;
}

/** How far the operations dashboard is drilled: the whole portfolio, one study, one of its countries or one site. */
export type OperationsLevel = "portfolio" | "study" | "country" | "site";

/**
 * Where the operations dashboard is drilled to (#2630). Each field narrows
 * the one before it: a country is read within the study, a site within the
 * study and country.
 */
export interface OperationsScope {
  /** Study id, for example `DEMO-301`. */
  readonly study?: string;
  /** ISO 3166-1 alpha-2 country code of a country the study has sites in. */
  readonly country?: string;
  /** Site id, for example `DEMO-301-US-101`. */
  readonly site?: string;
  /**
   * Portfolio level only: who runs the studies shown, `sponsor` or a CRO's
   * vendor id. Absent shows every study.
   */
  readonly runBy?: string;
}

/** One step of the dashboard's breadcrumb trail. */
export interface OperationsCrumb {
  readonly level: OperationsLevel;
  /** What the step shows, for example `DEMO-301` or `Canada`. */
  readonly label: string;
  /** The scope that opens the step. */
  readonly scope: OperationsScope;
}

/** A study, country or site one level down that the dashboard can drill into. */
export interface OperationsMember {
  /** Study id, country code or site id. */
  readonly id: string;
  /** Short name: the study id, country name or site id. */
  readonly label: string;
  /** One line about it, for example a study title or a site name. */
  readonly detail: string;
  /** The scope that opens it. */
  readonly scope: OperationsScope;
}

/** A "run by" choice on the portfolio level: every study, the sponsor's own, or one CRO's. */
export interface OperationsRunByOption {
  /** `""` for every study, `sponsor`, or a CRO's vendor id. */
  readonly id: string;
  readonly label: string;
  /** How many studies the choice keeps. */
  readonly studies: number;
}

/** Something a section is expected to show that the governed model cannot compute yet. */
export interface OperationsGap {
  /** What is missing, for example `eTMF completeness`. */
  readonly name: string;
  /** Why the governed model leaves it out. */
  readonly reason: string;
  /** Issue that will add it, or `null` when none is filed. */
  readonly issue: number | null;
}

/** A study milestone, planned and actual, in the study's own vocabulary (drug or device). */
export interface OperationsMilestone {
  /** Milestone kind, for example `regulatory-approval`. */
  readonly kind: string;
  /** Label, for example `IDE approval` for a device study. */
  readonly label: string;
  /** ISO 8601 planned date. */
  readonly planned: string;
  /** ISO 8601 actual date, or `null` when not yet reached. */
  readonly actual: string | null;
  /** Actual minus planned, in days; negative is early. `null` when not yet reached. */
  readonly varianceDays: number | null;
}

/** What a study is and who runs it, shown when the dashboard is drilled into it. */
export interface OperationsStudyProfile {
  readonly id: string;
  readonly title: string;
  readonly productType: string;
  readonly phase: string;
  /** Regulatory pathway, for example `IND` or `IDE`. */
  readonly regulatoryPath: string;
  /** `sponsor` or `cro`. */
  readonly operatingModel: string;
  /** Fictional CRO name for a CRO-run study, otherwise `null`. */
  readonly croName: string | null;
  readonly status: string;
  /** Whether a clinical events committee adjudicates the study's events. */
  readonly hasCecAdjudication: boolean;
}

/** Section of the operations dashboard. */
export type OperationsSectionId =
  | "enrollment"
  | "activation"
  | "data-management"
  | "quality"
  | "risk"
  | "milestones";

/** One tab of the operations dashboard: its reports and what it cannot show yet. */
export interface OperationsSection {
  readonly id: OperationsSectionId;
  readonly title: string;
  /** What the section answers, in one sentence. */
  readonly summary: string;
  readonly reports: readonly ReportData[];
  readonly gaps: readonly OperationsGap[];
}

/**
 * A data product the dashboard's numbers read, with the freshness its data
 * contract promises (#2626).
 */
export interface OperationsSource {
  /** Data product id: the qualified gold table, for example `gold.fct_query`. */
  readonly productId: string;
  /** Product name. */
  readonly name: string;
  /** Longest gap between loads the product's contract allows, in hours. */
  readonly freshnessHours: number;
  /** Version of the contract in force. */
  readonly contractVersion: string;
}

/** One KRI at one site, as the Risk tab shows it. */
export interface OperationsKriCell {
  readonly siteId: string;
  readonly status: KriStatus;
  /** The value in the metric's unit, for example `12.5%`. */
  readonly text: string;
}

/** A key risk indicator across the sites in scope. */
export interface OperationsKri {
  readonly id: string;
  readonly name: string;
  /** The registry metric it evaluates. */
  readonly metricId: string;
  /** Where it turns amber and red, in words and the metric's unit. */
  readonly thresholds: string;
  /** Why those thresholds. */
  readonly reason: string;
  /** Fewest observations a site needs before it is assessed, in words. */
  readonly minimum: string;
  /** One cell per site in scope, in site order. */
  readonly cells: readonly OperationsKriCell[];
}

/** A quality tolerance limit of the study, as the Risk tab shows it. */
export interface OperationsQtl {
  readonly id: string;
  readonly name: string;
  readonly status: QtlStatus;
  /** Values in the metric's unit. */
  readonly value: string;
  readonly secondaryLimit: string;
  readonly limit: string;
  /** What the parameter stands for and why it matters. */
  readonly rationale: string;
  /** The response planned before any breach. */
  readonly response: string;
}

/** A site on the Risk tab, and the dashboard scope that drills into it. */
export interface OperationsRiskSite {
  readonly id: string;
  readonly scope: OperationsScope;
}

/** A critical-to-quality factor, with the KRIs and QTLs that watch it by name. */
export interface OperationsRiskFactor {
  readonly id: string;
  readonly name: string;
  readonly risk: string;
  readonly kris: readonly string[];
  readonly qtls: readonly string[];
  /** What the platform cannot watch yet, with the issue that adds it; `null` when nothing is missing. */
  readonly gap: CriticalToQualityFactor["gap"];
}

/** Central statistical monitoring of the sites in scope. */
export interface OperationsCsm {
  /** False discovery rate the tests are controlled at, across the whole study. */
  readonly fdr: number;
  readonly tests: readonly CsmTestDefinition[];
  /** Sites in scope with enough data to test, in id order. */
  readonly sites: readonly string[];
  /** Every result at those sites, by site then test. */
  readonly results: readonly CsmResult[];
  /** What could not be tested in scope, and why. */
  readonly excluded: readonly CsmExclusion[];
}

/**
 * Risk-based quality management for the study drilled into (#2631),
 * narrowed to the country or site in scope. QTLs are study-level, so they
 * are never narrowed.
 */
export interface OperationsRisk {
  readonly studyId: string;
  /** Quality plan version, and the ISO 8601 date it took effect. */
  readonly planVersion: string;
  readonly planEffectiveOn: string;
  /** Activated sites in scope, in id order, each with the scope that drills into it. */
  readonly sites: readonly OperationsRiskSite[];
  readonly factors: readonly OperationsRiskFactor[];
  readonly kris: readonly OperationsKri[];
  readonly qtls: readonly OperationsQtl[];
  readonly csm: OperationsCsm;
  /**
   * The risk signal log at the data cut: every study-level signal, and the
   * site signals raised at a site in scope.
   */
  readonly log: readonly RiskSignalLogEntry[];
}

/** The operations dashboard at one scope, evaluated over one warehouse. */
export interface OperationsDashboard {
  /** The scope shown: the one asked for, cut back to its deepest valid level. */
  readonly scope: OperationsScope;
  readonly level: OperationsLevel;
  /** Why the scope asked for was cut back, or `null` when it was valid. */
  readonly notice: string | null;
  /** ISO 8601 data cut of the warehouse. */
  readonly dataCut: string;
  /** Breadcrumb trail from the portfolio to the scope shown. */
  readonly crumbs: readonly OperationsCrumb[];
  /** Level the members belong to, or `null` at a site, the deepest level. */
  readonly memberLevel: OperationsLevel | null;
  /** Studies, countries or sites one level down, in id order. */
  readonly members: readonly OperationsMember[];
  /** Run-by choices on the portfolio level; empty below it. */
  readonly runByOptions: readonly OperationsRunByOption[];
  /** The study drilled into, or `null` at the portfolio level. */
  readonly study: OperationsStudyProfile | null;
  /** Headline numbers for the scope, from the registry. */
  readonly glance: ReportData;
  readonly sections: readonly OperationsSection[];
  /** The study's milestones at the study level; `null` at every other level. */
  readonly milestones: readonly OperationsMilestone[] | null;
  /** Risk-based quality management at the study level and below; `null` at the portfolio level. */
  readonly risk: OperationsRisk | null;
  /** Data products the numbers shown read, in id order. */
  readonly sources: readonly OperationsSource[];
}
