import type { CRFForm } from "../types";
import { evaluateFormConformance } from "./conformance/engine";

export interface DiagnosticItem {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  location: string;
}

/**
 * Lint CRF forms by projecting AST and formula rule-pack findings from the
 * declarative conformance engine.
 */
export function lintForm(form: CRFForm): DiagnosticItem[] {
  const result = evaluateFormConformance(form, {
    packIds: ["ast", "formula"],
  });
  return result.findings.map((finding) => ({
    id: finding.lintFormDiagnosticId as string,
    severity: finding.severity,
    message: finding.message,
    location: finding.location,
  }));
}
