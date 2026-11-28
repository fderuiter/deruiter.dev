import type { CanonicalCrfDocument } from "../../types";

/**
 * Identifiers for declarative conformance rule packs.
 */
export type ConformancePackId = "ast" | "formula" | "soa" | "cdash-ig-2.2";

/**
 * Standardized conformance severity across all Studio, CLI, and review surfaces.
 */
export type ConformanceSeverity = "error" | "warning" | "info";

/**
 * Supported deterministic 1-click auto-fix remediation actions.
 */
export type ConformanceAutoFixType =
  | "truncate_variable"
  | "add_core_variable"
  | "assign_nci_codelist"
  | "fix_date_format"
  | "assign_visit_form";

/**
 * Scope at which a conformance evaluation runs (`"study"` includes SoA and
 * cross-visit checks; `"form"` scopes evaluation to a single form without
 * study-level orphan checks).
 */
export type ConformanceEvaluationScope = "study" | "form";

/**
 * Evaluation context passed to every declarative rule in a `ConformanceRulePack`.
 */
export interface ConformanceEvaluationContext {
  readonly document: CanonicalCrfDocument;
  readonly scope: ConformanceEvaluationScope;
  readonly targetFormId?: string;
}

/**
 * Normalized conformance finding emitted by a rule pack and projected into
 * `validateProtocol`, `validateStudyCompliance`, `StudyAuditor`, and `lintForm`.
 */
export interface ConformanceFinding {
  readonly id: string;
  readonly packId: ConformancePackId;
  readonly packVersion: string;
  readonly tier: "ast" | "cdash" | "soa" | "health";
  readonly ruleId: string;
  readonly legacyEngineRule: string;
  readonly ruleDescription: string;
  readonly severity: ConformanceSeverity;
  readonly formId: string;
  readonly formName: string;
  readonly formDomain: string;
  readonly location: string;
  readonly lintFormDiagnosticId?: string;
  readonly fieldId?: string;
  readonly variableName?: string;
  readonly message: string;
  readonly autoFixAvailable: boolean;
  readonly autoFixType?: ConformanceAutoFixType;
  readonly suggestedFix?: string;
}

/**
 * Declarative conformance rule definition within a versioned `ConformanceRulePack`.
 */
export interface DeclarativeRuleDefinition {
  readonly ruleId: string;
  readonly description: string;
  readonly defaultSeverity: ConformanceSeverity;
  readonly tier: "ast" | "cdash" | "soa" | "health";
  evaluate(ctx: ConformanceEvaluationContext): readonly ConformanceFinding[];
}

/**
 * Versioned declarative conformance rule pack operating on `CanonicalCrfDocument`.
 */
export interface ConformanceRulePack {
  readonly id: ConformancePackId;
  readonly name: string;
  readonly version: string;
  readonly standardCitation?: string;
  readonly rules: readonly DeclarativeRuleDefinition[];
}

/**
 * Active-domain health and conformance summary computed alongside rule packs.
 */
export interface ConformanceHealthSummary {
  readonly totalFields: number;
  readonly mandatoryFields: number;
  readonly codelistsAttached: number;
  readonly calculatedFields: number;
  readonly conditionalRules: number;
  readonly sdvVerifiedCount: number;
  readonly sdvReadinessPercentage: number;
  readonly cdashConformancePercentage: number;
  readonly missingCoreVariables: string[];
}

/**
 * Complete evaluation result produced by `evaluateStudyConformance`.
 */
export interface ConformanceEvaluationResult {
  readonly document: CanonicalCrfDocument;
  readonly findings: readonly ConformanceFinding[];
  readonly health: ConformanceHealthSummary;
  readonly isCompliant: boolean;
  readonly score: number;
  readonly summary: {
    readonly errors: number;
    readonly warnings: number;
    readonly infos: number;
    readonly fixable: number;
  };
}
