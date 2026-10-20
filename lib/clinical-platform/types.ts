/**
 * Clinical Data Platform: public type contracts.
 *
 * One synthetic sponsor portfolio is modelled in three medallion layers,
 * governed as data products with versioned contracts, and served to every
 * consumer through one semantic layer of metric definitions (ADR 0066).
 */

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

/** One investigator site in one study. */
export interface Site {
  /** Stable site id, unique within the portfolio. */
  readonly id: string;
  /** Id of the study the site belongs to. */
  readonly studyId: string;
  /** ISO 3166-1 alpha-2 country code. */
  readonly country: string;
  /** Fictional site name. */
  readonly name: string;
  /** Enrollment target for this site. */
  readonly plannedEnrollment: number;
  /** ISO 8601 activation date, or `null` before activation. */
  readonly activatedOn: string | null;
}

/** One study in the portfolio. */
export interface Study {
  /** Stable protocol id, for example `DEMO-301`. */
  readonly id: string;
  /** Short title. */
  readonly title: string;
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
  /** Lifecycle status. */
  readonly status: StudyStatus;
  /** Enrollment target across all sites. */
  readonly plannedEnrollment: number;
  /**
   * Id of the Study Data Pipeline data product that supplies this study's
   * SDTM and ADaM (ADR 0065), or `null` when the study has none.
   */
  readonly studyDataProductId: string | null;
}

/** A fictional vendor: CRO, EDC, IRT, CTMS, eTMF or central lab provider. */
export interface Vendor {
  /** Stable vendor id. */
  readonly id: string;
  /** Fictional name. Never the name of a real company. */
  readonly name: string;
  /** Service the vendor provides. */
  readonly service: "CRO" | "EDC" | "IRT" | "CTMS" | "eTMF" | "Central lab";
}

/** One synthetic sponsor portfolio: studies, their sites and vendors. */
export interface Portfolio {
  /** Stable portfolio id. */
  readonly id: string;
  /** Fictional sponsor name. */
  readonly sponsor: string;
  /** Seed the portfolio was generated from. */
  readonly seed: number;
  /** Studies in the portfolio. */
  readonly studies: readonly Study[];
  /** Sites across all studies. */
  readonly sites: readonly Site[];
  /** Fictional vendors the studies use. */
  readonly vendors: readonly Vendor[];
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
