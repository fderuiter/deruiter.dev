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
