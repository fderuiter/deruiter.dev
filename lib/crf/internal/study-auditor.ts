import type {
  AuditTrailEntry,
  CRFField,
  CRFForm,
  StudyProtocol,
} from "../types";
import { lintFormula, type FormulaLintResult } from "./formula-linter";
import type { ActorContext } from "./study-engine";
import {
  computeConformanceHealthSummary,
  evaluateFormConformance,
  evaluateStudyConformance,
} from "./conformance/engine";
import {
  applyPureRemediation,
  deterministicRemediationUuid,
} from "./conformance/remediations";
import type { ConformanceFinding } from "./conformance/types";

/**
 * Diagnostic finding tier categorization.
 */
export type DiagnosticTier = "ast" | "cdash" | "soa" | "health";

/**
 * Severity level of an audit finding.
 */
export type DiagnosticSeverity = "error" | "warning" | "info";

/**
 * Standardized audit diagnostic finding.
 */
export interface AuditDiagnostic {
  id: string;
  tier: DiagnosticTier;
  severity: DiagnosticSeverity;
  formId: string;
  formName?: string;
  fieldId?: string;
  variableName?: string;
  ruleId?: string;
  ruleDescription?: string;
  message: string;
  autoFixAvailable: boolean;
  autoFixType?:
    | "truncate_variable"
    | "add_core_variable"
    | "assign_nci_codelist"
    | "fix_date_format"
    | "assign_visit_form";
  suggestedFix?: string;
}

/**
 * Form-level health and compliance metrics.
 */
export interface FormHealthMetrics {
  totalFields: number;
  mandatoryFields: number;
  codelistsAttached: number;
  calculatedFields: number;
  conditionalRules: number;
  sdvVerifiedCount: number;
  sdvReadinessPercentage: number;
  cdashConformancePercentage: number;
  missingCoreVariables: string[];
}

/**
 * Single form audit report.
 */
export interface FormAuditReport {
  formId: string;
  formName: string;
  isCompliant: boolean;
  health: FormHealthMetrics;
  diagnostics: AuditDiagnostic[];
}

/**
 * Global study audit report returned by `StudyAuditor.audit()`.
 */
export interface StudyAuditReport {
  isCompliant: boolean;
  score: number;
  health: FormHealthMetrics;
  diagnostics: AuditDiagnostic[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    fixable: number;
  };
  autoFix: (diagnosticId: string) => StudyProtocol;
  autoFixAll: () => { protocol: StudyProtocol; fixedCount: number };
}

function toAuditDiagnostic(finding: ConformanceFinding): AuditDiagnostic {
  return {
    id: finding.id,
    tier: finding.tier,
    severity: finding.severity,
    formId: finding.formId,
    formName: finding.formName,
    ...(finding.fieldId ? { fieldId: finding.fieldId } : {}),
    ...(finding.variableName ? { variableName: finding.variableName } : {}),
    ruleId: finding.ruleId,
    ruleDescription: finding.ruleDescription,
    message: finding.message,
    autoFixAvailable: finding.autoFixAvailable,
    ...(finding.autoFixType ? { autoFixType: finding.autoFixType } : {}),
    ...(finding.suggestedFix ? { suggestedFix: finding.suggestedFix } : {}),
  };
}

function appendDeterministicAutoFixAuditEntry(
  study: StudyProtocol,
  diagnosticId: string,
  target: AuditDiagnostic,
  actor?: ActorContext
): StudyProtocol {
  let changedBy = "System Auditor";
  let userRole: string | undefined = "System Auditor";

  if (typeof actor === "string" && actor.trim() !== "") {
    changedBy = actor.trim();
  } else if (actor && typeof actor === "object") {
    if (actor.name) changedBy = actor.name;
    if (actor.role) userRole = actor.role;
  }

  const currentTrail = study.auditTrail ? [...study.auditTrail] : [];
  const entryId = `aud_${deterministicRemediationUuid(
    `${study.id}::autofix::${diagnosticId}::${currentTrail.length}`
  )}`;
  const timestamp = study.lastModified || "1970-01-01T00:00:00.000Z";

  const newEntry: AuditTrailEntry = {
    id: entryId,
    timestamp,
    actionType: "AUTO_FIX",
    targetId: diagnosticId,
    subjectId: "PROTOCOL",
    formId: target.formId || "",
    fieldId: target.fieldId || "",
    fieldName: target.variableName || "",
    previousValue: null,
    newValue: null,
    changedBy,
    userRole,
    reasonForChange: `Applied 1-click auto-fix for diagnostic ${diagnosticId}: ${target.message}`,
    diagnosticId,
    details: {
      autoFixType: target.autoFixType,
      message: target.message,
      suggestedFix: target.suggestedFix,
    },
  };

  return {
    ...study,
    auditTrail: [...currentTrail, newEntry],
  };
}

/**
 * Deep domain engine for unified clinical study, form, and formula quality auditing.
 * Projects findings from the declarative AST, formula, SoA, and CDASHIG 2.2 rule packs
 * and applies pure, deterministic remediations without wall-clock mutations.
 */
export class StudyAuditor {
  /**
   * Performs a comprehensive multi-tier audit across an entire clinical study protocol.
   *
   * @param study - The `StudyProtocol` object to evaluate.
   * @returns A consolidated `StudyAuditReport` containing diagnostics, health scores, and auto-fix mutations.
   */
  public static audit(study: StudyProtocol): StudyAuditReport {
    const result = evaluateStudyConformance(study);
    const diagnostics = result.findings.map(toAuditDiagnostic);

    return {
      isCompliant: result.isCompliant,
      score: result.score,
      health: result.health,
      diagnostics,
      summary: result.summary,
      autoFix: (diagnosticId: string) =>
        StudyAuditor.applyAutoFix(study, diagnosticId),
      autoFixAll: () => StudyAuditor.applyAutoFixAll(study, diagnostics),
    };
  }

  /**
   * Audits an individual CRF Form. When `studyContext` is omitted, evaluates
   * single-form rule packs without emitting study-level `SD0005` SoA orphan warnings.
   */
  public static auditForm(
    form: CRFForm,
    studyContext?: StudyProtocol
  ): FormAuditReport {
    if (!studyContext) {
      const formResult = evaluateFormConformance(form);
      const diagnostics = formResult.findings.map(toAuditDiagnostic);
      return {
        formId: form.id,
        formName: form.name,
        isCompliant: !diagnostics.some((d) => d.severity === "error"),
        health: formResult.health,
        diagnostics,
      };
    }

    const fullResult = evaluateStudyConformance(studyContext);
    const formDiagnostics = fullResult.findings
      .filter((f) => f.formId === form.id)
      .map(toAuditDiagnostic);
    const health = computeConformanceHealthSummary([form]);

    return {
      formId: form.id,
      formName: form.name,
      isCompliant: !formDiagnostics.some((d) => d.severity === "error"),
      health,
      diagnostics: formDiagnostics,
    };
  }

  /**
   * Evaluates and tokenizes an arithmetic formula expression against a list of fields.
   */
  public static auditFormula(
    formula: string,
    fields: CRFField[]
  ): FormulaLintResult {
    return lintFormula(formula, fields);
  }

  /**
   * Applies an individual pure, deterministic 1-click auto-fix remediation to a `StudyProtocol` instance.
   */
  public static applyAutoFix(
    study: StudyProtocol,
    diagnosticId: string,
    actor?: ActorContext
  ): StudyProtocol {
    const report = StudyAuditor.audit(study);
    const target = report.diagnostics.find((d) => d.id === diagnosticId);
    if (!target || !target.autoFixAvailable) {
      return study;
    }

    const remediated = applyPureRemediation(study, target);
    if (remediated === study) {
      return study;
    }

    return appendDeterministicAutoFixAuditEntry(
      remediated,
      diagnosticId,
      target,
      actor
    );
  }

  /**
   * Applies all available pure auto-fix remediations in a single pass.
   */
  public static applyAutoFixAll(
    study: StudyProtocol,
    diagnostics?: AuditDiagnostic[],
    actor?: ActorContext
  ): { protocol: StudyProtocol; fixedCount: number } {
    let currentStudy = study;
    let fixedCount = 0;
    const diags = diagnostics || StudyAuditor.audit(study).diagnostics;
    const fixables = diags.filter((d) => d.autoFixAvailable);

    for (const diag of fixables) {
      const next = StudyAuditor.applyAutoFix(currentStudy, diag.id, actor);
      if (next !== currentStudy) {
        currentStudy = next;
        fixedCount++;
      }
    }

    return { protocol: currentStudy, fixedCount };
  }
}
