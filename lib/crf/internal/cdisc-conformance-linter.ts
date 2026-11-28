/**
 * CDISC Conformance & Regulatory Validation Engine
 * Projects declarative AST, formula, SoA, and CDASHIG 2.2 rule-pack findings
 * onto `ComplianceViolation` contracts with pure 1-click remediations.
 */

import type { ComplianceViolation, StudyProtocol } from "../types";
import { evaluateStudyConformance } from "./conformance/engine";
import { applyPureRemediation } from "./conformance/remediations";
import type { ConformanceFinding } from "./conformance/types";

/**
 * Validates an entire study protocol against declarative AST, formula, SoA,
 * and CDASHIG 2.2 conformance rule packs.
 *
 * @param study - The study protocol to validate
 * @returns Array of compliance violations found across forms, fields, rules, and visits
 */
export function validateStudyCompliance(
  study: StudyProtocol
): ComplianceViolation[] {
  const result = evaluateStudyConformance(study);
  return result.findings
    .filter(
      (f): f is ConformanceFinding & { severity: "error" | "warning" } =>
        f.severity === "error" || f.severity === "warning"
    )
    .map((f) => ({
      id: f.id,
      ruleId: f.ruleId as "SD0001" | "SD0002" | "SD0003" | "SD0004" | "SD0005",
      ruleDescription: f.ruleDescription,
      severity: f.severity,
      formId: f.formId,
      formName: f.formName,
      ...(f.fieldId ? { fieldId: f.fieldId } : {}),
      ...(f.variableName ? { variableName: f.variableName } : {}),
      message: f.message,
      autoFixAvailable: f.autoFixAvailable,
      ...(f.autoFixType ? { autoFixType: f.autoFixType } : {}),
      ...(f.suggestedFix ? { suggestedFix: f.suggestedFix } : {}),
    }));
}

/**
 * Applies a single pure, deterministic 1-Click Auto-Fix remediation to the study protocol.
 *
 * @param study - The current study protocol
 * @param violation - The compliance violation to remediate
 * @returns The updated study protocol with the fix applied
 */
export function autoFixViolation(
  study: StudyProtocol,
  violation: ComplianceViolation
): StudyProtocol {
  return applyPureRemediation(study, violation);
}

/**
 * Automatically applies all available pure 1-Click Auto-Fix remediations across the study protocol.
 *
 * @param study - The current study protocol
 * @returns An object containing the updated study protocol and the count of fixed violations
 */
export function autoFixAllViolations(study: StudyProtocol): {
  updatedStudy: StudyProtocol;
  fixedCount: number;
} {
  let currentStudy = study;
  const violations = validateStudyCompliance(currentStudy);
  let fixedCount = 0;

  for (const viol of violations) {
    if (viol.autoFixAvailable) {
      const next = applyPureRemediation(currentStudy, viol);
      if (next !== currentStudy) {
        currentStudy = next;
        fixedCount++;
      }
    }
  }

  return { updatedStudy: currentStudy, fixedCount };
}
