import type { CRFForm } from "../../../types";
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

/**
 * Declarative AST & Edit-Check structural integrity rule pack.
 */
export const AST_CONFORMANCE_PACK: ConformanceRulePack = {
  id: "ast",
  name: "CRF AST & Symbol Integrity Pack",
  version: "1.0.0",
  rules: [
    {
      ruleId: "AST-FIELD-IDENTIFIERS",
      description:
        "Fields must declare unique IDs, non-empty variable names, and unique variable names within each form",
      defaultSeverity: "error",
      tier: "ast",
      evaluate(ctx: ConformanceEvaluationContext): ConformanceFinding[] {
        const findings: ConformanceFinding[] = [];
        for (const form of getEvaluatedForms(ctx)) {
          const seenFieldIds = new Set<string>();
          const seenVarNames = new Set<string>();

          for (const section of form.sections || []) {
            for (const field of section.fields || []) {
              if (seenFieldIds.has(field.id)) {
                findings.push({
                  id: `ast_dup_id_${form.id}_${field.id}`,
                  packId: "ast",
                  packVersion: "1.0.0",
                  tier: "ast",
                  ruleId: "AST-DUP-FIELD-ID",
                  legacyEngineRule: "AST-LINT",
                  ruleDescription:
                    "Duplicate field ID within the same CRF form",
                  severity: "error",
                  formId: form.id,
                  formName: form.name,
                  formDomain: form.domain,
                  location: `Section "${section.title}"`,
                  lintFormDiagnosticId: `dup_id_${field.id}`,
                  fieldId: field.id,
                  variableName: field.variableName,
                  message: `Duplicate field ID detected: "${field.id}"`,
                  autoFixAvailable: false,
                });
              }
              seenFieldIds.add(field.id);

              const rawVar = (field.variableName || "").trim();
              if (!rawVar) {
                findings.push({
                  id: `ast_missing_var_${form.id}_${field.id}`,
                  packId: "ast",
                  packVersion: "1.0.0",
                  tier: "ast",
                  ruleId: "AST-MISSING-VAR",
                  legacyEngineRule: "AST-LINT",
                  ruleDescription:
                    "Field is missing a CDASH/SDTM variable identifier",
                  severity: "error",
                  formId: form.id,
                  formName: form.name,
                  formDomain: form.domain,
                  location: `Section "${section.title}"`,
                  lintFormDiagnosticId: `missing_var_${field.id}`,
                  fieldId: field.id,
                  message: `Field "${field.label}" is missing a CDASH/SDTM Variable Name`,
                  autoFixAvailable: false,
                });
              } else {
                const upperVar = rawVar.toUpperCase();
                if (seenVarNames.has(upperVar)) {
                  findings.push({
                    id: `ast_dup_var_${form.id}_${field.id}_${upperVar}`,
                    packId: "ast",
                    packVersion: "1.0.0",
                    tier: "ast",
                    ruleId: "AST-DUP-VAR",
                    legacyEngineRule: "AST-LINT",
                    ruleDescription:
                      "Duplicate variable name within the same CRF form",
                    severity: "error",
                    formId: form.id,
                    formName: form.name,
                    formDomain: form.domain,
                    location: `Field "${field.label}"`,
                    lintFormDiagnosticId: `dup_var_${field.id}`,
                    fieldId: field.id,
                    variableName: upperVar,
                    message: `Duplicate variable name "${upperVar}" across fields in form "${form.name}"`,
                    autoFixAvailable: false,
                  });
                }
                seenVarNames.add(upperVar);
              }
            }
          }
        }
        return findings;
      },
    },
    {
      ruleId: "AST-RULE-REFERENCES",
      description:
        "Edit-check triggers, targets, conditions, comparison operands, and cross-visit references must resolve to defined symbols",
      defaultSeverity: "error",
      tier: "ast",
      evaluate(ctx: ConformanceEvaluationContext): ConformanceFinding[] {
        const findings: ConformanceFinding[] = [];
        const { document, scope } = ctx;

        for (const form of getEvaluatedForms(ctx)) {
          const formFieldIds = new Set<string>();
          for (const section of form.sections || []) {
            for (const field of section.fields || []) {
              formFieldIds.add(field.id);
            }
          }

          for (const rule of form.rules || []) {
            for (const tfId of rule.triggerFieldIds || []) {
              if (!formFieldIds.has(tfId)) {
                findings.push({
                  id: `ast_rule_trigger_${form.id}_${rule.id}_${tfId}`,
                  packId: "ast",
                  packVersion: "1.0.0",
                  tier: "ast",
                  ruleId: "AST-BROKEN-TRIGGER",
                  legacyEngineRule: "AST-LINT",
                  ruleDescription:
                    "Edit check rule references a non-existent trigger field",
                  severity: "error",
                  formId: form.id,
                  formName: form.name,
                  formDomain: form.domain,
                  location: `Edit Check Rule "${rule.name}"`,
                  lintFormDiagnosticId: `broken_rule_ref_${rule.id}_${tfId}`,
                  message: `Rule "${rule.name}" references non-existent trigger field "${tfId}"`,
                  autoFixAvailable: false,
                });
              }
            }

            if (rule.targetFieldId && !formFieldIds.has(rule.targetFieldId)) {
              findings.push({
                id: `ast_rule_target_${form.id}_${rule.id}_${rule.targetFieldId}`,
                packId: "ast",
                packVersion: "1.0.0",
                tier: "ast",
                ruleId: "AST-BROKEN-TARGET",
                legacyEngineRule: "AST-LINT",
                ruleDescription: "Edit check rule targets a non-existent field",
                severity: "error",
                formId: form.id,
                formName: form.name,
                formDomain: form.domain,
                location: `Edit Check Rule "${rule.name}"`,
                lintFormDiagnosticId: `broken_rule_target_${rule.id}`,
                fieldId: rule.targetFieldId,
                message: `Rule "${rule.name}" targets non-existent field "${rule.targetFieldId}"`,
                autoFixAvailable: false,
              });
            }

            const allConditions = [
              ...(rule.conditions || []),
              ...(rule.conditionGroups?.flatMap((g) => g.conditions) || []),
            ];

            allConditions.forEach((cond, condIdx) => {
              if (!cond.crossVisitId && !formFieldIds.has(cond.fieldId)) {
                findings.push({
                  id: `ast_rule_cond_${form.id}_${rule.id}_${cond.fieldId}_${condIdx}`,
                  packId: "ast",
                  packVersion: "1.0.0",
                  tier: "ast",
                  ruleId: "AST-BROKEN-CONDITION",
                  legacyEngineRule: "AST-LINT",
                  ruleDescription:
                    "Edit check condition references a non-existent field",
                  severity: "error",
                  formId: form.id,
                  formName: form.name,
                  formDomain: form.domain,
                  location: `Edit Check Rule "${rule.name}"`,
                  lintFormDiagnosticId: `broken_rule_cond_${rule.id}_${cond.fieldId}`,
                  fieldId: cond.fieldId,
                  message: `Rule "${rule.name}" condition references non-existent field "${cond.fieldId}"`,
                  autoFixAvailable: false,
                });
              }

              if (
                cond.compareFieldId &&
                !cond.crossVisitId &&
                !formFieldIds.has(cond.compareFieldId)
              ) {
                findings.push({
                  id: `ast_rule_compare_${form.id}_${rule.id}_${cond.compareFieldId}_${condIdx}`,
                  packId: "ast",
                  packVersion: "1.0.0",
                  tier: "ast",
                  ruleId: "AST-BROKEN-COMPARE",
                  legacyEngineRule: "AST-LINT",
                  ruleDescription:
                    "Edit check comparison references a non-existent field",
                  severity: "error",
                  formId: form.id,
                  formName: form.name,
                  formDomain: form.domain,
                  location: `Edit Check Rule "${rule.name}"`,
                  lintFormDiagnosticId: `broken_rule_compare_${rule.id}_${cond.compareFieldId}`,
                  fieldId: cond.compareFieldId,
                  message: `Rule "${rule.name}" compares against non-existent field "${cond.compareFieldId}"`,
                  autoFixAvailable: false,
                });
              }

              if (scope === "study" && cond.crossVisitId) {
                const visitExists = Boolean(
                  document.visits.byId[cond.crossVisitId] ||
                  document.indexes.visitIdByOid[cond.crossVisitId]
                );
                if (!visitExists) {
                  findings.push({
                    id: `ast_rule_visit_${form.id}_${rule.id}_${cond.crossVisitId}_${condIdx}`,
                    packId: "ast",
                    packVersion: "1.0.0",
                    tier: "ast",
                    ruleId: "AST-BROKEN-CROSS-VISIT",
                    legacyEngineRule: "AST-LINT",
                    ruleDescription:
                      "Cross-visit edit check condition references a non-existent visit",
                    severity: "error",
                    formId: form.id,
                    formName: form.name,
                    formDomain: form.domain,
                    location: `Edit Check Rule "${rule.name}"`,
                    lintFormDiagnosticId: `broken_rule_visit_${rule.id}_${cond.crossVisitId}`,
                    message: `Rule "${rule.name}" references non-existent cross-visit "${cond.crossVisitId}"`,
                    autoFixAvailable: false,
                  });
                }
              }
            });

            if (rule.unsupportedExpression) {
              findings.push({
                id: `ast_rule_unsupported_${form.id}_${rule.id}`,
                packId: "ast",
                packVersion: "1.0.0",
                tier: "ast",
                ruleId: "AST-UNSUPPORTED-EXPR",
                legacyEngineRule: "AST-LINT",
                ruleDescription:
                  "Imported rule carries an unparsed vendor expression requiring manual review",
                severity: "warning",
                formId: form.id,
                formName: form.name,
                formDomain: form.domain,
                location: `Edit Check Rule "${rule.name}"`,
                lintFormDiagnosticId: `unsupported_expr_${rule.id}`,
                message: `Rule "${rule.name}" contains an unparsed expression requiring review: ${rule.unsupportedExpression}`,
                autoFixAvailable: false,
              });
            }
          }
        }

        return findings;
      },
    },
  ],
};
