import { CRFField, CRFForm } from "../types";

export interface DiagnosticItem {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  location: string;
}

/**
 * Lint CRF forms to identify dead rules, duplicate variables, broken references
 */
export function lintForm(form: CRFForm): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  const fieldMap = new Map<string, CRFField>();
  const varNames = new Set<string>();

  // 1. Check all fields
  form.sections.forEach((section) => {
    section.fields.forEach((field) => {
      // Check ID uniqueness
      if (fieldMap.has(field.id)) {
        diagnostics.push({
          id: `dup_id_${field.id}`,
          severity: "error",
          message: `Duplicate field ID detected: "${field.id}"`,
          location: `Section "${section.title}"`,
        });
      }
      fieldMap.set(field.id, field);

      // Check Variable Name
      if (!field.variableName || field.variableName.trim() === "") {
        diagnostics.push({
          id: `missing_var_${field.id}`,
          severity: "error",
          message: `Field "${field.label}" is missing a CDASH/SDTM Variable Name`,
          location: `Section "${section.title}"`,
        });
      } else {
        const vName = field.variableName.toUpperCase();
        if (varNames.has(vName)) {
          diagnostics.push({
            id: `dup_var_${field.id}`,
            severity: "warning",
            message: `Duplicate variable name "${vName}" across fields`,
            location: `Field "${field.label}"`,
          });
        }
        varNames.add(vName);
      }

      // Check Calculated Fields
      if (
        field.dataType === "calculated" &&
        (!field.calculationFormula || field.calculationFormula.trim() === "")
      ) {
        diagnostics.push({
          id: `empty_formula_${field.id}`,
          severity: "warning",
          message: `Calculated field "${field.label}" has no arithmetic formula defined`,
          location: `Field "${field.label}"`,
        });
      }
    });
  });

  // 2. Check Rules
  form.rules.forEach((rule) => {
    rule.triggerFieldIds.forEach((tfId) => {
      if (!fieldMap.has(tfId)) {
        diagnostics.push({
          id: `broken_rule_ref_${rule.id}_${tfId}`,
          severity: "error",
          message: `Rule "${rule.name}" references non-existent trigger field "${tfId}"`,
          location: `Edit Check Rule "${rule.name}"`,
        });
      }
    });

    if (rule.targetFieldId && !fieldMap.has(rule.targetFieldId)) {
      diagnostics.push({
        id: `broken_rule_target_${rule.id}`,
        severity: "warning",
        message: `Rule "${rule.name}" targets non-existent field "${rule.targetFieldId}"`,
        location: `Edit Check Rule "${rule.name}"`,
      });
    }

    // Check conditions in rules and condition groups (#542)
    const allConditions = [
      ...(rule.conditions || []),
      ...(rule.conditionGroups?.flatMap((g) => g.conditions) || []),
    ];

    allConditions.forEach((cond) => {
      if (!cond.crossVisitId && !fieldMap.has(cond.fieldId)) {
        diagnostics.push({
          id: `broken_rule_cond_${rule.id}_${cond.fieldId}`,
          severity: "error",
          message: `Rule "${rule.name}" condition references non-existent field "${cond.fieldId}"`,
          location: `Edit Check Rule "${rule.name}"`,
        });
      }
      if (
        cond.compareFieldId &&
        !cond.crossVisitId &&
        !fieldMap.has(cond.compareFieldId)
      ) {
        diagnostics.push({
          id: `broken_rule_compare_${rule.id}_${cond.compareFieldId}`,
          severity: "error",
          message: `Rule "${rule.name}" compares against non-existent field "${cond.compareFieldId}"`,
          location: `Edit Check Rule "${rule.name}"`,
        });
      }
    });
  });

  return diagnostics;
}
