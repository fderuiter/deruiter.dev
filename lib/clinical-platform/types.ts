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

/** How far a contract change reaches, from none to breaking. */
export type ContractChangeLevel = "none" | "patch" | "minor" | "major";

/** One difference between two versions of a data contract. */
export interface ContractDifference {
  /** The version bump the difference needs. */
  readonly level: Exclude<ContractChangeLevel, "none">;
  /** What changed, in one sentence. */
  readonly message: string;
}

/** A broken data product or contract rule. */
export interface DataContractFinding {
  /** Rule that failed. */
  readonly rule:
    | "registry"
    | "schema"
    | "completeness"
    | "freshness"
    | "availability"
    | "version";
  /** Product id. */
  readonly productId: string;
  /** Object the finding is about, or `null` for the whole product. */
  readonly object: string | null;
  /** What is wrong, in one sentence. */
  readonly message: string;
}

/** The rows of one contract object, as a contract check reads them. */
export interface ContractObjectRows {
  /** Column names present in the data, in order. */
  readonly columns: readonly string[];
  /** Rows, keyed by column name. */
  readonly rows: readonly Readonly<Record<string, WarehouseValue>>[];
}

/** Options for checking a dataset against its contract. */
export interface ContractCheckOptions {
  /** ISO 8601 timestamp the product was last loaded at. */
  readonly loadedAt: string;
  /** ISO 8601 timestamp the check runs at; defaults to `loadedAt`. */
  readonly evaluatedAt?: string;
}

/** The outcome of checking one data product against its contract. */
export interface DataContractResult {
  /** Product id. */
  readonly productId: string;
  /** Contract version checked against. */
  readonly version: string;
  /** Rows checked, across every object. */
  readonly rowCount: number;
  /** Hours from the latest load to the check. */
  readonly ageHours: number;
  /** Share of required values present, from 0 to 1; 1 when nothing is required. */
  readonly completeness: number;
  /** Whether every object was published. */
  readonly available: boolean;
  /** Every broken rule; empty when the product meets its contract. */
  readonly findings: readonly DataContractFinding[];
  /** Whether the product meets its contract. */
  readonly passed: boolean;
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
  | "vendor";

/** One dimension of the semantic layer: an attribute of a gold dimension table. */
export interface MetricDimension {
  /** Stable dimension id. */
  readonly id: MetricDimensionId;
  /** Display label. */
  readonly label: string;
  /** What the dimension's values are, in one sentence. */
  readonly description: string;
  /** Qualified gold table that holds the attribute, for example `gold.dim_study`. */
  readonly table: string;
  /** Attribute column in that table. */
  readonly column: string;
}

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
  /** Key of the business glossary term (`CANONICAL_GLOSSARY` in `lib/term-glossary.ts`), or `null`. */
  readonly glossaryTerm: string | null;
  /** Folder the metric is listed under in BI tools, for example `Enrollment`. */
  readonly displayFolder: string;
  /** Changes to the definition, oldest first; the last entry is the current version. */
  readonly changeLog: readonly MetricChangeLogEntry[];
}

/** A request for a metric's value, grouped and filtered. */
export interface MetricQuery {
  /** Dimensions to group by, in output order; empty or absent for one total. */
  readonly dimensions?: readonly MetricDimensionId[];
  /** Filters; each replaces the metric's default filter on the same dimension. */
  readonly filters?: readonly MetricFilter[];
}

/** One row of a metric result. */
export interface MetricResultRow {
  /** Value of each grouped dimension, keyed by dimension id. */
  readonly dimensions: Readonly<Partial<Record<MetricDimensionId, string>>>;
  /** Metric value, or `null` when it is undefined (for example a zero denominator). */
  readonly value: number | null;
}

/** A metric evaluated over one warehouse. */
export interface MetricResult {
  /** Metric id. */
  readonly metricId: string;
  /** Metric version. */
  readonly version: string;
  /** Grouped dimensions, in output order. */
  readonly dimensions: readonly MetricDimensionId[];
  /** Filters in force: the query's, then the defaults it did not replace. */
  readonly filters: readonly MetricFilter[];
  /** ISO 8601 data cut of the warehouse. */
  readonly dataCut: string;
  /** One row per group, sorted by dimension values. */
  readonly rows: readonly MetricResultRow[];
}

/** Options for the metric compilers. */
export interface MetricCompileOptions {
  /**
   * ISO 8601 data cut, written into metrics that measure age at the cut,
   * such as query aging. Required when a compiled metric uses it.
   */
  readonly dataCut?: string;
}

/**
 * The part of a metric definition that decides its values. Two releases of a
 * certified metric with different contracts need different major versions.
 */
export interface MetricContract {
  /** Formula. */
  readonly formula: MetricFormula;
  /** Grain. */
  readonly grain: MetricGrain;
  /** Unit. */
  readonly unit: string;
  /** Default filters. */
  readonly defaultFilters: readonly MetricFilter[];
  /** Allowed dimensions. Adding one is a minor change; removing one is breaking. */
  readonly allowedDimensions: readonly MetricDimensionId[];
}

/** One released version of a metric, as recorded in the registry lock file. */
export interface MetricRelease {
  /** Metric id. */
  readonly id: string;
  /** Semantic version. */
  readonly version: string;
  /** Status at release. */
  readonly status: MetricStatus;
  /** Contract at release. */
  readonly contract: MetricContract;
}

/** A report's use of governed metrics, as checked by `checkReportMetrics`. */
export interface MetricReport {
  /** Report id. */
  readonly id: string;
  /** Report title. */
  readonly title: string;
  /** Whether the report is certified. A certified report may only use certified metrics. */
  readonly certified: boolean;
  /** Ids of the metrics the report shows. */
  readonly metricIds: readonly string[];
}

/** A broken metric governance rule. */
export interface MetricFinding {
  /** Rule family: the definition itself, its versioning, or a report's use of it. */
  readonly rule: "definition" | "version" | "report";
  /** Metric the finding is about, or `null` for a registry-wide finding. */
  readonly metricId: string | null;
  /** What is wrong, in one sentence. */
  readonly message: string;
}

/**
 * A metric a clinical operations or portfolio lead would expect that the gold
 * model cannot compute yet, and what it lacks. Listed rather than faked.
 */
export interface MetricGap {
  /** Metric name. */
  readonly name: string;
  /** Why the registry leaves it out. */
  readonly reason: string;
  /** Gold data that would make it computable. */
  readonly missing: string;
  /** Registry metric that covers part of the need, or `null`. */
  readonly nearestMetricId: string | null;
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
  /** Columns, in table order. */
  readonly columns: readonly WarehouseColumn[];
}

/** The typed description of the silver and gold layers. */
export interface WarehouseSchema {
  /** Semantic version of the schema. */
  readonly version: string;
  /** Tables in creation order: silver, then gold dimensions, then gold facts. */
  readonly tables: readonly WarehouseTable[];
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

/** A broken warehouse invariant, reported by `checkWarehouse`. */
export interface WarehouseFinding {
  /** Invariant that failed. */
  readonly rule:
    | "table"
    | "column"
    | "type"
    | "nullability"
    | "length"
    | "grain"
    | "unique"
    | "foreign-key"
    | "scd2";
  /** Qualified table name. */
  readonly table: string;
  /** What is wrong, in one sentence. */
  readonly message: string;
}

/** One version of a slowly changing dimension member. */
export interface Scd2Version {
  /** Version number, from 1. */
  readonly version: number;
  /** ISO 8601 first day in force (inclusive). */
  readonly validFrom: string;
  /** ISO 8601 day the next version takes over (exclusive), or `SCD2_OPEN_END`. */
  readonly validTo: string;
  /** Whether this is the latest version. */
  readonly isCurrent: boolean;
  /** Tracked attribute values in force during the version. */
  readonly attributes: Readonly<Record<string, WarehouseValue>>;
}

/** A dated change to some tracked attributes of a dimension member. */
export interface Scd2Change {
  /** ISO 8601 day the change takes effect. */
  readonly effectiveOn: string;
  /** Attributes that change; the others keep their value. */
  readonly attributes: Readonly<Record<string, WarehouseValue>>;
}

/** One CSV file of a warehouse export. */
export interface WarehouseCsvFile {
  /** Relative path, for example `gold/dim_site.csv`. */
  readonly path: string;
  /** Qualified table name. */
  readonly table: string;
  /** Number of data rows, header excluded. */
  readonly rowCount: number;
  /** CSV text: a header row, RFC 4180 quoting, LF line ends; `null` is an empty unquoted field. */
  readonly text: string;
}

/** Parquet type a manifest column maps to. */
export interface ParquetColumnType {
  /** Parquet physical type. */
  readonly physicalType: "BYTE_ARRAY" | "INT32" | "INT64" | "BOOLEAN";
  /** Parquet logical type annotation, or `null` when there is none. */
  readonly logicalType: string | null;
  /** `REQUIRED` for a non-nullable column, otherwise `OPTIONAL`. */
  readonly repetition: "REQUIRED" | "OPTIONAL";
}

/** One column in an export manifest. */
export interface WarehouseManifestColumn {
  /** Column name. */
  readonly name: string;
  /** Logical type. */
  readonly type: WarehouseColumnType;
  /** Whether the column may hold `null`. */
  readonly nullable: boolean;
  /** Data classification. */
  readonly classification: DataClassification;
  /** Parquet type a writer should use. */
  readonly parquet: ParquetColumnType;
}

/** One table in an export manifest. */
export interface WarehouseManifestTable {
  /** Qualified table name. */
  readonly table: string;
  /** CSV path. */
  readonly path: string;
  /** Number of data rows. */
  readonly rowCount: number;
  /** Primary key columns. */
  readonly primaryKey: readonly string[];
  /** Columns, in file order. */
  readonly columns: readonly WarehouseManifestColumn[];
}

/** The column and type manifest shipped next to the CSV files. */
export interface WarehouseExportManifest {
  /** Synthetic data notice. */
  readonly notice: string;
  /** Warehouse schema version. */
  readonly schemaVersion: string;
  /** Portfolio id. */
  readonly portfolioId: string;
  /** ISO 8601 data cut. */
  readonly asOf: string;
  /** One entry per CSV file, in schema order. */
  readonly tables: readonly WarehouseManifestTable[];
}

/** CSV files and their manifest for one warehouse. */
export interface WarehouseExport {
  /** One CSV file per table, in schema order. */
  readonly files: readonly WarehouseCsvFile[];
  /** Column and type manifest. */
  readonly manifest: WarehouseExportManifest;
}

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
  "enrollment" | "activation" | "data-management" | "quality" | "milestones";

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
  /** Data products the numbers shown read, in id order. */
  readonly sources: readonly OperationsSource[];
}

/** Data quality dimension, after DAMA-DMBOK (#2636). */
export type DqDimension =
  | "completeness"
  | "validity"
  | "uniqueness"
  | "consistency"
  | "timeliness"
  | "accuracy";

/** How much a failing data quality rule matters (#2636). */
export type DqSeverity = "critical" | "major" | "minor";

/** One data quality rule over a data product (#2636). */
export interface DqRule {
  /** Stable id: `DQ-` and a dimension letter for platform rules, the conformance rule id for ingested ones. */
  readonly id: string;
  /** Data product the rule checks: a warehouse table, or the Study Data Pipeline. */
  readonly productId: string;
  /** Dataset within the product, for an ingested conformance rule; `null` otherwise. */
  readonly dataset: string | null;
  readonly dimension: DqDimension;
  /** What the rule asks, in a sentence. */
  readonly name: string;
  /** The check as a SQL-style predicate over the product's rows. */
  readonly expression: string;
  readonly severity: DqSeverity;
  /** Least share of checked rows that must pass, from 0 to 1. */
  readonly threshold: number;
  /** Data steward of the product, from its contract registration. */
  readonly owner: string;
  /** Why the rule exists. */
  readonly rationale: string;
  /** `platform` for rules written here, `conformance` for Study Data Pipeline rules ingested as they are. */
  readonly source: "platform" | "conformance";
  /** Published rule or guide the rule models, for ingested rules; `null` otherwise. */
  readonly citation: string | null;
}

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
 * A named defect of the kind real source feeds deliver, applied to a
 * warehouse to show which rules catch it (#2636).
 */
export interface DqScenario {
  /** Stable id, for example `finance-double-load`. */
  readonly id: string;
  readonly name: string;
  /** What went wrong at the source, in a sentence or two. */
  readonly story: string;
  /** Source system the defect arrives from. */
  readonly sourceSystem: string;
  /** Rules whose failing count the defect raises, in rule order. */
  readonly ruleIds: readonly string[];
}

/** Where a data quality issue is in its lifecycle (#2636). */
export type DqIssueStatus =
  "detected" | "assigned" | "root-cause" | "fixed" | "verified";

/** One entry in the append-only data quality issue log (#2636). */
export interface DqIssueEvent {
  /** Issue id, for example `DQI-001`. */
  readonly issueId: string;
  readonly status: DqIssueStatus;
  /** ISO 8601 date. */
  readonly on: string;
  /** Role that made the entry. */
  readonly actor: string;
  readonly note: string;
  /** Defect the issue records; set on the `detected` entry and `null` after it. */
  readonly scenarioId: string | null;
  /** Rules that raised the issue; set on the `detected` entry and empty after it. */
  readonly ruleIds: readonly string[];
}

/** A data quality issue as its log entries leave it (#2636). */
export interface DqIssue {
  readonly issueId: string;
  readonly scenarioId: string;
  readonly ruleIds: readonly string[];
  /** Status of the latest entry. */
  readonly status: DqIssueStatus;
  /** ISO 8601 date the issue was detected. */
  readonly detectedOn: string;
  /** ISO 8601 date the fix landed, or `null` while the defect is in the data. */
  readonly fixedOn: string | null;
  /** The issue's log entries, oldest first. */
  readonly history: readonly DqIssueEvent[];
}

/** The data quality scorecard as it read at the end of one week (#2636). */
export interface DqTrendPoint {
  /** ISO 8601 date the week ends. */
  readonly weekEnding: string;
  readonly overall: DqScore;
  /** Scores by dimension, in DAMA order. */
  readonly byDimension: readonly DqScore[];
  /** Rules that failed that week, in rule order. */
  readonly failingRuleIds: readonly string[];
  /** Issues whose defect was in the data that week, in id order. */
  readonly openIssueIds: readonly string[];
}

/**
 * A gamma distribution of recruitment rates, in subjects per site-day:
 * shape α and rate β, with mean α / β (#2632).
 */
export interface RecruitmentRate {
  readonly shape: number;
  readonly rate: number;
}

/** One recruiting site at the data cut, with its posterior rate (#2632). */
export interface SiteRecruitment {
  readonly siteId: string;
  readonly countryCode: string;
  /** Subjects enrolled at the site up to the data cut. */
  readonly enrolled: number;
  /** Days from the site's activation to the data cut. */
  readonly exposureDays: number;
  /** The site's rate given the study's prior and its own enrollment. */
  readonly posterior: RecruitmentRate;
}

/** Sites to add in a what-if, all activating on the same day (#2632). */
export interface EnrollmentWhatIf {
  /** ISO 3166-1 alpha-2 country the sites open in. */
  readonly countryCode: string;
  /** How many sites to add, from 1 to 50. */
  readonly sites: number;
  /** Days from the data cut until the new sites start recruiting, from 0 to 365. */
  readonly activationDelayDays: number;
}

/** A recruitment process to simulate: the input of `simulateEnrollmentCompletion` (#2632). */
export interface EnrollmentSimulationInput {
  /** Subjects still to enroll, 1 or more. */
  readonly remaining: number;
  /** Rates of the sites recruiting from day 0. */
  readonly sites: readonly RecruitmentRate[];
  /** Rates of sites that start recruiting later, with their first day. */
  readonly laterSites: readonly (RecruitmentRate & {
    readonly startDay: number;
  })[];
  /** Number of simulated runs, from 100 to 20,000. */
  readonly runs: number;
  /** Key of the random stream; the same key gives the same runs. */
  readonly streamKey: string;
}

/** Share of runs that have enrolled the last subject by a date (#2632). */
export interface EnrollmentForecastPoint {
  /** ISO 8601 date. */
  readonly on: string;
  /** Share of runs complete by that date, from 0 to 1. */
  readonly completed: number;
}

/** A Monte Carlo enrollment forecast for one study at a data cut (#2632). */
export interface EnrollmentForecast {
  readonly studyId: string;
  /** ISO 8601 data cut of the warehouse. */
  readonly dataCut: string;
  /** Enrollment target of the study. */
  readonly target: number;
  /** Subjects enrolled up to the data cut. */
  readonly enrolled: number;
  /** ISO 8601 planned last-subject-in date, from the study's milestones. */
  readonly plannedLastSubjectIn: string;
  /** The study's prior, fitted to its sites by maximum likelihood. */
  readonly prior: RecruitmentRate;
  /** Recruiting sites at the data cut, in id order. */
  readonly sites: readonly SiteRecruitment[];
  /** The what-if applied, or `null` for the baseline. */
  readonly whatIf: EnrollmentWhatIf | null;
  /** Rate a new site in the what-if's country recruits at, or `null` without a what-if. */
  readonly whatIfSiteRate: RecruitmentRate | null;
  readonly runs: number;
  readonly seed: number;
  /** Share of runs that enroll the last subject on or before the planned date. */
  readonly probabilityByPlan: number;
  /** ISO 8601 dates by which 10%, 50% and 90% of runs are complete. */
  readonly quantiles: {
    readonly p10: string;
    readonly p50: string;
    readonly p90: string;
  };
  /** Share of runs complete by each week from the data cut until 99% are. */
  readonly curve: readonly EnrollmentForecastPoint[];
}

/** Status of a key risk indicator at a site. */
export type KriStatus = "green" | "amber" | "red" | "insufficient-data";

/**
 * A key risk indicator (#2631): a governed registry metric evaluated per
 * site, with the thresholds at which it turns amber and red and why.
 */
export interface KriDefinition {
  /** KRI id, for example `kri-entry-lag`. */
  readonly id: string;
  readonly name: string;
  /** The registry metric the KRI evaluates per site. */
  readonly metricId: string;
  /** `high` when a high value is the risk, `low` when a low value is. */
  readonly direction: "high" | "low";
  /** Value at which the KRI turns amber, in the metric's unit. */
  readonly amber: number;
  /** Value at which the KRI turns red, in the metric's unit. */
  readonly red: number;
  /** Why these thresholds. */
  readonly reason: string;
  /**
   * The count metric and value below which the site has too little data to
   * assess, for example 3 enrolled subjects.
   */
  readonly minimum: { readonly metricId: string; readonly value: number };
}

/**
 * A quality tolerance limit (ICH E6(R3)): a study-level limit on a
 * registry metric whose breach calls for the response planned in advance.
 */
export interface QtlDefinition {
  /** QTL id, for example `qtl-early-termination`. */
  readonly id: string;
  readonly name: string;
  /** The registry metric the QTL evaluates per study. */
  readonly metricId: string;
  /** What the parameter stands for, and why it matters to the study's results. */
  readonly rationale: string;
  /** The response planned before any breach. */
  readonly response: string;
}

/** A QTL as a study's quality plan sets it. */
export interface QualityPlanQtl {
  readonly qtlId: string;
  /** Breached above this value, in the metric's unit. */
  readonly limit: number;
  /** Warning above this value: the secondary limit that triggers review before a breach. */
  readonly secondaryLimit: number;
}

/** A critical-to-quality factor (ICH E8(R1)) and how the plan watches it. */
export interface CriticalToQualityFactor {
  readonly id: string;
  readonly name: string;
  /** What could go wrong and what it would do to subjects or results. */
  readonly risk: string;
  /** KRIs that watch the factor. */
  readonly kriIds: readonly string[];
  /** QTLs that bound the factor. */
  readonly qtlIds: readonly string[];
  /** What the platform cannot watch yet, with the issue that adds it; `null` when nothing is missing. */
  readonly gap: { readonly reason: string; readonly issue: number } | null;
}

/** A study's quality plan: its critical-to-quality factors and QTL limits. */
export interface QualityPlan {
  readonly studyId: string;
  readonly version: string;
  /** ISO 8601 date the plan took effect. */
  readonly effectiveOn: string;
  readonly factors: readonly CriticalToQualityFactor[];
  readonly qtls: readonly QualityPlanQtl[];
  /** Synthetic plan for a fictional study. */
  readonly synthetic: true;
}

/** One KRI at one site. */
export interface KriAssessment {
  readonly kriId: string;
  readonly siteId: string;
  /** Metric value; `null` when the metric has no value for the site. */
  readonly value: number | null;
  readonly status: KriStatus;
}

/** Status of a QTL for a study. */
export type QtlStatus = "within" | "warning" | "breached" | "no-data";

/** One QTL for one study. */
export interface QtlAssessment {
  readonly qtlId: string;
  readonly value: number | null;
  readonly limit: number;
  readonly secondaryLimit: number;
  readonly status: QtlStatus;
}

/** A central statistical monitoring test (#2631). */
export interface CsmTestDefinition {
  /** Test id, for example `csm-query-under-reporting`. */
  readonly id: string;
  readonly name: string;
  /** What the test asks of the site against its peers, in one sentence. */
  readonly question: string;
  /** The statistic and its reference distribution. */
  readonly method: string;
  /** Gold tables and columns it reads. */
  readonly reads: readonly string[];
}

/** One test at one site. */
export interface CsmResult {
  readonly testId: string;
  readonly siteId: string;
  /** Observations at the site the test used. */
  readonly n: number;
  /** Test statistic. */
  readonly statistic: number;
  /** One-sided p-value. */
  readonly pValue: number;
  /** Benjamini-Hochberg adjusted p-value across the study's tests. */
  readonly qValue: number;
  /** Whether the q-value is at most the configured false discovery rate. */
  readonly flagged: boolean;
  /** The site's value and its peers', in plain words. */
  readonly detail: string;
}

/** A site or test the study's central monitoring could not assess, and why. */
export interface CsmExclusion {
  readonly siteId: string | null;
  readonly testId: string | null;
  readonly reason: string;
}

/** Central statistical monitoring of one study's sites. */
export interface CsmRun {
  /** False discovery rate the tests are controlled at. */
  readonly fdr: number;
  /** Sites with enough data, in id order. */
  readonly sites: readonly string[];
  readonly results: readonly CsmResult[];
  readonly excluded: readonly CsmExclusion[];
}

/** Where a risk signal came from. */
export type RiskSignalSource =
  | { readonly kind: "kri"; readonly kriId: string; readonly siteId: string }
  | { readonly kind: "qtl"; readonly qtlId: string }
  | {
      readonly kind: "csm";
      readonly siteId: string;
      readonly testIds: readonly string[];
    };

/** An action a signal can lead to. */
export type RiskSignalAction =
  "targeted-sdv" | "site-retraining" | "site-audit" | "for-cause-visit";

/** A step in a risk signal's workflow. */
export type RiskSignalEvent = "raised" | "assessed" | "actioned" | "closed";

/** One entry of a study's append-only risk signal log. */
export interface RiskSignalLogEntry {
  /** Position in the log, from 1, with no gaps. */
  readonly sequence: number;
  /** Signal id, for example `DEMO-302-SIG-001`. */
  readonly signalId: string;
  readonly event: RiskSignalEvent;
  /** ISO 8601 date of the event. */
  readonly on: string;
  /** Who recorded it: a role, or the automated central monitoring. */
  readonly by: string;
  /** What was found, decided or done. */
  readonly note: string;
  /** Where the signal came from; on `raised` entries only, otherwise `null`. */
  readonly source: RiskSignalSource | null;
  /** The action taken; on `actioned` entries only, otherwise `null`. */
  readonly action: RiskSignalAction | null;
}

/** A finding about a risk signal log that breaks its rules. */
export interface RiskSignalLogFinding {
  readonly sequence: number;
  readonly message: string;
}

/** Risk-based quality management for one study at one data cut. */
export interface StudyRiskAssessment {
  readonly studyId: string;
  /** ISO 8601 data cut of the warehouse. */
  readonly dataCut: string;
  readonly plan: QualityPlan;
  /** Every KRI at every activated site, by site id then KRI order. */
  readonly kris: readonly KriAssessment[];
  readonly qtls: readonly QtlAssessment[];
  readonly csm: CsmRun;
  /** Signals raised at the data cut: red KRIs, QTL warnings and breaches, flagged sites. */
  readonly log: readonly RiskSignalLogEntry[];
}
