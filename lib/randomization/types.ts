/**
 * Public type contracts for the Clinical Study Studio randomization engine
 * (epic #3997, ticket #3998, ADR 0073).
 *
 * Pure, JSON-serializable, versioned contracts for BLOCK and MINIMIZATION
 * plans, explicit cap and block-rule scopes, actual-profile assignment
 * outcomes, immutable artifacts, resource preflight limits, and validation
 * findings. Private PRNG state and internal execution counters are excluded.
 */

/** Current version of the randomization contract surface. */
export const RANDOMIZATION_CONTRACT_VERSION = 1 as const;

/** Current version of serialized randomization plans. */
export const RANDOMIZATION_PLAN_SCHEMA_VERSION = 1 as const;

/** Current version of immutable randomization artifacts. */
export const RANDOMIZATION_ARTIFACT_SCHEMA_VERSION = 1 as const;

/** Schema domains checked by `isSupportedContractVersion`. */
export type ContractVersionDomain = "contract" | "plan" | "artifact";

/** Legacy host keyed FNV-1a / Mulberry32 allocator used by DEMO-301 and device runs. */
export const LEGACY_KEYED_ALGORITHM_ID =
  "host-keyed-fnv-mulberry32-v1" as const;

/** Opt-in MT19937 permuted-block allocator. */
export const MT19937_BLOCK_ALGORITHM_ID = "mt19937-block-v1" as const;

/** Opt-in MT19937 ratio-normalized minimization allocator. */
export const MT19937_MINIMIZATION_ALGORITHM_ID =
  "mt19937-minimization-v1" as const;

/** Supported opt-in randomization algorithm identifiers. */
export type OptInRandomizationAlgorithmId =
  typeof MT19937_BLOCK_ALGORITHM_ID | typeof MT19937_MINIMIZATION_ALGORITHM_ID;

/** All versioned randomization algorithm identifiers recognized by the host. */
export type RandomizationAlgorithmId =
  typeof LEGACY_KEYED_ALGORITHM_ID | OptInRandomizationAlgorithmId;

/** Compatibility metadata for a versioned randomization algorithm. */
export interface AlgorithmCompatibilityInfo {
  readonly id: RandomizationAlgorithmId;
  readonly method: "BLOCK" | "MINIMIZATION";
  readonly isLegacyDefault: boolean;
  readonly requiresExplicitOptIn: boolean;
  /**
   * Whether the same visible seed implies row-level assignment parity with
   * the legacy host keyed FNV/Mulberry32 allocator. Always `false` for MT19937.
   */
  readonly seedParityWithLegacy: boolean;
  readonly summary: string;
}

/** Preflight resource ceilings enforced before expanding designs or simulations. */
export interface RandomizationResourceLimits {
  readonly maxRows: number;
  readonly maxIntersections: number;
  readonly maxArms: number;
  readonly maxSites: number;
  readonly maxFactors: number;
  readonly maxLevelsPerFactor: number;
  readonly maxImportBytes: number;
  readonly maxImportNestingDepth: number;
  readonly maxSimulationRepetitions: number;
  readonly maxSimulationAggregateRows: number;
}

/** Documented default preflight resource limits (ticket #3998, ADR 0073). */
export const RANDOMIZATION_RESOURCE_LIMITS: RandomizationResourceLimits =
  Object.freeze({
    maxRows: 100_000,
    maxIntersections: 4_096,
    maxArms: 16,
    maxSites: 256,
    maxFactors: 16,
    maxLevelsPerFactor: 64,
    maxImportBytes: 8 * 1024 * 1024,
    maxImportNestingDepth: 64,
    maxSimulationRepetitions: 200,
    maxSimulationAggregateRows: 10_000_000,
  });

/** Ordered treatment arm specification with positive integer allocation ratio. */
export interface ArmSpec {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  /** Positive integer weight reduced by GCD before allocation. */
  readonly allocationRatio: number;
}

/** Ordered study site specification with saved recruitment weight. */
export interface SiteSpec {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  /** Positive finite recruitment weight; stored outside protocol USDM facts. */
  readonly recruitmentWeight: number;
}

/** Ordered level within a stratification factor. */
export interface FactorLevelSpec {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  /** Optional expected marginal proportion in (0, 1] for proportional caps or virtual cohorts. */
  readonly expectedProportion?: number;
}

/** Ordered stratification factor with ordered levels. */
export interface StratificationFactorSpec {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly levels: readonly FactorLevelSpec[];
}

/** Explicit enrollment cap scope shared by UI, engine, verifier, and code packagers. */
export type CapScope = "study-wide" | "per-site";

/** Supported cap strategies for permuted-block designs. */
export type BlockCapStrategy = "manual" | "proportional" | "marginal";

/** Supported cap strategies for minimization designs (proportional excluded). */
export type MinimizationCapStrategy = "manual" | "marginal";

/** All supported enrollment cap strategies. */
export type CapStrategy = BlockCapStrategy | MinimizationCapStrategy;

/** Explicit enrollment cap for one stratum intersection (optionally scoped to a site). */
export interface ManualIntersectionCap {
  readonly stratumKey: string;
  readonly siteId?: string;
  readonly cap: number;
}

/** Explicit marginal enrollment cap for one factor level (optionally scoped to a site). */
export interface MarginalLevelCap {
  readonly factorId: string;
  readonly levelId: string;
  readonly siteId?: string;
  readonly cap: number;
}

/** Proportional cap configuration for BLOCK designs. */
export interface ProportionalCapConfig {
  readonly strategy: "proportional";
  readonly capScope: CapScope;
  readonly totalEnrollment: number;
  /** Map of factorId to map of levelId to percentage (0..100). */
  readonly factorLevelPercentages: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
}

/** Manual intersection matrix cap configuration. */
export interface ManualCapConfig {
  readonly strategy: "manual";
  readonly capScope: CapScope;
  readonly intersectionCaps: readonly ManualIntersectionCap[];
}

/** Marginal cap configuration. */
export interface MarginalCapConfig {
  readonly strategy: "marginal";
  readonly capScope: CapScope;
  readonly levelCaps: readonly MarginalLevelCap[];
}

/** Cap configurations permitted for BLOCK designs. */
export type BlockCapConfig =
  ManualCapConfig | ProportionalCapConfig | MarginalCapConfig;

/** Cap configurations permitted for MINIMIZATION designs. */
export type MinimizationCapConfig = ManualCapConfig | MarginalCapConfig;

/** Scope over which block-size usage counters and sequences are tracked. */
export type BlockRuleTrackingScope = "global" | "per-site" | "per-intersection";

/** How block sizes are selected from the configured list. */
export type BlockSizeSelectionMode = "random-pool" | "fixed-sequence";

/**
 * Soft usage limit for a specific block size. When every configured size in
 * the pool reaches its soft limit, selection falls back to the original pool.
 */
export interface BlockSizeUsageLimit {
  readonly blockSize: number;
  readonly maxUses: number;
  readonly exhaustionPolicy: "fallback-to-original-pool";
}

/** Block-size rule applied globally or as a site/intersection override. */
export interface BlockSizeRule {
  readonly mode: BlockSizeSelectionMode;
  readonly sizes: readonly number[];
  readonly softUsageLimits?: readonly BlockSizeUsageLimit[];
}

/** Site-level override for block-size selection. */
export interface BlockSiteRuleOverride {
  readonly siteId: string;
  readonly rule: BlockSizeRule;
}

/** Stratum-intersection override for block-size selection. */
export interface BlockIntersectionRuleOverride {
  readonly stratumKey: string;
  readonly siteId?: string;
  readonly rule: BlockSizeRule;
}

/** Settings specific to permuted-block randomization. */
export interface BlockSettings {
  readonly defaultRule: BlockSizeRule;
  readonly trackingScope: BlockRuleTrackingScope;
  readonly siteOverrides?: readonly BlockSiteRuleOverride[];
  readonly intersectionOverrides?: readonly BlockIntersectionRuleOverride[];
  readonly allowPartialFinalBlock: boolean;
}

/** Settings specific to ratio-normalized minimization. */
export interface MinimizationSettings {
  readonly virtualCohortSize: number;
  /** Biased coin probability strictly greater than 0.5 and at most 1.0. */
  readonly biasedCoinProbability: number;
  /** Optional map of factorId to map of levelId to expected weight/proportion. */
  readonly expectedLevelDistributions?: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
}

/** Reproducible seed metadata carried on a randomization plan. */
export interface SeedConfig {
  readonly value: string;
  readonly source: "custom" | "generated";
}

/** Subject identifier formatting mask configuration. */
export interface SubjectIdMaskConfig {
  readonly pattern: string;
  readonly checksumAlgorithm?: "none" | "luhn-mod-n";
}

/** Host study and immutable workspace revision identity bound to a plan or artifact. */
export interface StudyProvenanceRef {
  readonly studyId: string;
  readonly studyVersionId: string;
  readonly studyDesignId: string;
  readonly workspaceRevisionId: string;
  readonly usdmSha256: string;
}

/** Shared fields across all versioned randomization requests. */
export interface RandomizationRequestBase {
  readonly contractVersion: typeof RANDOMIZATION_CONTRACT_VERSION;
  readonly planSchemaVersion: typeof RANDOMIZATION_PLAN_SCHEMA_VERSION;
  readonly id: string;
  readonly name: string;
  readonly provenance: StudyProvenanceRef;
  readonly arms: readonly ArmSpec[];
  readonly sites: readonly SiteSpec[];
  readonly factors: readonly StratificationFactorSpec[];
  readonly seed: SeedConfig;
  readonly subjectIdMask: SubjectIdMaskConfig;
  readonly enrollmentTarget: number;
}

/** Discriminated request for MT19937 permuted-block randomization. */
export interface BlockRandomizationRequest extends RandomizationRequestBase {
  readonly method: "BLOCK";
  readonly algorithmId: typeof MT19937_BLOCK_ALGORITHM_ID;
  readonly caps: BlockCapConfig;
  readonly blockSettings: BlockSettings;
  readonly minimizationSettings?: never;
}

/** Discriminated request for MT19937 ratio-normalized minimization. */
export interface MinimizationRandomizationRequest extends RandomizationRequestBase {
  readonly method: "MINIMIZATION";
  readonly algorithmId: typeof MT19937_MINIMIZATION_ALGORITHM_ID;
  readonly caps: MinimizationCapConfig;
  readonly minimizationSettings: MinimizationSettings;
  readonly blockSettings?: never;
}

/** Discriminated union of runnable opt-in randomization requests. */
export type RandomizationRequest =
  BlockRandomizationRequest | MinimizationRandomizationRequest;

/** Request envelope for generating a complete deterministic allocation schedule. */
export interface RandomizationScheduleRequest {
  readonly request: RandomizationRequest;
  readonly requestedAtIso?: string;
}

/** Actual eligible participant profile supplied at the study-data pipeline seam. */
export interface ParticipantProfile {
  readonly subjectId: string;
  readonly siteId: string;
  readonly stratumLevels: Readonly<Record<string, string>>;
}

/** Request to allocate one actual eligible participant profile. */
export interface ProfileAssignmentRequest {
  readonly plan: RandomizationRequest;
  readonly profile: ParticipantProfile;
  readonly allocationSequence: number;
}

/** Explicit outcome of assigning one actual participant profile. */
export type ProfileAssignmentOutcome =
  | {
      readonly status: "assigned";
      readonly allocationId: string;
      readonly slotIndex: number;
      readonly subjectId: string;
      readonly siteId: string;
      readonly stratumKey: string;
      readonly armId: string;
      readonly armCode: string;
    }
  | {
      readonly status: "cap-exhausted";
      readonly subjectId: string;
      readonly siteId: string;
      readonly stratumKey: string;
      readonly reason: string;
    }
  | {
      readonly status: "unmapped-site";
      readonly subjectId: string;
      readonly siteId: string;
    }
  | {
      readonly status: "unmapped-stratum";
      readonly subjectId: string;
      readonly siteId: string;
      readonly missingFactorIds: readonly string[];
    }
  | {
      readonly status: "unsupported-method";
      readonly subjectId: string;
      readonly method: string;
    };

/** One generated allocation row in an immutable schedule artifact. */
export interface AllocationRow {
  readonly sequence: number;
  readonly subjectId: string;
  readonly siteId: string;
  readonly stratumKey: string;
  readonly stratumLevels: Readonly<Record<string, string>>;
  readonly armId: string;
  readonly armCode: string;
  readonly blockIndex: number | null;
  readonly blockSize: number | null;
  readonly positionInBlock: number | null;
}

/** Cryptographic digest over the canonical audit payload of an artifact. */
export interface ArtifactDigest {
  readonly algorithm: "SHA-256";
  readonly hex: string;
  readonly canonicalPayloadVersion: typeof RANDOMIZATION_ARTIFACT_SCHEMA_VERSION;
}

/** Immutable provenance metadata recorded on every generated randomization artifact. */
export interface ArtifactProvenance {
  readonly contractVersion: typeof RANDOMIZATION_CONTRACT_VERSION;
  readonly planSchemaVersion: typeof RANDOMIZATION_PLAN_SCHEMA_VERSION;
  readonly artifactSchemaVersion: typeof RANDOMIZATION_ARTIFACT_SCHEMA_VERSION;
  readonly algorithmId: RandomizationAlgorithmId;
  readonly generatedAtIso: string;
  readonly study: StudyProvenanceRef;
}

/** Immutable, JSON-serializable randomization schedule artifact. */
export interface RandomizationArtifact {
  readonly provenance: ArtifactProvenance;
  readonly request: RandomizationRequest;
  readonly reducedRatios: readonly number[];
  readonly rows: readonly AllocationRow[];
  readonly digest: ArtifactDigest;
}

/** Severity level of a contract or preflight validation finding. */
export type ValidationSeverity = "error" | "warning";

/** Stable machine-readable validation finding codes. */
export type ValidationFindingCode =
  | "INVALID_PLAN_SHAPE"
  | "INVALID_PROVENANCE"
  | "INVALID_RESOURCE_METRIC"
  | "UNSUPPORTED_CONTRACT_VERSION"
  | "UNSUPPORTED_PLAN_SCHEMA_VERSION"
  | "UNKNOWN_METHOD"
  | "UNSUPPORTED_METHOD_COMBINATION"
  | "ALGORITHM_METHOD_MISMATCH"
  | "INVALID_ARM_LIST"
  | "INVALID_ARM_RATIO"
  | "DUPLICATE_IDENTIFIER"
  | "EMPTY_IDENTIFIER"
  | "INVALID_SITE_LIST"
  | "INVALID_SITE_WEIGHT"
  | "INVALID_FACTOR_LEVELS"
  | "INVALID_CAP_SCOPE"
  | "INVALID_CAP_STRATEGY"
  | "INVALID_BLOCK_SETTINGS"
  | "INVALID_MINIMIZATION_SETTINGS"
  | "INVALID_ENROLLMENT_TARGET"
  | "INVALID_SEED"
  | "INVALID_SUBJECT_ID_MASK"
  | "RESOURCE_LIMIT_EXCEEDED";

/** Structured validation finding with stable code and dotted field path. */
export interface ValidationFinding {
  readonly code: ValidationFindingCode;
  readonly severity: ValidationSeverity;
  readonly fieldPath: string;
  readonly message: string;
  readonly estimatedValue?: string;
  readonly limitValue?: string;
}

/** Result of validating and GCD-reducing arm allocation ratios. */
export type ReducedAllocationRatiosResult =
  | {
      readonly ok: true;
      readonly gcd: number;
      readonly ratios: readonly number[];
    }
  | {
      readonly ok: false;
      readonly findings: readonly ValidationFinding[];
    };

/** Input metrics checked by overflow-safe resource preflight before expansion. */
export interface ResourcePreflightInput {
  readonly rows?: number;
  readonly armCount?: number;
  readonly siteCount?: number;
  readonly factorLevelCounts?: readonly number[];
  readonly importBytes?: number;
  readonly importNestingDepth?: number;
  readonly simulationRepetitions?: number;
}

/** Outcome of overflow-safe resource preflight checks. */
export interface ResourcePreflightResult {
  readonly ok: boolean;
  /** Exact intersection count serialized as a base-10 integer string (overflow-safe). */
  readonly estimatedIntersections: string;
  /** Exact aggregate Monte Carlo row count serialized as a base-10 integer string. */
  readonly estimatedSimulationAggregateRows: string;
  readonly findings: readonly ValidationFinding[];
}

/** Outcome of validating an untrusted or JSON-imported randomization plan. */
export interface PlanValidationResult {
  readonly ok: boolean;
  readonly findings: readonly ValidationFinding[];
}
