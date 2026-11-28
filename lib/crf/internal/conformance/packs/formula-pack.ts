import type { CRFField, CRFForm } from "../../../types";
import { STANDARD_CODELISTS } from "../../cdisc-cdash-library";
import { lintFormula } from "../../formula-linter";
import type {
  ConformanceEvaluationContext,
  ConformanceFinding,
  ConformanceRulePack,
} from "../types";

function getEvaluatedForms(ctx: ConformanceEvaluationContext): CRFForm[] {
  const { document, scope, targetFormId } = ctx;
  if (scope === "form" && targetFormId) {
    const node = document.forms.byId[targetFormId];
    return node ? [node.form] : [];
  }
  return document.forms.order
    .map((id) => document.forms.byId[id]?.form)
    .filter((f): f is CRFForm => Boolean(f));
}

function normalizeFormulaExpression(formula: string): string {
  // Normalize REDCap [variable_name] bracket references to plain identifiers
  return formula.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, "$1");
}

function isNumericCodedChoiceField(
  field: CRFField | undefined,
  ctx: ConformanceEvaluationContext
): boolean {
  if (!field) return false;
  if (field.dataType !== "radio" && field.dataType !== "single_select") {
    return false;
  }
  const options =
    field.customOptions ||
    (field.codelistId
      ? ctx.document.codelists.byId[field.codelistId]?.options ||
        STANDARD_CODELISTS.find((c) => c.id === field.codelistId)?.options
      : undefined);
  if (!options || options.length === 0) return false;
  return options.every((opt) => {
    const trimmed = String(opt.code ?? "").trim();
    return trimmed !== "" && Number.isFinite(Number(trimmed));
  });
}

/**
 * Declarative Formula & Derived-Calculation conformance rule pack.
 */
export const FORMULA_CONFORMANCE_PACK: ConformanceRulePack = {
  id: "formula",
  name: "Derived Calculation & Formula Syntax Pack",
  version: "1.0.0",
  rules: [
    {
      ruleId: "FORMULA-VALIDATION",
      description:
        "Calculated fields and set_value formula rules must define syntactically valid, non-circular arithmetic expressions",
      defaultSeverity: "error",
      tier: "ast",
      evaluate(ctx: ConformanceEvaluationContext): ConformanceFinding[] {
        const findings: ConformanceFinding[] = [];

        for (const form of getEvaluatedForms(ctx)) {
          const allFormFields: CRFField[] = [];
          for (const section of form.sections || []) {
            for (const field of section.fields || []) {
              allFormFields.push(field);
            }
          }

          for (const section of form.sections || []) {
            for (const field of section.fields || []) {
              const rawFormula = (field.calculationFormula || "").trim();
              if (field.dataType === "calculated" && !rawFormula) {
                findings.push({
                  id: `formula_empty_${form.id}_${field.id}`,
                  packId: "formula",
                  packVersion: "1.0.0",
                  tier: "ast",
                  ruleId: "FORMULA-EMPTY",
                  legacyEngineRule: "AST-LINT",
                  ruleDescription:
                    "Calculated field must declare an arithmetic calculation formula",
                  severity: "warning",
                  formId: form.id,
                  formName: form.name,
                  formDomain: form.domain,
                  location: `Field "${field.label}"`,
                  lintFormDiagnosticId: `empty_formula_${field.id}`,
                  fieldId: field.id,
                  variableName: field.variableName,
                  message: `Calculated field "${field.label}" has no arithmetic formula defined`,
                  autoFixAvailable: false,
                });
              } else if (rawFormula) {
                const normalized = normalizeFormulaExpression(rawFormula);
                const lintRes = lintFormula(
                  normalized,
                  allFormFields,
                  field.id
                );
                const refByToken = new Map(
                  lintRes.referencedVariables.map((r) => [
                    r.name.toLowerCase(),
                    r.field,
                  ])
                );

                lintRes.diagnostics.forEach((diag, dIdx) => {
                  if (
                    diag.code === "EMPTY_FORMULA" ||
                    diag.severity === "info"
                  ) {
                    return;
                  }
                  if (diag.code === "NON_NUMERIC_VARIABLE") {
                    const tokenText = normalized
                      .slice(diag.start, diag.end)
                      .trim()
                      .toLowerCase();
                    const refField = refByToken.get(tokenText);
                    if (isNumericCodedChoiceField(refField, ctx)) {
                      return;
                    }
                  }

                  findings.push({
                    id: `formula_${diag.code.toLowerCase()}_${form.id}_${field.id}_${dIdx}`,
                    packId: "formula",
                    packVersion: "1.0.0",
                    tier: "ast",
                    ruleId: `FORMULA-${diag.code}`,
                    legacyEngineRule: "AST-LINT",
                    ruleDescription: `Formula diagnostic (${diag.code})`,
                    severity: diag.severity,
                    formId: form.id,
                    formName: form.name,
                    formDomain: form.domain,
                    location: `Field "${field.label}"`,
                    lintFormDiagnosticId: `formula_${diag.code.toLowerCase()}_${field.id}_${dIdx}`,
                    fieldId: field.id,
                    variableName: field.variableName,
                    message: `Formula on "${field.label}" (${field.variableName}): ${diag.message}`,
                    autoFixAvailable: false,
                  });
                });
              }

              // Also inspect repeating-table calculated columns
              if (Array.isArray(field.repeatingColumns)) {
                for (const col of field.repeatingColumns) {
                  const colFormula = (col.calculationFormula || "").trim();
                  if (col.dataType === "calculated" && !colFormula) {
                    findings.push({
                      id: `formula_empty_col_${form.id}_${field.id}_${col.id}`,
                      packId: "formula",
                      packVersion: "1.0.0",
                      tier: "ast",
                      ruleId: "FORMULA-EMPTY",
                      legacyEngineRule: "AST-LINT",
                      ruleDescription:
                        "Calculated repeating column must declare an arithmetic formula",
                      severity: "warning",
                      formId: form.id,
                      formName: form.name,
                      formDomain: form.domain,
                      location: `Column "${col.label}"`,
                      lintFormDiagnosticId: `empty_formula_${col.id}`,
                      fieldId: field.id,
                      variableName: col.variableName,
                      message: `Calculated column "${col.label}" has no arithmetic formula defined`,
                      autoFixAvailable: false,
                    });
                  } else if (colFormula) {
                    const colFieldPool = [
                      ...allFormFields,
                      ...field.repeatingColumns.map((rc) => ({
                        id: rc.id,
                        variableName: rc.variableName,
                        label: rc.label,
                        dataType: rc.dataType,
                        columnSpan: 6 as const,
                        required: Boolean(rc.required),
                        codelistId: rc.codelistId,
                        customOptions: rc.customOptions,
                      })),
                    ];
                    const normalized = normalizeFormulaExpression(colFormula);
                    const lintRes = lintFormula(
                      normalized,
                      colFieldPool,
                      col.id
                    );
                    lintRes.diagnostics.forEach((diag, dIdx) => {
                      if (
                        diag.code === "EMPTY_FORMULA" ||
                        diag.severity === "info"
                      ) {
                        return;
                      }
                      findings.push({
                        id: `formula_col_${diag.code.toLowerCase()}_${form.id}_${col.id}_${dIdx}`,
                        packId: "formula",
                        packVersion: "1.0.0",
                        tier: "ast",
                        ruleId: `FORMULA-${diag.code}`,
                        legacyEngineRule: "AST-LINT",
                        ruleDescription: `Formula diagnostic (${diag.code})`,
                        severity: diag.severity,
                        formId: form.id,
                        formName: form.name,
                        formDomain: form.domain,
                        location: `Column "${col.label}"`,
                        lintFormDiagnosticId: `formula_${diag.code.toLowerCase()}_${col.id}_${dIdx}`,
                        fieldId: field.id,
                        variableName: col.variableName,
                        message: `Formula on column "${col.label}" (${col.variableName}): ${diag.message}`,
                        autoFixAvailable: false,
                      });
                    });
                  }
                }
              }
            }
          }

          // Inspect set_value rule formulas
          for (const rule of form.rules || []) {
            const ruleFormula = (rule.formulaExpression || "").trim();
            if (!ruleFormula) continue;
            const normalized = normalizeFormulaExpression(ruleFormula);
            const lintRes = lintFormula(normalized, allFormFields);
            const refByToken = new Map(
              lintRes.referencedVariables.map((r) => [
                r.name.toLowerCase(),
                r.field,
              ])
            );
            lintRes.diagnostics.forEach((diag, dIdx) => {
              if (diag.code === "EMPTY_FORMULA" || diag.severity === "info") {
                return;
              }
              if (diag.code === "NON_NUMERIC_VARIABLE") {
                const tokenText = normalized
                  .slice(diag.start, diag.end)
                  .trim()
                  .toLowerCase();
                const refField = refByToken.get(tokenText);
                if (isNumericCodedChoiceField(refField, ctx)) {
                  return;
                }
              }
              findings.push({
                id: `formula_rule_${diag.code.toLowerCase()}_${form.id}_${rule.id}_${dIdx}`,
                packId: "formula",
                packVersion: "1.0.0",
                tier: "ast",
                ruleId: `FORMULA-${diag.code}`,
                legacyEngineRule: "AST-LINT",
                ruleDescription: `Rule formula diagnostic (${diag.code})`,
                severity: diag.severity,
                formId: form.id,
                formName: form.name,
                formDomain: form.domain,
                location: `Edit Check Rule "${rule.name}"`,
                lintFormDiagnosticId: `formula_rule_${diag.code.toLowerCase()}_${rule.id}_${dIdx}`,
                fieldId: rule.targetFieldId,
                message: `Rule "${rule.name}" formula: ${diag.message}`,
                autoFixAvailable: false,
              });
            });
          }
        }

        return findings;
      },
    },
  ],
};
