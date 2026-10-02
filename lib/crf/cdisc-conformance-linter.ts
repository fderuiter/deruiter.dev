/**
 * CDISC Conformance & Regulatory Validation Engine
 * Validates CDASH 2.2 / SDTMIG v3.4 rules with 1-Click Auto-Fix remediation.
 */

import { StudyProtocol, CRFField, ComplianceViolation } from "./types";
import {
  CDASH_STANDARD_VARIABLES,
  STANDARD_CODELISTS,
} from "./cdisc-cdash-library";

/**
 * Generates a high-entropy cryptographic UUID string for CDISC compliance auto-fix remediation.
 */
function generateCryptoUuid(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto) {
    if (typeof globalThis.crypto.randomUUID === "function") {
      try {
        return globalThis.crypto.randomUUID();
      } catch {
        // Fall through
      }
    }
    if (typeof globalThis.crypto.getRandomValues === "function") {
      try {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) =>
          b.toString(16).padStart(2, "0")
        ).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      } catch {
        // Fall through
      }
    }
  }

  try {
    // Node.js runtime fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require("crypto");
    if (typeof nodeCrypto.randomUUID === "function") {
      return nodeCrypto.randomUUID();
    }
  } catch {
    // Fall through
  }

  const rHex = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  return `${rHex()}${rHex()}-${rHex()}-4${rHex().substring(1)}-8${rHex().substring(1)}-${rHex()}${rHex()}${rHex()}`;
}

/**
 * Validates an entire study protocol against CDISC CDASH and regulatory submission conformance rules.
 *
 * @param study - The study protocol to validate
 * @returns Array of compliance violations found across forms, fields, and visits
 */
export function validateStudyCompliance(
  study: StudyProtocol
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  // Index of all forms assigned across visits
  const assignedFormIdSet = new Set<string>();
  study.visits.forEach((v) => {
    v.assignedFormIds.forEach((fid) => assignedFormIdSet.add(fid));
  });

  // Rule SD0005: Check for unassigned / orphaned forms in Schedule of Activities
  study.forms.forEach((form) => {
    if (!form.isLogForm && !assignedFormIdSet.has(form.id)) {
      violations.push({
        id: `viol_sd0005_${form.id}`,
        ruleId: "SD0005",
        ruleDescription:
          "Form is not assigned to any visit in Schedule of Activities (SoA)",
        severity: "warning",
        formId: form.id,
        formName: form.name,
        message: `Form '${form.name}' (${form.domain}) is defined but not assigned to any study visit in the visit schedule.`,
        autoFixAvailable: study.visits.length > 0,
        autoFixType: "assign_visit_form",
        suggestedFix: `Assign '${form.name}' to ${study.visits[0]?.name || "First Visit"}`,
      });
    }
  });

  study.forms.forEach((form) => {
    const domainUpper = form.domain.toUpperCase();
    const standardVarsForDomain = CDASH_STANDARD_VARIABLES[domainUpper] || [];
    const fieldsInForm = form.sections.flatMap((s) => s.fields);
    const existingVariables = new Set(
      fieldsInForm.map((f) => f.variableName.toUpperCase())
    );

    // Rule SD0001: Variable Name Length Check (<= 8 characters for CDISC/SDTM target)
    fieldsInForm.forEach((field) => {
      if (field.variableName && field.variableName.length > 8) {
        const truncated = field.variableName.slice(0, 8).toUpperCase();
        violations.push({
          id: `viol_sd0001_${form.id}_${field.id}`,
          ruleId: "SD0001",
          ruleDescription:
            "Variable name exceeds 8-character CDISC SDTM length limit",
          severity: "error",
          formId: form.id,
          formName: form.name,
          fieldId: field.id,
          variableName: field.variableName,
          message: `Variable '${field.variableName}' is ${field.variableName.length} characters long. SDTM standard requires <= 8 characters.`,
          autoFixAvailable: true,
          autoFixType: "truncate_variable",
          suggestedFix: `Truncate to '${truncated}'`,
        });
      }

      // Rule SD0003: Controlled Terminology check for codelist-backed fields
      if (
        (field.dataType === "radio" ||
          field.dataType === "single_select" ||
          field.dataType === "checkbox" ||
          field.dataType === "multi_select") &&
        !field.codelistId &&
        (!field.customOptions || field.customOptions.length === 0)
      ) {
        violations.push({
          id: `viol_sd0003_${form.id}_${field.id}`,
          ruleId: "SD0003",
          ruleDescription:
            "Codelist selection missing controlled terminology binding",
          severity: "warning",
          formId: form.id,
          formName: form.name,
          fieldId: field.id,
          variableName: field.variableName,
          message: `Choice field '${field.variableName}' has no standard NCI codelist or custom options configured.`,
          autoFixAvailable: true,
          autoFixType: "assign_nci_codelist",
          suggestedFix: "Assign standard No/Yes (NY) codelist (C66741)",
        });
      }

      // Rule SD0004: Date format validation
      if (
        (field.dataType === "date" ||
          field.dataType === "datetime" ||
          field.dataType === "partial_date" ||
          field.dataType === "precision_date") &&
        field.defaultValue &&
        typeof field.defaultValue === "string" &&
        !/^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2})?)?)?)?$/.test(
          field.defaultValue
        ) &&
        !/^\d{4}(-\d{2})?(-UNK)?$/.test(field.defaultValue) &&
        field.defaultValue !== "ND" &&
        field.defaultValue !== "NA" &&
        field.defaultValue !== "UNK"
      ) {
        violations.push({
          id: `viol_sd0004_${form.id}_${field.id}`,
          ruleId: "SD0004",
          ruleDescription:
            "Default date value does not conform to ISO 8601 standard (YYYY-MM-DD)",
          severity: "error",
          formId: form.id,
          formName: form.name,
          fieldId: field.id,
          variableName: field.variableName,
          message: `Default value '${field.defaultValue}' for date field '${field.variableName}' is not valid ISO 8601.`,
          autoFixAvailable: true,
          autoFixType: "fix_date_format",
          suggestedFix: "Reset to empty or format as YYYY-MM-DD",
        });
      }
    });

    // Rule SD0002: Missing CDASH Core (Required / Highly Recommended) variables for standard domains
    if (standardVarsForDomain.length > 0) {
      const coreVariables = standardVarsForDomain.filter(
        (v) => v.core === "HR" || v.core === "R"
      );
      coreVariables.forEach((coreVar) => {
        if (!existingVariables.has(coreVar.sdtmVariable.toUpperCase())) {
          violations.push({
            id: `viol_sd0002_${form.id}_${coreVar.sdtmVariable}`,
            ruleId: "SD0002",
            ruleDescription: `Missing CDASH Core variable: ${coreVar.sdtmVariable}`,
            severity: "error",
            formId: form.id,
            formName: form.name,
            variableName: coreVar.sdtmVariable,
            message: `Domain '${form.domain}' is missing standard CDASH Core variable '${coreVar.sdtmVariable}' (${coreVar.cdashLabel}).`,
            autoFixAvailable: true,
            autoFixType: "add_core_variable",
            suggestedFix: `Add '${coreVar.sdtmVariable}' field to form`,
          });
        }
      });
    }
  });

  return violations;
}

/**
 * Applies a single 1-Click Auto-Fix remediation to the study protocol.
 *
 * @param study - The current study protocol
 * @param violation - The compliance violation to remediate
 * @returns The updated study protocol with the fix applied
 */
export function autoFixViolation(
  study: StudyProtocol,
  violation: ComplianceViolation
): StudyProtocol {
  if (!violation.autoFixAvailable) return study;

  const updatedForms = study.forms.map((form) => {
    if (form.id !== violation.formId) return form;

    switch (violation.autoFixType) {
      case "truncate_variable": {
        const updatedSections = form.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => {
            if (
              field.id === violation.fieldId &&
              field.variableName.length > 8
            ) {
              return {
                ...field,
                variableName: field.variableName.slice(0, 8).toUpperCase(),
              };
            }
            return field;
          }),
        }));
        return { ...form, sections: updatedSections };
      }

      case "assign_nci_codelist": {
        const updatedSections = form.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => {
            if (field.id === violation.fieldId) {
              const nyCodelist = STANDARD_CODELISTS.find(
                (c) => c.id === "CL_NY"
              );
              return {
                ...field,
                codelistId: "CL_NY",
                customOptions: nyCodelist
                  ? nyCodelist.options
                  : field.customOptions,
              };
            }
            return field;
          }),
        }));
        return { ...form, sections: updatedSections };
      }

      case "fix_date_format": {
        const updatedSections = form.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => {
            if (field.id === violation.fieldId) {
              return {
                ...field,
                defaultValue: "",
              };
            }
            return field;
          }),
        }));
        return { ...form, sections: updatedSections };
      }

      case "add_core_variable": {
        if (!violation.variableName) return form;
        const domainUpper = form.domain.toUpperCase();
        const stdVar = CDASH_STANDARD_VARIABLES[domainUpper]?.find(
          (v) =>
            v.sdtmVariable.toUpperCase() ===
            violation.variableName?.toUpperCase()
        );

        if (!stdVar) return form;

        const newField: CRFField = {
          id: `f_autofix_${stdVar.sdtmVariable.toLowerCase()}_${generateCryptoUuid()}`,
          variableName: stdVar.sdtmVariable,
          label: stdVar.cdashLabel,
          dataType:
            stdVar.dataCategory === "Timing"
              ? "date"
              : stdVar.nciConceptId
                ? "single_select"
                : "text",
          columnSpan: 6,
          required: stdVar.core === "R",
          codelistId: stdVar.nciConceptId
            ? STANDARD_CODELISTS.find(
                (c) => c.nciCodelistCode === stdVar.nciConceptId
              )?.id
            : undefined,
          cdashMetadata: stdVar,
        };

        const targetSection = form.sections[0] || {
          id: `sec_autofix_${generateCryptoUuid()}`,
          title: "Core Demographics / Assessments",
          fields: [],
        };

        const updatedSections =
          form.sections.length > 0
            ? form.sections.map((sec, idx) =>
                idx === 0 ? { ...sec, fields: [...sec.fields, newField] } : sec
              )
            : [{ ...targetSection, fields: [newField] }];

        return { ...form, sections: updatedSections };
      }

      default:
        return form;
    }
  });

  // Handle visit assignment auto-fix (SD0005)
  if (
    violation.autoFixType === "assign_visit_form" &&
    study.visits.length > 0
  ) {
    const updatedVisits = study.visits.map((visit, idx) => {
      if (idx === 0 && !visit.assignedFormIds.includes(violation.formId)) {
        return {
          ...visit,
          assignedFormIds: [...visit.assignedFormIds, violation.formId],
        };
      }
      return visit;
    });

    return {
      ...study,
      forms: updatedForms,
      visits: updatedVisits,
    };
  }

  return {
    ...study,
    forms: updatedForms,
  };
}

/**
 * Automatically applies all available 1-Click Auto-Fix remediations across the entire study protocol.
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
      currentStudy = autoFixViolation(currentStudy, viol);
      fixedCount++;
    }
  }

  return { updatedStudy: currentStudy, fixedCount };
}
