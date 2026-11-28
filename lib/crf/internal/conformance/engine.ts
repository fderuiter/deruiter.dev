import { clamp } from "@/lib/game-utils";
import type { CanonicalCrfDocument, CRFForm, StudyProtocol } from "../../types";
import { CDASH_STANDARD_VARIABLES } from "../cdisc-cdash-library";
import { toCanonicalCrfDocument } from "../codecs/canonical-document";
import { AST_CONFORMANCE_PACK } from "./packs/ast-pack";
import { CDASH_IG_2_2_CONFORMANCE_PACK } from "./packs/cdash-ig-2-2-pack";
import { FORMULA_CONFORMANCE_PACK } from "./packs/formula-pack";
import { SOA_CONFORMANCE_PACK } from "./packs/soa-pack";
import type {
  ConformanceEvaluationContext,
  ConformanceEvaluationResult,
  ConformanceEvaluationScope,
  ConformanceFinding,
  ConformanceHealthSummary,
  ConformancePackId,
  ConformanceRulePack,
} from "./types";

/**
 * Default ordered suite of declarative conformance rule packs.
 */
export const DEFAULT_CONFORMANCE_RULE_PACKS: readonly ConformanceRulePack[] = [
  AST_CONFORMANCE_PACK,
  FORMULA_CONFORMANCE_PACK,
  SOA_CONFORMANCE_PACK,
  CDASH_IG_2_2_CONFORMANCE_PACK,
];

export interface EvaluateConformanceOptions {
  readonly scope?: ConformanceEvaluationScope;
  readonly targetFormId?: string;
  readonly packIds?: readonly ConformancePackId[];
  readonly packs?: readonly ConformanceRulePack[];
}

function isCanonicalDocument(
  input: CanonicalCrfDocument | StudyProtocol
): input is CanonicalCrfDocument {
  return (
    Boolean(input) &&
    typeof input === "object" &&
    "kind" in input &&
    input.kind === "CanonicalCrfDocument" &&
    "indexes" in input
  );
}

function buildPermissiveCanonicalForLint(
  input: CanonicalCrfDocument | StudyProtocol
): CanonicalCrfDocument {
  if (isCanonicalDocument(input)) {
    return input;
  }
  const safeStudy: StudyProtocol = {
    id: input?.id || "study_lint",
    protocolNumber: input?.protocolNumber || input?.protocolId || "LINT-001",
    studyName: input?.studyName || "Protocol Conformance Context",
    phase: input?.phase || "Phase III",
    sponsor: input?.sponsor || "Sponsor",
    therapeuticArea: input?.therapeuticArea || "General",
    version: input?.version || "1.0",
    lastModified: input?.lastModified || "1970-01-01T00:00:00.000Z",
    forms: Array.isArray(input?.forms) ? input.forms : [],
    visits: Array.isArray(input?.visits) ? input.visits : [],
    codelists: Array.isArray(input?.codelists) ? input.codelists : [],
    ...(input?.rules ? { rules: input.rules } : {}),
  };
  return toCanonicalCrfDocument(safeStudy, { mode: "storage" });
}

/**
 * Computes active-domain health and CDASH conformance percentages across the
 * specified forms. Only active standard CDASH domains present in `forms`
 * contribute to the core-variable denominator.
 */
export function computeConformanceHealthSummary(
  forms: readonly CRFForm[]
): ConformanceHealthSummary {
  let totalFields = 0;
  let mandatoryFields = 0;
  let codelistsAttached = 0;
  let calculatedFields = 0;
  let conditionalRules = 0;
  let sdvVerifiedCount = 0;

  let totalExpectedActiveCore = 0;
  let missingActiveCoreCount = 0;
  const missingCoreVariables = new Set<string>();

  for (const form of forms) {
    conditionalRules += (form.rules || []).length;
    const presentVars = new Set<string>();

    for (const section of form.sections || []) {
      for (const field of section.fields || []) {
        totalFields++;
        if (field.required) mandatoryFields++;
        if (
          field.codelistId ||
          (field.customOptions && field.customOptions.length > 0)
        ) {
          codelistsAttached++;
        }
        if (field.dataType === "calculated" || field.calculationFormula) {
          calculatedFields++;
        }
        if (field.sdvVerified) sdvVerifiedCount++;
        const upperVar = (field.variableName || "").trim().toUpperCase();
        if (upperVar) presentVars.add(upperVar);
      }
    }

    const domainUpper = (form.domain || "").trim().toUpperCase();
    const standardVars = CDASH_STANDARD_VARIABLES[domainUpper];
    if (standardVars && standardVars.length > 0) {
      const coreVars = standardVars.filter(
        (v) => v.core === "R" || v.core === "HR"
      );
      totalExpectedActiveCore += coreVars.length;
      for (const coreVar of coreVars) {
        if (!presentVars.has(coreVar.sdtmVariable.toUpperCase())) {
          missingActiveCoreCount++;
          missingCoreVariables.add(`${domainUpper}.${coreVar.sdtmVariable}`);
        }
      }
    }
  }

  const sdvReadinessPercentage =
    totalFields > 0 ? Math.round((sdvVerifiedCount / totalFields) * 100) : 0;

  const cdashConformancePercentage =
    totalExpectedActiveCore > 0
      ? clamp(
          Math.round(
            ((totalExpectedActiveCore - missingActiveCoreCount) /
              totalExpectedActiveCore) *
              100
          ),
          0,
          100
        )
      : 100;

  return {
    totalFields,
    mandatoryFields,
    codelistsAttached,
    calculatedFields,
    conditionalRules,
    sdvVerifiedCount,
    sdvReadinessPercentage,
    cdashConformancePercentage,
    missingCoreVariables: Array.from(missingCoreVariables),
  };
}

/**
 * Evaluates declarative conformance rule packs once against an indexed
 * `CanonicalCrfDocument` (without cloning `StudyProtocol` references).
 */
export function evaluateStudyConformance(
  input: CanonicalCrfDocument | StudyProtocol,
  options: EvaluateConformanceOptions = {}
): ConformanceEvaluationResult {
  const document = buildPermissiveCanonicalForLint(input);
  const scope: ConformanceEvaluationScope = options.scope || "study";
  const packs = options.packs || DEFAULT_CONFORMANCE_RULE_PACKS;
  const packFilter = options.packIds ? new Set(options.packIds) : null;

  const ctx: ConformanceEvaluationContext = {
    document,
    scope,
    targetFormId: options.targetFormId,
  };

  const findings: ConformanceFinding[] = [];
  for (const pack of packs) {
    if (packFilter && !packFilter.has(pack.id)) continue;
    for (const rule of pack.rules) {
      findings.push(...rule.evaluate(ctx));
    }
  }

  const evaluatedForms: CRFForm[] =
    scope === "form" && options.targetFormId
      ? [document.forms.byId[options.targetFormId]?.form].filter(
          (f): f is CRFForm => Boolean(f)
        )
      : document.forms.order
          .map((id) => document.forms.byId[id]?.form)
          .filter((f): f is CRFForm => Boolean(f));

  const health = computeConformanceHealthSummary(evaluatedForms);

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;
  const fixable = findings.filter((f) => f.autoFixAvailable).length;

  const penalty = errors * 15 + warnings * 5;
  const score = clamp(100 - penalty, 0, 100);

  return {
    document,
    findings,
    health,
    isCompliant: errors === 0,
    score,
    summary: {
      errors,
      warnings,
      infos,
      fixable,
    },
  };
}

/**
 * Evaluates conformance rule packs scoped strictly to a single `CRFForm`
 * (omitting study-level `SD0005` SoA orphan checks when no `studyContext` is supplied).
 */
export function evaluateFormConformance(
  form: CRFForm,
  options: Omit<EvaluateConformanceOptions, "scope" | "targetFormId"> = {}
): ConformanceEvaluationResult {
  const syntheticStudy: StudyProtocol = {
    id: `form_ctx_${form.id}`,
    protocolNumber: "FORM-CTX",
    studyName: form.name || "Single Form Conformance Context",
    phase: "Phase III",
    sponsor: "Sponsor",
    therapeuticArea: "General",
    version: form.version || "1.0",
    lastModified: "1970-01-01T00:00:00.000Z",
    forms: [form],
    visits: [],
    codelists: [],
  };
  return evaluateStudyConformance(syntheticStudy, {
    ...options,
    scope: "form",
    targetFormId: form.id,
  });
}
