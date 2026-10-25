/**
 * Clinical Data Platform: catalog, glossary, stewardship and data contract
 * types.
 */
import type {
  DataClassification,
  DataContractSla,
  DataProductConsumer,
  DataRetention,
  MedallionLayer,
  MetricStatus,
  WarehouseValue,
} from "./platform";

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

// --- Governance: catalog, glossary, stewardship and policies (#2638) ---

/** A stewardship domain: the part of the organisation that owns some data (#2638). */
export type GovernanceDomainId =
  | "clinical-data"
  | "clinical-operations"
  | "safety"
  | "finance"
  | "data-platform";

/** A stewardship domain and the roles that own and steward its data (#2638). */
export interface GovernanceDomain {
  readonly id: GovernanceDomainId;
  readonly name: string;
  /** What the domain's data describes, in one sentence. */
  readonly summary: string;
  /** Owner roles accountable for the domain's products and metrics. */
  readonly owners: readonly string[];
  /** Steward roles that look after their definitions and quality. */
  readonly stewards: readonly string[];
}

/** A stewardship role (#2638). */
export type StewardshipRoleId = "owner" | "steward" | "custodian" | "consumer";

/** What a stewardship role does, and who holds it here (#2638). */
export interface StewardshipRole {
  readonly id: StewardshipRoleId;
  readonly name: string;
  /** Who holds the role on this platform. */
  readonly heldBy: string;
  /** What the role is responsible for, one duty per sentence. */
  readonly duties: readonly string[];
}

/** A role's part in a decision: Responsible, Accountable, Consulted or Informed. */
export type RaciCode = "R" | "A" | "C" | "I";

/** A governance decision with a RACI (#2638). */
export type GovernanceDecisionId =
  "new-metric" | "contract-break" | "access-request" | "retention-change";

/** A governance policy (#2638). */
export type GovernancePolicyId =
  | "classification"
  | "retention"
  | "access"
  | "metric-certification"
  | "change-control";

/** A key governance decision and who does what in it (#2638). */
export interface GovernanceDecision {
  readonly id: GovernanceDecisionId;
  readonly name: string;
  /** When the decision is needed, in one sentence. */
  readonly when: string;
  /** Each role's part, or `null` for a role with none. */
  readonly raci: Readonly<Record<StewardshipRoleId, RaciCode | null>>;
  /** The policy the decision applies. */
  readonly policy: GovernancePolicyId;
}

/** One rule of a governance policy (#2638). */
export interface GovernancePolicyRule {
  /** The rule, in one or two sentences. */
  readonly text: string;
  /**
   * Name of the `@/lib/clinical-platform` export that applies the rule, a
   * check or the derivation that produces the governed value, or `null` for
   * a rule a person applies in review.
   */
  readonly appliedBy: string | null;
}

/** A governance policy, written as data so a page and a test read the same rules (#2638). */
export interface GovernancePolicy {
  readonly id: GovernancePolicyId;
  readonly title: string;
  /** What the policy is for, in one sentence. */
  readonly purpose: string;
  readonly rules: readonly GovernancePolicyRule[];
}

/** A broken rule of the stewardship model or the policies (#2638). */
export interface GovernanceFinding {
  readonly rule: "domain" | "raci" | "policy";
  /** What the finding is about: a role, a product, a metric, a decision or a policy. */
  readonly subject: string;
  readonly message: string;
}

/** A business glossary term and the governed metrics that use it (#2638). */
export interface BusinessGlossaryEntry {
  /** Key in `CANONICAL_GLOSSARY`. */
  readonly key: string;
  readonly term: string;
  readonly definition: string;
  /** Other names for the term. */
  readonly synonyms: readonly string[];
  /** The guideline or standard the definition follows, cited by reference, or `null`. */
  readonly source: string | null;
  /** Ids of the metrics that link the term, in registry order. */
  readonly metrics: readonly string[];
}

/**
 * Whether a data product met its contract at the last check: `unchecked`
 * when no contract results were supplied for it.
 */
export type CatalogSlaStatus = "met" | "missed" | "unchecked";

/** A data product as the data catalog lists it (#2638). */
export interface DataCatalogProduct {
  readonly kind: "product";
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly owner: string;
  readonly steward: string;
  readonly stewardshipDomain: GovernanceDomainId;
  readonly layer: MedallionLayer;
  /** Source system or mart, the product's own `domain`, for example `EDC` or `Operations mart`. */
  readonly sourceDomain: string;
  readonly classification: DataClassification;
  readonly personalHealthData: boolean;
  readonly contractId: string;
  readonly contractVersion: string;
  readonly sla: DataContractSla;
  readonly retention: DataRetention;
  readonly slaStatus: CatalogSlaStatus;
  /** Messages of the contract findings at the last check; empty when met or unchecked. */
  readonly slaFindings: readonly string[];
  /** Data quality score from 0 to 1, or `null` when no rule checked the product or no assessment was supplied. */
  readonly dqScore: number | null;
  /** Data quality rules that checked something in the product. */
  readonly dqRules: number;
  /** Datasets of the lineage graph the product publishes; empty when no graph was supplied. */
  readonly lineageDatasets: readonly string[];
  readonly upstream: readonly string[];
  readonly consumers: readonly DataProductConsumer[];
}

/** A governed metric as the data catalog lists it (#2638). */
export interface DataCatalogMetric {
  readonly kind: "metric";
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly owner: string;
  readonly steward: string;
  readonly stewardshipDomain: GovernanceDomainId;
  readonly status: MetricStatus;
  readonly version: string;
  readonly unit: string;
  /** The linked business glossary term, or `null`. */
  readonly glossaryTerm: { readonly key: string; readonly term: string } | null;
  /** Ids of the data products the formula reads. */
  readonly sources: readonly string[];
  /** Ids of the supplied reports that show the metric. */
  readonly reports: readonly string[];
  /** Id of the metric's node in the lineage graph, or `null` when no graph was supplied. */
  readonly lineageNode: string | null;
}

/** One entry of the data catalog: a data product or a governed metric (#2638). */
export type DataCatalogEntry = DataCatalogProduct | DataCatalogMetric;

/** A search of the data catalog (#2638). An absent or empty criterion matches every entry. */
export interface DataCatalogQuery {
  /** Words that must all appear in the entry's text, ignoring case. */
  readonly text?: string;
  readonly kinds?: readonly DataCatalogEntry["kind"][];
  readonly stewardshipDomains?: readonly GovernanceDomainId[];
  /** Product layers; set, it leaves metrics out. */
  readonly layers?: readonly MedallionLayer[];
  /** Product classifications; set, it leaves metrics out. */
  readonly classifications?: readonly DataClassification[];
  /** Product SLA statuses; set, it leaves metrics out. */
  readonly slaStatuses?: readonly CatalogSlaStatus[];
  /** Metric statuses; set, it leaves products out. */
  readonly metricStatuses?: readonly MetricStatus[];
}

/** How many catalog entries take one value of a facet (#2638). */
export interface CatalogFacetCount<T extends string> {
  readonly value: T;
  readonly count: number;
}

/**
 * Counts of catalog entries by each facet (#2638): every value of each facet
 * in its defined order, including values no entry takes.
 */
export interface DataCatalogFacets {
  readonly kinds: readonly CatalogFacetCount<DataCatalogEntry["kind"]>[];
  readonly stewardshipDomains: readonly CatalogFacetCount<GovernanceDomainId>[];
  readonly layers: readonly CatalogFacetCount<MedallionLayer>[];
  readonly classifications: readonly CatalogFacetCount<DataClassification>[];
  readonly slaStatuses: readonly CatalogFacetCount<CatalogSlaStatus>[];
  readonly metricStatuses: readonly CatalogFacetCount<MetricStatus>[];
}
