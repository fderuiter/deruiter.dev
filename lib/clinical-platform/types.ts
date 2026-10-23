/**
 * Clinical Data Platform: public type contracts.
 *
 * One synthetic sponsor portfolio is modelled in three medallion layers,
 * governed as data products with versioned contracts, and served to every
 * consumer through one semantic layer of metric definitions (ADR 0066).
 */
import type { StandardVersions } from "@/lib/study-data";

/**
 * Medallion layer. Bronze holds raw source feeds, silver holds conformed and
 * quality-checked data products, gold holds star-schema marts and the Study
 * Data Pipeline's SDTM and ADaM output. Data flows towards gold, never back.
 */
export type MedallionLayer = "bronze" | "silver" | "gold";

/** Display metadata for one medallion layer. */
export interface LayerDefinition {
  /** Stable layer id. */
  readonly id: MedallionLayer;
  /** Short label. */
  readonly label: string;
  /** One sentence on what the layer holds. */
  readonly summary: string;
}

/** A private stage folder under `lib/clinical-platform/internal/`. */
export type PlatformStageId =
  | "portfolio"
  | "warehouse"
  | "semantic"
  | "quality"
  | "governance"
  | "lineage"
  | "rbqm"
  | "migration"
  | "interop"
  | "strategy";

/** Display metadata for one engine stage. */
export interface PlatformStage {
  /** Stable stage id, the name of its folder under `internal/`. */
  readonly id: PlatformStageId;
  /** Short label. */
  readonly label: string;
  /** One sentence on what the stage provides. */
  readonly summary: string;
}

/** Kind of investigational product a study evaluates. */
export type ProductType = "drug" | "biologic" | "device";

/** Development phase, or the device study stage. */
export type StudyPhase =
  | "Phase I"
  | "Phase II"
  | "Phase III"
  | "Device feasibility"
  | "Device pivotal";

/** Who runs day-to-day study operations. */
export type OperatingModel = "sponsor" | "cro";

/** Lifecycle status of a study. */
export type StudyStatus =
  "planned" | "start-up" | "enrolling" | "follow-up" | "closed";

/**
 * Provenance every generated record carries. The platform holds synthetic
 * data only, and each record says so on its own, so a row copied out of a
 * table or a download keeps the label.
 */
export interface SyntheticRecord {
  /** Always `true`: the record is synthetic and describes nothing real. */
  readonly synthetic: true;
}

/** Operational source system a bronze feed record comes from. */
export type SourceSystem = "EDC" | "CTMS" | "IRT" | "eTMF" | "Finance" | "CEC";

/** A raw record in a bronze feed, as received from its source system. */
export interface BronzeRecord extends SyntheticRecord {
  /** Source system the record was received from. */
  readonly source: SourceSystem;
}

/** One investigator site in one study. */
export interface Site extends SyntheticRecord {
  /** Stable site id, unique within the portfolio. */
  readonly id: string;
  /** Id of the study the site belongs to. */
  readonly studyId: string;
  /** Site number within the study, as printed on the site's documents. */
  readonly siteNumber: string;
  /** ISO 3166-1 alpha-2 country code. */
  readonly country: string;
  /** Fictional site name. */
  readonly name: string;
  /** Enrollment target for this site. */
  readonly plannedEnrollment: number;
  /** ISO 8601 activation date, or `null` before activation. */
  readonly activatedOn: string | null;
}

/**
 * One planned encounter in a study's schedule, shaped after a USDM
 * encounter with its timing and window.
 */
export interface PlannedVisit {
  /** Stable visit id within the study, for example `W12`. */
  readonly id: string;
  /** Display name, for example `Week 12`. */
  readonly name: string;
  /** Planned day relative to the enrollment visit, which is day 0. */
  readonly day: number;
  /** Allowed deviation from the planned day, in days either side. */
  readonly windowDays: number;
  /** Whether investigational product is dispensed at the visit. */
  readonly dispensesProduct: boolean;
}

/** One study in the portfolio. */
export interface Study extends SyntheticRecord {
  /** Stable protocol id, for example `DEMO-301`. */
  readonly id: string;
  /** Short title. */
  readonly title: string;
  /** Therapeutic area. */
  readonly therapeuticArea: string;
  /** Investigational product type. */
  readonly productType: ProductType;
  /** Development phase or device study stage. */
  readonly phase: StudyPhase;
  /** US regulatory pathway: an IND for drugs and biologics, an IDE for devices. */
  readonly regulatoryPath: "IND" | "IDE";
  /** Who runs the study. */
  readonly operatingModel: OperatingModel;
  /** Fictional vendor id of the CRO, when `operatingModel` is `cro`. */
  readonly croVendorId: string | null;
  /** Lifecycle status at the portfolio's data cut. */
  readonly status: StudyStatus;
  /** ISO 8601 study start: the date the protocol was finalised. */
  readonly startOn: string;
  /** Enrollment target across all sites. */
  readonly plannedEnrollment: number;
  /** Whether subjects are randomised through IRT. */
  readonly randomized: boolean;
  /** Treatment arms, or the single open-label arm. */
  readonly arms: readonly string[];
  /** Planned schedule of visits, screening first. */
  readonly plannedVisits: readonly PlannedVisit[];
  /**
   * Where the schedule comes from: the USDM study definition the Study Data
   * Pipeline runs, or the portfolio's own blueprint.
   */
  readonly scheduleSource: "usdm" | "blueprint";
  /** Whether a clinical events committee adjudicates endpoint events. */
  readonly cecAdjudication: boolean;
  /**
   * Id of the Study Data Pipeline data product that supplies this study's
   * SDTM and ADaM (ADR 0065), or `null` when the study has none.
   */
  readonly studyDataProductId: string | null;
}

/** A fictional vendor: CRO, EDC, IRT, CTMS, eTMF or central lab provider. */
export interface Vendor extends SyntheticRecord {
  /** Stable vendor id. */
  readonly id: string;
  /** Fictional name. Never the name of a real company. */
  readonly name: string;
  /** Service the vendor provides. */
  readonly service: "CRO" | "EDC" | "IRT" | "CTMS" | "eTMF" | "Central lab";
}

/** Lifecycle status of a subject in the EDC. */
export type SubjectStatus =
  "screening" | "screen-failed" | "enrolled" | "completed" | "discontinued";

/** EDC subject record: screening, enrollment and disposition. */
export interface EdcSubject extends BronzeRecord {
  /** Subject id, unique within the portfolio. */
  readonly subjectId: string;
  /** Study id. */
  readonly studyId: string;
  /** Site id. */
  readonly siteId: string;
  /** ISO 8601 date of the screening visit. */
  readonly screenedOn: string;
  /** ISO 8601 enrollment date, or `null` when not enrolled. */
  readonly enrolledOn: string | null;
  /** ISO 8601 date the subject completed the study, or `null`. */
  readonly completedOn: string | null;
  /** ISO 8601 date the subject discontinued, or `null`. */
  readonly discontinuedOn: string | null;
  /** Status at the data cut. */
  readonly status: SubjectStatus;
}

/** EDC visit record, with its data entry time. */
export interface EdcVisit extends BronzeRecord {
  /** Visit record id. */
  readonly visitId: string;
  /** Subject id. */
  readonly subjectId: string;
  /** Study id. */
  readonly studyId: string;
  /** Site id. */
  readonly siteId: string;
  /** Planned visit id from the study schedule. */
  readonly plannedVisitId: string;
  /** ISO 8601 visit date, or `null` for a missed visit. */
  readonly visitDate: string | null;
  /** Actual minus planned day; `null` for a missed visit. */
  readonly dayOffset: number | null;
  /** ISO 8601 timestamp the site entered the visit's data, or `null`. */
  readonly dataEnteredAt: string | null;
  /** Entry state at the data cut. */
  readonly status: "entered" | "pending-entry" | "missed";
}

/** EDC data query, with its open, answer and close times. */
export interface EdcQuery extends BronzeRecord {
  /** Query id. */
  readonly queryId: string;
  /** Visit record id the query is raised on. */
  readonly visitId: string;
  /** Subject id. */
  readonly subjectId: string;
  /** Study id. */
  readonly studyId: string;
  /** Site id. */
  readonly siteId: string;
  /** Queried field, as `DOMAIN.VARIABLE`. */
  readonly field: string;
  /** How the query was raised. */
  readonly origin: "edit-check" | "manual";
  /** ISO 8601 timestamp the query was opened. */
  readonly openedAt: string;
  /** ISO 8601 timestamp the site answered, or `null`. */
  readonly answeredAt: string | null;
  /** ISO 8601 timestamp the query was closed, or `null`. */
  readonly closedAt: string | null;
  /** State at the data cut. */
  readonly status: "open" | "answered" | "closed";
}

/** Study milestone kind, covering drug and ISO 14155 device milestones. */
export type MilestoneKind =
  | "protocol-final"
  | "regulatory-approval"
  | "first-site-activated"
  | "first-subject-in"
  | "fifty-percent-enrolled"
  | "last-subject-in"
  | "last-subject-last-visit"
  | "database-lock"
  | "final-report";

/** CTMS study milestone, planned and actual. */
export interface CtmsMilestone extends BronzeRecord {
  /** Study id. */
  readonly studyId: string;
  /** Milestone kind. */
  readonly kind: MilestoneKind;
  /** Display label in the study's own vocabulary (drug or device). */
  readonly label: string;
  /** ISO 8601 planned date. */
  readonly plannedOn: string;
  /** ISO 8601 actual date, or `null` when not yet reached. */
  readonly actualOn: string | null;
}

/** CTMS monitoring visit, with source data verification counts. */
export interface CtmsMonitoringVisit extends BronzeRecord {
  /** Monitoring visit id. */
  readonly monitoringVisitId: string;
  /** Study id. */
  readonly studyId: string;
  /** Site id. */
  readonly siteId: string;
  /** Visit type: site initiation, interim monitoring or close-out. */
  readonly type: "SIV" | "IMV" | "COV";
  /** On-site or remote. */
  readonly mode: "on-site" | "remote";
  /** ISO 8601 visit date. */
  readonly visitDate: string;
  /** ISO 8601 date the visit report was finalised, or `null`. */
  readonly reportFinalOn: string | null;
  /** CRF pages due for source data verification at the visit. */
  readonly sdvPagesDue: number;
  /** CRF pages source-verified at the visit. */
  readonly sdvPagesVerified: number;
  /** Action items raised. */
  readonly actionItems: number;
}

/** IRT randomisation record. */
export interface IrtRandomization extends BronzeRecord {
  /** Randomisation number. */
  readonly randomizationId: string;
  /** Subject id. */
  readonly subjectId: string;
  /** Study id. */
  readonly studyId: string;
  /** Site id. */
  readonly siteId: string;
  /** ISO 8601 randomisation timestamp. */
  readonly randomizedAt: string;
  /** Assigned arm. Blinded consumers must not read it. */
  readonly arm: string;
}

/** IRT investigational product kit. */
export interface IrtKit extends BronzeRecord {
  /** Kit number. */
  readonly kitId: string;
  /** Study id. */
  readonly studyId: string;
  /** Site id holding the kit. */
  readonly siteId: string;
  /** Subject the kit was dispensed to, or `null`. */
  readonly subjectId: string | null;
  /** ISO 8601 date the site received the kit. */
  readonly receivedOn: string;
  /** ISO 8601 dispensing date, or `null`. */
  readonly dispensedOn: string | null;
  /** ISO 8601 expiry date. */
  readonly expiresOn: string;
  /** State at the data cut. */
  readonly status: "available" | "dispensed" | "expired";
}

/** eTMF expected document, filed against the TMF Reference Model. */
export interface EtmfDocument extends BronzeRecord {
  /** Document id. */
  readonly documentId: string;
  /** Study id. */
  readonly studyId: string;
  /** Site id, or `null` for a trial-level document. */
  readonly siteId: string | null;
  /** TMF Reference Model zone. */
  readonly zone: string;
  /** Artifact name. */
  readonly artifact: string;
  /** ISO 8601 date the document is due. */
  readonly dueOn: string;
  /** ISO 8601 filing date, or `null`. */
  readonly filedOn: string | null;
  /** State at the data cut: filed, overdue and missing, or not yet due. */
  readonly status: "filed" | "missing" | "expected";
}

/** Finance line: budget against actual for one study, vendor and quarter. */
export interface FinanceLine extends BronzeRecord {
  /** Study id. */
  readonly studyId: string;
  /** Vendor id, or `null` for investigator grants paid to sites. */
  readonly vendorId: string | null;
  /** Cost category. */
  readonly category: string;
  /** Calendar quarter, for example `2026-Q3`. */
  readonly period: string;
  /** Budgeted amount, whole US dollars. */
  readonly budgetUsd: number;
  /** Actual spend, whole US dollars. */
  readonly actualUsd: number;
}

/** Importance of a protocol deviation, after ICH E3 "important" deviations. */
export type DeviationImportance = "important" | "not-important";

/** Protocol deviation, as logged in CTMS. */
export interface ProtocolDeviation extends BronzeRecord {
  /** Deviation id. */
  readonly deviationId: string;
  /** Study id. */
  readonly studyId: string;
  /** Site id. */
  readonly siteId: string;
  /** Subject id. */
  readonly subjectId: string;
  /** Deviation category. */
  readonly category: string;
  /** Importance per ICH E3. */
  readonly importance: DeviationImportance;
  /** ISO 8601 date the deviation occurred. */
  readonly occurredOn: string;
  /** ISO 8601 date the deviation was identified. */
  readonly identifiedOn: string;
}

/** Clinical events committee adjudication of one site-reported event. */
export interface CecAdjudication extends BronzeRecord {
  /** Event id. */
  readonly eventId: string;
  /** Study id. */
  readonly studyId: string;
  /** Site id. */
  readonly siteId: string;
  /** Subject id. */
  readonly subjectId: string;
  /** Event type as reported by the site. */
  readonly siteEventType: string;
  /** Whether the site judged the event device-related. */
  readonly siteDeviceRelated: boolean;
  /** ISO 8601 date the event occurred. */
  readonly occurredOn: string;
  /** ISO 8601 date the site reported the event. */
  readonly reportedOn: string;
  /** ISO 8601 adjudication date, or `null` while pending. */
  readonly adjudicatedOn: string | null;
  /** Event type as adjudicated, or `null` while pending. */
  readonly cecEventType: string | null;
  /** Whether the committee judged the event device-related, or `null`. */
  readonly cecDeviceRelated: boolean | null;
}

/** The EDC feed: subjects, visits and queries. */
export interface EdcFeed {
  /** Subject records. */
  readonly subjects: readonly EdcSubject[];
  /** Visit records. */
  readonly visits: readonly EdcVisit[];
  /** Query records. */
  readonly queries: readonly EdcQuery[];
}

/** The CTMS feed: milestones, monitoring visits and protocol deviations. */
export interface CtmsFeed {
  /** Study milestones. */
  readonly milestones: readonly CtmsMilestone[];
  /** Monitoring visits. */
  readonly monitoringVisits: readonly CtmsMonitoringVisit[];
  /** Protocol deviations. */
  readonly deviations: readonly ProtocolDeviation[];
}

/** The IRT feed: randomisations and kits. */
export interface IrtFeed {
  /** Randomisation records. */
  readonly randomizations: readonly IrtRandomization[];
  /** Kit records. */
  readonly kits: readonly IrtKit[];
}

/** The raw operational feeds of the bronze layer, grouped by source. */
export interface BronzeFeeds {
  /** Electronic data capture. */
  readonly edc: EdcFeed;
  /** Clinical trial management system. */
  readonly ctms: CtmsFeed;
  /** Interactive response technology. */
  readonly irt: IrtFeed;
  /** Electronic trial master file: expected documents. */
  readonly etmf: readonly EtmfDocument[];
  /** Finance: budget against actual. */
  readonly finance: readonly FinanceLine[];
  /** Clinical events committee adjudications, for studies that have one. */
  readonly cec: readonly CecAdjudication[];
}

/** Kind of pattern planted in the portfolio for analytics to find. */
export type PortfolioSignalKind =
  | "slow-enrolling-site"
  | "data-integrity"
  | "study-behind-plan"
  | "vendor-over-budget";

/**
 * A pattern the generator planted on purpose, so dashboards, RBQM and tests
 * can check that it is found. The answer key, not an input to any metric.
 */
export interface PortfolioSignal extends SyntheticRecord {
  /** Signal kind. */
  readonly kind: PortfolioSignalKind;
  /** Study the signal is in, or `null` for a vendor-wide signal. */
  readonly studyId: string | null;
  /** Site, for site-level signals; otherwise `null`. */
  readonly siteId: string | null;
  /** Vendor, for vendor signals; otherwise `null`. */
  readonly vendorId: string | null;
  /** What was planted, in one sentence. */
  readonly description: string;
}

/**
 * The Study Data Pipeline run a study's bronze records were taken from
 * (ADR 0065, ADR 0066). Rerunning `runPipeline` from `@/lib/study-data` with
 * the study's definition, `seed` and `nSubjects` reproduces the source
 * datasets; adding `dateShiftDays` to their dates gives the portfolio's.
 */
export interface StudyDataRunReference extends SyntheticRecord {
  /** Study id, for example `DEMO-301`. */
  readonly studyId: string;
  /** Id of the gold data product the run publishes (`STUDY_DATA_PRODUCT_ID`). */
  readonly productId: string;
  /** Seed the pipeline ran with. */
  readonly seed: number;
  /** Number of subjects the pipeline generated, screen failures included. */
  readonly nSubjects: number;
  /** Collected-layer datasets the bronze feeds were read from. */
  readonly sourceDatasets: readonly string[];
  /**
   * Whole days added to every pipeline date to place the study on the
   * portfolio's calendar. Study days and visit order are unchanged.
   */
  readonly dateShiftDays: number;
  /** Standard versions the run declares, from its manifest. */
  readonly standards: StandardVersions;
}

/** Options for generating a portfolio. */
export interface PortfolioOptions {
  /** Seed: an integer from 0 to 4294967295. The same seed gives the same portfolio. */
  readonly seed: number;
}

/** One synthetic sponsor portfolio: studies, sites, vendors and bronze feeds. */
export interface Portfolio {
  /** Stable portfolio id. */
  readonly id: string;
  /** Fictional sponsor name. */
  readonly sponsor: string;
  /** Seed the portfolio was generated from. */
  readonly seed: number;
  /** ISO 8601 data cut: no record describes anything after this date. */
  readonly asOf: string;
  /** Studies in the portfolio. */
  readonly studies: readonly Study[];
  /** Sites across all studies. */
  readonly sites: readonly Site[];
  /** Fictional vendors the studies use. */
  readonly vendors: readonly Vendor[];
  /** Bronze-layer operational feeds. */
  readonly feeds: BronzeFeeds;
  /** Patterns planted on purpose for analytics to find. */
  readonly signals: readonly PortfolioSignal[];
  /** Study Data Pipeline runs that supplied study records, one per study. */
  readonly studyDataRuns: readonly StudyDataRunReference[];
}

/** Data classification of a data product. */
export type DataClassification =
  "public" | "internal" | "confidential" | "restricted";

/** A governed data product: a dataset with an owner, a contract and consumers. */
export interface DataProduct {
  /** Stable product id. */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Medallion layer the product is published in. */
  readonly layer: MedallionLayer;
  /** One sentence on what the product holds. */
  readonly description: string;
  /** Accountable business owner (a role, not a person). */
  readonly owner: string;
  /** Data steward (a role, not a person). */
  readonly steward: string;
  /** Data classification. */
  readonly classification: DataClassification;
  /** Id of the contract currently in force. */
  readonly contractId: string;
  /** Ids of the products this one is built from. */
  readonly upstream: readonly string[];
}

/** One column a data contract guarantees. */
export interface ContractColumn {
  /** Column name. */
  readonly name: string;
  /** Logical type. */
  readonly type:
    "string" | "integer" | "decimal" | "boolean" | "date" | "timestamp";
  /** Whether the column may hold `null`. */
  readonly nullable: boolean;
  /** Business description. */
  readonly description: string;
}

/** A versioned data contract for one data product. */
export interface DataContract {
  /** Stable contract id. */
  readonly id: string;
  /** Id of the product the contract governs. */
  readonly productId: string;
  /** Semantic version. A breaking schema change needs a major version bump. */
  readonly version: string;
  /** Columns the product guarantees. */
  readonly columns: readonly ContractColumn[];
  /** Service levels the product promises. */
  readonly sla: {
    /** Maximum age of the newest record, in hours. */
    readonly freshnessHours: number;
    /** Minimum share of required values present, from 0 to 1. */
    readonly completeness: number;
  };
}

/** Grain a metric is computed at. */
export type MetricGrain = "portfolio" | "study" | "site" | "country" | "month";

/**
 * One governed metric in the semantic layer. Defined once and compiled to
 * every consumer; no dashboard computes a metric itself.
 */
export interface MetricDefinition {
  /** Stable metric id, for example `screen_failure_rate`. */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Business definition in one or two sentences. */
  readonly description: string;
  /** Aggregation applied to the measure. */
  readonly aggregation: "count" | "sum" | "avg" | "ratio" | "median";
  /** Measure expression, in the registry's own expression syntax. */
  readonly expression: string;
  /** Denominator expression, for `ratio` metrics only. */
  readonly denominator: string | null;
  /** Finest grain the metric is valid at. */
  readonly grain: MetricGrain;
  /** Unit for display, for example `%` or `days`. */
  readonly unit: string;
  /** Id of the gold data product the metric reads. */
  readonly sourceProductId: string;
  /** Accountable owner (a role). */
  readonly owner: string;
  /** Semantic version of the definition. */
  readonly version: string;
  /** Whether the metric is certified for use in certified reports. */
  readonly certified: boolean;
}

/** Data quality dimension, after DAMA-DMBOK. */
export type DqDimension =
  | "completeness"
  | "validity"
  | "uniqueness"
  | "consistency"
  | "timeliness"
  | "accuracy";

/** Severity of a data quality rule breach. */
export type DqSeverity = "info" | "warning" | "error" | "critical";

/** One data quality rule. */
export interface DqRule {
  /** Stable rule id, for example `DQ-SITE-001`. */
  readonly id: string;
  /** Id of the product the rule checks. */
  readonly productId: string;
  /** Column the rule checks, or `null` for a table-level rule. */
  readonly column: string | null;
  /** Quality dimension. */
  readonly dimension: DqDimension;
  /** Severity of a breach. */
  readonly severity: DqSeverity;
  /** Minimum pass rate, from 0 to 1. */
  readonly threshold: number;
  /** What the rule checks, in one sentence. */
  readonly description: string;
  /** Accountable owner (a role). */
  readonly owner: string;
}

/** A column in a data product, located in its layer. */
export interface ColumnRef {
  /** Id of the data product. */
  readonly productId: string;
  /** Layer the product is published in. */
  readonly layer: MedallionLayer;
  /** Column name. */
  readonly column: string;
}

/** One column-level lineage edge, exportable as an OpenLineage column facet. */
export interface LineageEdge {
  /** Source column. */
  readonly from: ColumnRef;
  /** Target column. */
  readonly to: ColumnRef;
  /** Transformation applied, for example `identity`, `cast` or `aggregate`. */
  readonly transformation: string;
}

/** A finding from the platform's own policy checks. */
export interface PolicyFinding {
  /** Rule that produced the finding. */
  readonly rule: "regulatory-wording" | "layer-flow";
  /** What is wrong, in one sentence. */
  readonly message: string;
}

/** Editable criterion in a synthetic vendor comparison. */
export interface StrategyCriterion {
  id: string;
  label: string;
  group: string;
  weight: number;
}
/** Fictional vendor and its ratings from zero to five. */
export interface StrategyVendor {
  id: string;
  name: string;
  ratings: Record<string, number>;
}
/** Browser-only strategy inputs; no real vendor evidence is represented. */
export interface StrategyScenario {
  criteria: StrategyCriterion[];
  vendors: StrategyVendor[];
}
/** A normalized score, or null when every criterion weight is zero. */
export interface StrategyScore {
  id: string;
  name: string;
  score: number | null;
}
/** Five-year financial assumptions in synthetic thousands of currency units. */
export interface StrategyCashFlow {
  implementation: number;
  validation: number;
  annualLicense: number;
  annualRun: number;
  annualBenefit: number;
  decommissionSavings: number;
  discountRate: number;
}
/** Roadmap work item with dependency ids and capacity units. */
export interface RoadmapItem {
  id: string;
  label: string;
  capability: string;
  effort: number;
  dependsOn: string[];
}
/** Text fields in a one-page decision memo. */
export interface StrategyMemo {
  context: string;
  options: string;
  criteria: string;
  recommendation: string;
  risks: string;
}
