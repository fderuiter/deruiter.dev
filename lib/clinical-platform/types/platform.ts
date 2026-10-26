/**
 * Clinical Data Platform: contracts shared across stages, such as layers,
 * studies, sites, data products and metrics.
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
  /** ISO 8601 date the sponsor selected the site, or `null` before then (#2880). */
  readonly selectedOn: string | null;
  /** ISO 8601 date the clinical trial agreement was executed, or `null` before then. */
  readonly contractedOn: string | null;
  /** ISO 8601 date the IRB or ethics committee approved the study at the site, or `null` before then. */
  readonly irbApprovedOn: string | null;
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
  /**
   * Why screening failed, from a short fictional controlled list such as
   * `Inclusion criterion not met`, or `null` unless the status is
   * `screen-failed` (#2879).
   */
  readonly screenFailureReason: string | null;
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

/**
 * A study's monitoring plan as CTMS holds it: how often each active site
 * gets an interim monitoring visit, how far a visit may slip, and how soon
 * its report must be final. The values are the plan's own decisions, not a
 * regulatory standard.
 */
export interface CtmsMonitoringPlan extends BronzeRecord {
  /** Monitoring plan id. */
  readonly monitoringPlanId: string;
  /** Study id. */
  readonly studyId: string;
  /** Plan version. */
  readonly version: string;
  /** ISO 8601 date the plan took effect. */
  readonly effectiveOn: string;
  /** Planned days from one monitoring visit at a site to the next interim visit. */
  readonly interimIntervalDays: number;
  /** Days an interim visit may fall after its planned date and still be on time. */
  readonly visitWindowDays: number;
  /** Days from a visit by which its report must be final. */
  readonly reportDueDays: number;
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

/**
 * One principal investigator assignment at one site, as CTMS holds it. The
 * feed comes from `siteStaffFeed`, not from `generatePortfolio`.
 */
export interface SiteStaffAssignment extends BronzeRecord {
  /** Assignment id. */
  readonly assignmentId: string;
  /** Study id. */
  readonly studyId: string;
  /** Site id. */
  readonly siteId: string;
  /** Staff role. Only principal investigators are tracked. */
  readonly role: "principal-investigator";
  /** Fictional investigator id. */
  readonly investigatorId: string;
  /** ISO 8601 first day in the role. */
  readonly startOn: string;
  /** ISO 8601 last day in the role, or `null` while still in it. */
  readonly endOn: string | null;
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
  /** Monitoring plans, one per study. */
  readonly monitoringPlans: readonly CtmsMonitoringPlan[];
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

/**
 * Data classification, from least to most protected. `restricted` is the
 * class for values only named roles may read, such as a randomised arm that
 * blinded staff must not see. Whether a product holds personal health data
 * is recorded separately, on `DataProduct.personalHealthData`.
 */
export type DataClassification =
  "public" | "internal" | "confidential" | "restricted";

/** Something that reads a data product. */
export interface DataProductConsumer {
  /** A downstream data product, or a governed metric. */
  readonly kind: "product" | "metric";
  /** Product id or metric id. */
  readonly id: string;
}

/** A governed data product: a dataset with an owner, a contract and consumers. */
export interface DataProduct {
  /**
   * Stable product id: the qualified table name for a warehouse table, for
   * example `silver.edc_subject`, or `STUDY_DATA_PRODUCT_ID`.
   */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Medallion layer the product is published in. */
  readonly layer: MedallionLayer;
  /** Business domain, for example `EDC` or `Operations mart`. */
  readonly domain: string;
  /** One sentence on what the product holds. */
  readonly description: string;
  /** Accountable business owner (a role, not a person). */
  readonly owner: string;
  /** Data steward (a role, not a person). */
  readonly steward: string;
  /** Highest classification of any column the product holds. */
  readonly classification: DataClassification;
  /**
   * Whether rows describe study subjects, which makes the product personal
   * health data however its columns are classified. The data here is
   * synthetic; the label is the one the real data would carry.
   */
  readonly personalHealthData: boolean;
  /** Id of the contract currently in force. */
  readonly contractId: string;
  /**
   * What the product is built from: other product ids, bronze feeds such as
   * `bronze.edc.subjects`, or the USDM study definition the Study Data
   * Pipeline reads, as `usdm.<study id>`.
   */
  readonly upstream: readonly string[];
  /** Known consumers: downstream products and governed metrics. */
  readonly consumers: readonly DataProductConsumer[];
}

/** Logical type of a contract column. */
export type ContractColumnType = WarehouseColumnType | "time";

/** One column a data contract guarantees. */
export interface ContractColumn {
  /** Column name. */
  readonly name: string;
  /** Logical type. */
  readonly type: ContractColumnType;
  /** Whether the column may hold `null`. A required column counts towards completeness. */
  readonly nullable: boolean;
  /** Business description. */
  readonly description: string;
  /** Data classification of the values. */
  readonly classification: DataClassification;
  /** Longest `string` value, in characters, or `null` for no limit. */
  readonly maxLength: number | null;
  /** Total digits of a `decimal` value, or `null` for no limit. */
  readonly precision: number | null;
  /** Digits after the decimal point of a `decimal` value, or `null` for no limit. */
  readonly scale: number | null;
  /**
   * Regular expression every `string` value matches, or `null`. SDTM dates
   * and times are ISO 8601 text that may be partial, so they are strings
   * with a pattern rather than dates.
   */
  readonly pattern: string | null;
}

/** One table or dataset a data contract covers. */
export interface ContractObject {
  /** Object name, for example `edc_subject` or `ADSL`. */
  readonly name: string;
  /**
   * Where the object is stored: a warehouse table such as
   * `silver.edc_subject`, or a Dataset-JSON file of the study data package.
   */
  readonly physicalName: string;
  /** One sentence on what the object holds. */
  readonly description: string;
  /** What one row stands for. */
  readonly grain: string;
  /** Columns that identify a row, in key order. */
  readonly primaryKey: readonly string[];
  /** Columns, in table order. */
  readonly columns: readonly ContractColumn[];
}

/** Service levels a data product promises. */
export interface DataContractSla {
  /** Oldest the latest load may be when the product is read, in hours. */
  readonly freshnessHours: number;
  /** Minimum share of required values present, from 0 to 1. */
  readonly completeness: number;
  /**
   * Share of time the product is available to read, from 0 to 1. A static
   * build has no uptime to measure, so the contract check confirms only that
   * the product was published.
   */
  readonly availability: number;
}

/** How long a data product is kept, and why. */
export interface DataRetention {
  /** Retention period, in years. */
  readonly years: number;
  /** What sets the period: a regulation, or a sponsor policy choice. */
  readonly basis: string;
  /** Whether a regulation sets the period, rather than a sponsor policy. */
  readonly regulatory: boolean;
}

/** A versioned data contract for one data product. */
export interface DataContract {
  /** Stable contract id. */
  readonly id: string;
  /** Id of the product the contract governs. */
  readonly productId: string;
  /**
   * Semantic version. A breaking change (a removed or retyped column, a
   * weaker service level) needs a major version bump, an additive one at
   * least a minor bump.
   */
  readonly version: string;
  /** Tables or datasets the contract covers. */
  readonly objects: readonly ContractObject[];
  /** Service levels the product promises. */
  readonly sla: DataContractSla;
  /** Retention period. */
  readonly retention: DataRetention;
}

/**
 * Level a metric's value is defined at. A `portfolio` metric aggregates every
 * row in scope, so it rolls up to one portfolio value and can be grouped by
 * any of its allowed dimensions. A `study` metric is computed once per study
 * and has no value above the study, so every query of it groups by `study`.
 */
export type MetricGrain = "portfolio" | "study";

/**
 * Lifecycle status of a governed metric. Only `certified` metrics may appear
 * in a certified report; a `deprecated` metric is kept for old consumers and
 * names no new use.
 */
export type MetricStatus = "draft" | "certified" | "deprecated";

/** A dimension a metric can be grouped or filtered by. */
export type MetricDimensionId =
  | "study"
  | "study_status"
  | "therapeutic_area"
  | "phase"
  | "product_type"
  | "operating_model"
  | "site"
  | "country"
  | "region"
  | "month"
  | "vendor"
  | "deviation_category"
  | "deviation_importance"
  | "queried_form"
  | "screen_failure_reason";

/** Aggregation a measure applies to its rows. `p90` is the 90th percentile. */
export type MetricAggregation =
  "count" | "count-distinct" | "sum" | "mean" | "median" | "p90";

/** Comparison operator in a measure's row predicate. */
export type MetricComparison = "=" | "<>" | ">" | ">=" | "<" | "<=";

/**
 * A value computed from one row of a measure's table. Dates are whole days;
 * a gold date key (`YYYYMMDD`) is turned into a date with `date-of-key`.
 */
export type MetricExpression =
  | {
      /** A column of the measure's table. */
      readonly kind: "column";
      /** Column name. */
      readonly column: string;
    }
  | {
      /** A constant. */
      readonly kind: "literal";
      /** Text, number or boolean value. */
      readonly value: string | number | boolean;
    }
  | {
      /** The date a `YYYYMMDD` date key column stands for. */
      readonly kind: "date-of-key";
      /** Date key column name. */
      readonly column: string;
    }
  | {
      /** The data cut: the last day the warehouse describes. */
      readonly kind: "data-cut";
    }
  | {
      /** Whole days from one date to another: `to` minus `from`. */
      readonly kind: "days-between";
      /** Start date. */
      readonly from: MetricExpression;
      /** End date. */
      readonly to: MetricExpression;
    };

/** A condition a row must meet to count towards a measure. */
export type MetricPredicate =
  | {
      /** Compares two expressions. A `null` operand never matches. */
      readonly kind: "compare";
      /** Left operand. */
      readonly left: MetricExpression;
      /** Operator. */
      readonly operator: MetricComparison;
      /** Right operand. */
      readonly right: MetricExpression;
    }
  | {
      /** Text column holds one of the listed values. */
      readonly kind: "in";
      /** Text column name. */
      readonly column: string;
      /** Allowed values; never empty. */
      readonly values: readonly string[];
    }
  | {
      /** Column is, or is not, `null`. */
      readonly kind: "null";
      /** Column name. */
      readonly column: string;
      /** `true` keeps rows where the column is `null`, `false` rows where it is not. */
      readonly isNull: boolean;
    };

/** One aggregation over the rows of one gold table. */
export interface MetricMeasure {
  /** Qualified gold table the rows come from, for example `gold.fct_query`. */
  readonly table: string;
  /** Aggregation. */
  readonly aggregation: MetricAggregation;
  /**
   * Value aggregated per row; `null` for `count`, a column for
   * `count-distinct`, a number for the other aggregations.
   */
  readonly expression: MetricExpression | null;
  /** Conditions every counted row meets, all of them (a logical AND). */
  readonly where: readonly MetricPredicate[];
  /**
   * Date key column that places a row in a calendar month for the `month`
   * dimension, or `null` when the measure has no meaningful month.
   */
  readonly timeKey: string | null;
}

/** How a metric is computed from the gold model. */
export type MetricFormula =
  | {
      /** One measure. */
      readonly kind: "simple";
      /** The measure. */
      readonly measure: MetricMeasure;
    }
  | {
      /**
       * `scale` times the numerator over the denominator, computed per group.
       * A zero denominator gives no value.
       */
      readonly kind: "ratio";
      /** Numerator. */
      readonly numerator: MetricMeasure;
      /** Denominator. */
      readonly denominator: MetricMeasure;
      /** Multiplier: 1 for a fraction, 100 for a rate per 100. */
      readonly scale: number;
    }
  | {
      /**
       * Whole days from one study milestone's actual date to another's, per
       * study, read from `gold.fct_milestone`. A study that has not reached
       * both milestones has no value.
       */
      readonly kind: "milestone-span";
      /** Milestone the span starts at. */
      readonly from: MilestoneKind;
      /** Milestone the span ends at. */
      readonly to: MilestoneKind;
    };

/** A dimension filter: keep rows whose dimension value is, or is not, listed. */
export interface MetricFilter {
  /** Dimension filtered on. */
  readonly dimension: MetricDimensionId;
  /** `in` keeps listed values, `not-in` drops them. */
  readonly operator: "in" | "not-in";
  /** Values; never empty. */
  readonly values: readonly string[];
}

/** How a metric's value is displayed. */
export interface MetricFormat {
  /**
   * `percent` values are fractions shown times 100 with a percent sign;
   * `currency` values are US dollars; `number` values are shown as they are.
   */
  readonly style: "number" | "percent" | "currency";
  /** Decimal places shown, from 0 to 4. */
  readonly decimals: number;
}

/** One entry in a metric's change log. */
export interface MetricChangeLogEntry {
  /** Version the change produced. */
  readonly version: string;
  /** ISO 8601 date of the change. */
  readonly date: string;
  /** What changed, in one sentence. */
  readonly summary: string;
}

/**
 * One governed metric of the semantic layer (ADR 0066). Defined once over the
 * gold star schema and compiled to every consumer: the TypeScript evaluator,
 * SQL for three dialects, dbt MetricFlow and Power BI TMDL. No dashboard
 * computes a metric itself.
 */
export interface MetricDefinition {
  /** Stable metric id in snake case, for example `screen_failure_rate`. */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** Business definition in one to three sentences. */
  readonly description: string;
  /** How the value is computed from the gold model. */
  readonly formula: MetricFormula;
  /** Level the value is defined at. */
  readonly grain: MetricGrain;
  /** Dimensions a query may group or filter by. */
  readonly allowedDimensions: readonly MetricDimensionId[];
  /**
   * Filters applied unless a query filters the same dimension, in which case
   * the query's filter replaces the default.
   */
  readonly defaultFilters: readonly MetricFilter[];
  /** Unit of the value, for example `days` or `queries per 100 visits`. */
  readonly unit: string;
  /** Display format. */
  readonly format: MetricFormat;
  /** Accountable owner (a role, not a person). */
  readonly owner: string;
  /** Data steward (a role, not a person). */
  readonly steward: string;
  /**
   * Semantic version. Changing what a certified metric computes needs a
   * major version bump; `checkMetricChange` enforces it.
   */
  readonly version: string;
  /** Lifecycle status. */
  readonly status: MetricStatus;
  /**
   * Key of the business glossary term (`CANONICAL_GLOSSARY` in
   * `lib/term-glossary.ts`) that defines what the metric counts, or `null`.
   * A certified metric must link one.
   */
  readonly glossaryTerm: string | null;
  /** Folder the metric is listed under in BI tools, for example `Enrollment`. */
  readonly displayFolder: string;
  /** Changes to the definition, oldest first; the last entry is the current version. */
  readonly changeLog: readonly MetricChangeLogEntry[];
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

/** Layer a warehouse table is published in. Bronze stays as received. */
export type WarehouseLayer = Exclude<MedallionLayer, "bronze">;

/** Logical column type, mapped to each SQL dialect and to Parquet. */
export type WarehouseColumnType =
  "string" | "integer" | "decimal" | "boolean" | "date" | "timestamp";

/** Role a table plays in the warehouse. */
export type WarehouseTableKind = "conformed" | "dimension" | "fact";

/** The column a foreign key points at. */
export interface WarehouseReference {
  /** Qualified table name, for example `gold.dim_site`. */
  readonly table: string;
  /** Referenced column: the target table's primary key. */
  readonly column: string;
}

/** One column of a warehouse table: the single source for DDL, exports and the ERD. */
export interface WarehouseColumn {
  /** Column name, in snake case. */
  readonly name: string;
  /** Logical type. */
  readonly type: WarehouseColumnType;
  /** Whether the column may hold `null`. */
  readonly nullable: boolean;
  /** Business description. */
  readonly description: string;
  /** Data classification of the values the column holds. */
  readonly classification: DataClassification;
  /** Maximum length of a `string` value, in characters; `null` for other types. */
  readonly length: number | null;
  /** Total digits of a `decimal` value; `null` for other types. */
  readonly precision: number | null;
  /** Digits after the decimal point of a `decimal` value; `null` for other types. */
  readonly scale: number | null;
  /** Foreign key target, or `null` when the column is not a foreign key. */
  readonly references: WarehouseReference | null;
  /**
   * Source columns, each as `layer.product.column`, for example
   * `bronze.edc.subjects.subjectId` or `silver.edc_visit.visit_date`.
   * Empty for generated columns such as surrogate keys.
   */
  readonly lineage: readonly string[];
  /** How the value is derived from its sources, for example `identity` or `cast`. */
  readonly transformation: string;
}

/** Slowly changing dimension type 2 settings of a dimension table. */
export interface Scd2Definition {
  /** Natural key column that identifies one member across its versions. */
  readonly naturalKey: string;
  /** Columns whose change opens a new version. */
  readonly trackedColumns: readonly string[];
  /** Column holding the version number, from 1. */
  readonly version: string;
  /** Column holding the first day a version is in force (inclusive). */
  readonly validFrom: string;
  /** Column holding the day the next version takes over (exclusive). */
  readonly validTo: string;
  /** Column flagging the latest version. */
  readonly isCurrent: string;
}

/** One warehouse table: silver conformed data, or a gold dimension or fact. */
export interface WarehouseTable {
  /** Layer, which is also the SQL schema name. */
  readonly layer: WarehouseLayer;
  /** Table name, unique across the warehouse. */
  readonly name: string;
  /** Role of the table. */
  readonly kind: WarehouseTableKind;
  /** One sentence on what the table holds. */
  readonly description: string;
  /** What one row stands for. */
  readonly grain: string;
  /** Primary key columns, which enforce the grain. */
  readonly primaryKey: readonly string[];
  /** Further unique column sets, such as a dimension's natural key. */
  readonly uniqueKeys: readonly (readonly string[])[];
  /** SCD type 2 settings, or `null` for a table that keeps no history. */
  readonly scd2: Scd2Definition | null;
  /**
   * Date columns whose stages are reached in order, such as a site's
   * start-up: a column holds a date only when the one before it does, on
   * or before it (#2880).
   */
  readonly sequences: readonly (readonly string[])[];
  /** Columns, in table order. */
  readonly columns: readonly WarehouseColumn[];
}

/** A value in a warehouse row. Dates and timestamps are ISO 8601 text. */
export type WarehouseValue = string | number | boolean | null;

/** One warehouse row, keyed by column name. */
export type WarehouseRow = Readonly<Record<string, WarehouseValue>>;

/** The silver and gold layers built from one portfolio. */
export interface Warehouse {
  /** Id of the portfolio the warehouse was built from. */
  readonly portfolioId: string;
  /** Seed of that portfolio. */
  readonly seed: number;
  /** ISO 8601 data cut. */
  readonly asOf: string;
  /** Rows per qualified table name (`silver.edc_subject`), in schema order. */
  readonly tables: Readonly<Record<string, readonly WarehouseRow[]>>;
}

/** SQL dialect a DDL emitter writes. */
export type SqlDialect = "duckdb" | "postgres" | "tsql";

/**
 * Certification tier of a report (#2625). `certified` reports use only
 * certified metrics and carry an owner's sign-off on their version;
 * `managed` reports are owned and maintained by a team; `exploratory`
 * reports are self-service and may use draft metrics. A tier is a
 * governance label inside this demonstration, not a regulatory
 * certification.
 */
export type ReportTier = "certified" | "managed" | "exploratory";

/**
 * How a report shows its numbers. Every visual also renders its data as a
 * table.
 *
 * - `bar`: one bar per value of the one grouped dimension, a bar per metric;
 * - `line`: one line per metric over `month`;
 * - `stat`: one number per metric, ungrouped;
 * - `table`: a table only, grouped by up to two dimensions.
 */
export type ReportVisual = "bar" | "line" | "stat" | "table";

/** An owner's sign-off on one version of a certified report. */
export interface ReportSignOff {
  /** Role that signed off (a role, not a person). */
  readonly role: string;
  /** ISO 8601 date of the sign-off. */
  readonly date: string;
  /** Report version signed off; must equal the report's version. */
  readonly version: string;
}

/**
 * A declarative report: what it shows and who it is for, as data. One
 * shared renderer draws every report, so no report computes a metric
 * itself; each value comes from the metric registry.
 */
export interface ReportSpec {
  /** Stable report id in kebab case, for example `study-status`. */
  readonly id: string;
  /** Display title. */
  readonly title: string;
  /** Who reads the report, for example `Study leadership`. */
  readonly audience: string;
  /** What decision the report supports, in one or two sentences. */
  readonly purpose: string;
  /** Certification tier. */
  readonly tier: ReportTier;
  /** Accountable owner (a role, not a person). */
  readonly owner: string;
  /** Semantic version of the spec. */
  readonly version: string;
  /** Ids of the registry metrics shown, in column order. */
  readonly metrics: readonly string[];
  /** Dimensions the metrics are grouped by, in row order. */
  readonly dimensions: readonly MetricDimensionId[];
  /** Filters applied to every metric, replacing each metric's default on the same dimension. */
  readonly filters: readonly MetricFilter[];
  /** How the numbers are shown. */
  readonly visual: ReportVisual;
  /** Maximum age of the data, in hours, before the report is stale. */
  readonly refreshSlaHours: number;
  /** Owner's sign-off; required for a certified report, otherwise `null`. */
  readonly signOff: ReportSignOff | null;
}

/** One metric column of a built report. */
export interface ReportColumn {
  /** Metric id. */
  readonly metricId: string;
  /** Metric name. */
  readonly name: string;
  /** Unit of the values. */
  readonly unit: string;
  /** Metric version the values were computed with. */
  readonly version: string;
  /** Metric status. */
  readonly status: MetricStatus;
}

/** One value of a built report. */
export interface ReportCell {
  /** Metric value; `null` when the metric has no value or no rows for the row. */
  readonly value: number | null;
  /** Value as displayed, with the metric's format. */
  readonly text: string;
}

/** One row of a built report: a group and one cell per metric. */
export interface ReportRow {
  /** Stable row key: the dimension values joined. */
  readonly key: string;
  /** Value of each grouped dimension, in the spec's dimension order. */
  readonly labels: readonly string[];
  /** One cell per metric, in the spec's metric order. */
  readonly cells: readonly ReportCell[];
}

/** How one metric in a report is calculated, for the "how this number is calculated" panel. */
export interface ReportCalculation {
  /** Metric id. */
  readonly metricId: string;
  /** Metric name. */
  readonly name: string;
  /** Metric version. */
  readonly version: string;
  /** Metric status. */
  readonly status: MetricStatus;
  /** Business definition. */
  readonly description: string;
  /** The formula in words. */
  readonly formula: string;
  /** DuckDB SQL that computes the metric with the report's grouping and filters. */
  readonly sql: string;
}

/** One gridline of a report's value axis. */
export interface ReportTick {
  /** Value the gridline marks. */
  readonly value: number;
  /** Label, with the metrics' format. */
  readonly text: string;
}

/**
 * The value axis of a bar or line report. Its metrics share one unit and
 * format, so one set of labels serves every series.
 */
export interface ReportScale {
  /** Bottom of the axis: 0, or the lowest tick below a negative value. */
  readonly min: number;
  /** Top of the axis: the highest tick. */
  readonly max: number;
  /** Gridlines from `min` to `max`, evenly spaced, with their labels. */
  readonly ticks: readonly ReportTick[];
}

/** A report evaluated over one warehouse, ready to render. */
export interface ReportData {
  /** The spec. */
  readonly spec: ReportSpec;
  /** ISO 8601 data cut of the warehouse. */
  readonly dataCut: string;
  /** Label of each grouped dimension, in order. */
  readonly dimensionLabels: readonly string[];
  /** One column per metric, in order. */
  readonly columns: readonly ReportColumn[];
  /** One row per group, sorted by dimension values. */
  readonly rows: readonly ReportRow[];
  /** How each metric is calculated, in column order. */
  readonly calculations: readonly ReportCalculation[];
  /** Value axis of a bar or line report; `null` for a stat or table report. */
  readonly scale: ReportScale | null;
}

/** Data quality dimension, after DAMA-DMBOK (#2636). */
export type DqDimension =
  | "completeness"
  | "validity"
  | "uniqueness"
  | "consistency"
  | "timeliness"
  | "accuracy";

/** Whether a rule met its threshold (#2636). */
export type DqStatus = "pass" | "warn" | "fail" | "not-applicable";

/** One rule's result over one warehouse and pipeline run (#2636). */
export interface DqRuleResult {
  readonly ruleId: string;
  /** Rows, or groups of rows for a reconciliation, the rule checked. */
  readonly checked: number;
  readonly failed: number;
  /** Share of checked rows that pass, or `null` when nothing was checked. */
  readonly passRate: number | null;
  /**
   * `pass` at or above the threshold, `fail` below it, `not-applicable` when
   * nothing was checked. An ingested rule takes the pipeline gate's status,
   * where `warn` is a finding to review rather than a defect.
   */
  readonly status: DqStatus;
  /** Keys of up to five failing rows, in key order. */
  readonly sample: readonly string[];
}

/** A score over a set of rules: a product, a dimension or the whole run (#2636). */
export interface DqScore {
  /** Product id, dimension, or `overall`. */
  readonly key: string;
  readonly label: string;
  /** Rules that checked something. */
  readonly rules: number;
  /** Of those, the rules that passed or warned. */
  readonly passing: number;
  /** Mean pass rate of those rules, from 0 to 1, or `null` when there are none. */
  readonly score: number | null;
}

/** Data quality results and scorecards at one data cut (#2636). */
export interface DqAssessment {
  /** ISO 8601 data cut. */
  readonly dataCut: string;
  /** One result per rule, in rule order. */
  readonly results: readonly DqRuleResult[];
  readonly overall: DqScore;
  /** Scores by data product, in product id order. */
  readonly byProduct: readonly DqScore[];
  /** Scores by dimension, in DAMA order. */
  readonly byDimension: readonly DqScore[];
}

/**
 * Where a node of the platform lineage graph sits (#2637): a warehouse
 * layer, a Study Data Pipeline layer, or a consumer of the semantic layer.
 */
export type LineageStage =
  | "collected"
  | "sdtm"
  | "adam"
  | "bronze"
  | "silver"
  | "gold"
  | "metric"
  | "measure"
  | "report";

/** One node of the platform lineage graph (#2637). */
export interface LineageNode {
  /** Stable id: the dataset and the field, joined by a dot. */
  readonly id: string;
  readonly stage: LineageStage;
  /**
   * Table, dataset or product: for example `silver.edc_visit`, `sdtm.DM`,
   * `bronze.edc.subjects`, `semantic.metrics`, `powerbi.governed_metrics`
   * or `reporting.reports`.
   */
  readonly dataset: string;
  /** Column, variable, metric id or report id within the dataset. */
  readonly field: string;
  /** Name a person reads: the column, the metric's name, the report's title. */
  readonly label: string;
  /** Data type of a column or variable, or `null` for a metric, measure or report. */
  readonly type: string | null;
  /** Derivation method of a study variable whose inputs the pipeline does not declare, or `null`. */
  readonly method: string | null;
  /** Roles accountable for the node, owner first, to notify of a change upstream. */
  readonly owners: readonly string[];
}

/** One edge of the platform lineage graph: `to` is computed from `from` (#2637). */
export interface LineageGraphEdge {
  readonly from: string;
  readonly to: string;
  /** How, for example `identity`, `date-shift`, `measure`, `filter` or `group-by`. */
  readonly transformation: string;
}

/** Column-level lineage from collected values to reports, as one graph (#2637). */
export interface PlatformLineage {
  /** Nodes in stage order, then by id. */
  readonly nodes: readonly LineageNode[];
  /** Edges sorted by target, then source. */
  readonly edges: readonly LineageGraphEdge[];
}
