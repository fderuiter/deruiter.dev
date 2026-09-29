/**
 * Automated R & Pharmaverse-Ready Scaffolding Generator for CRF Studio
 * Generates CDASH-compliant R programs (.R) including:
 * 1. Comprehensive Header Metadata & Study Specifications
 * 2. Codelist Factor definitions with explicit levels and labels
 * 3. Modular tibble::tibble data frames per Form/Domain
 * 4. Variable label metadata via labelled::var_label / attr
 * 5. Diagnostic dplyr::glimpse() and summary() verification suites
 */

import { StudyProtocol, CRFForm, CRFField, ExportROptions, CodelistOption } from "./types";
import { STANDARD_CODELISTS } from "./cdisc-controlled-terminology";

/**
 * Sanitizes a string into a valid R variable name.
 * R names should start with a letter and contain letters, numbers, dots, or underscores.
 */
export function sanitizeRName(name: string, maxLength = 32): string {
  if (!name) return "var";
  let cleaned = name.trim().replace(/[^A-Za-z0-9_.]/g, "_");
  if (!/^[A-Za-z]/.test(cleaned)) {
    cleaned = `v_${cleaned}`;
  }
  return cleaned.substring(0, maxLength);
}

/**
 * Escapes strings for R string literals.
 */
/* jscpd:ignore-start */
export function escapeRString(text: string): string {
  if (!text) return "";
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Retrieves field options from custom options or referenced codelists.
 */
export function getFieldOptions(field: CRFField, study: StudyProtocol): CodelistOption[] {
  if (field.customOptions && field.customOptions.length > 0) {
    return field.customOptions;
  }
  if (field.codelistId) {
    const cl = study.codelists?.find((c) => c.id === field.codelistId) ||
               STANDARD_CODELISTS.find((c) => c.id === field.codelistId);
    if (cl && cl.options && cl.options.length > 0) {
      return cl.options;
    }
  }
  if (field.dataType === "checkbox" || field.dataType === "multi_select") {
    const nyCodelist = STANDARD_CODELISTS.find((c) => c.id === "CL_NY");
    if (nyCodelist) return nyCodelist.options;
  }
  return [];
}

/**
 * Parses a comma-separated multi-select EDC response string
 * and checks whether a specific option code is selected.
 * Returns 'Y' if selected, 'N' if absent/unselected.
 */
export function parseMultiSelectValue(
  edcValue: string | string[] | boolean | null | undefined,
  optionCode: string
): "Y" | "N" {
  if (edcValue === null || edcValue === undefined || edcValue === false) return "N";
  if (edcValue === true) return "Y";
  let selectedCodes: string[] = [];
  if (Array.isArray(edcValue)) {
    selectedCodes = edcValue.map((s) => String(s).trim().toUpperCase());
  } else if (typeof edcValue === "string") {
    const trimmed = edcValue.trim().toUpperCase();
    if (trimmed === "TRUE" || trimmed === "1" || trimmed === "Y" || trimmed === "YES") {
      const targetUpper = String(optionCode).trim().toUpperCase();
      if (targetUpper === "Y" || targetUpper === "1" || targetUpper === "YES" || targetUpper === "TRUE") {
        return "Y";
      }
    }
    selectedCodes = trimmed
      .split(/[,;]/)
      .map((s) => s.trim().replace(/^['"]+|['"]+$/g, ""))
      .filter(Boolean);
  }
  const targetCode = String(optionCode).trim().toUpperCase();
  return selectedCodes.includes(targetCode) ? "Y" : "N";
}

/**
 * Generates a unique R variable name guaranteed not to collide with usedNames and within maxLength.
 */
function generateUniqueRName(baseName: string, usedNames: Set<string>, maxLength = 32): string {
  let counter = 1;
  const sanitizedBase = sanitizeRName(baseName, maxLength).toUpperCase();
  let candidate = sanitizedBase;
  while (usedNames.has(candidate)) {
    const suffix = `_${counter}`;
    const maxPrefixLen = maxLength - suffix.length;
    candidate = `${sanitizedBase.substring(0, maxPrefixLen)}${suffix}`;
    counter++;
  }
  return candidate;
}

export interface ExpandedRField {
  field: CRFField;
  varName: string;
  optionCode?: string;
  optLabel?: string;
}
/* jscpd:ignore-end */

export function getExpandedRFields(
  field: CRFField,
  study: StudyProtocol,
  usedNames = new Set<string>()
): ExpandedRField[] {
  if (field.dataType !== "multi_select" && field.dataType !== "checkbox") {
    let varName = sanitizeRName(field.variableName || field.id).toUpperCase();
    if (usedNames.has(varName)) {
      varName = generateUniqueRName(varName, usedNames, 32);
    }
    usedNames.add(varName);
    return [{ field, varName }];
  }

  const options = getFieldOptions(field, study);
  const baseVar = sanitizeRName(field.variableName || field.id).toUpperCase();

  if (options.length === 0) {
    let varName = baseVar;
    if (usedNames.has(varName)) {
      varName = generateUniqueRName(varName, usedNames, 32);
    }
    usedNames.add(varName);
    return [{ field, varName }];
  }

  const result: ExpandedRField[] = [];
  options.forEach((opt) => {
    const rawName = `${baseVar}_${opt.code}`;
    let subVarName = sanitizeRName(rawName, 32).toUpperCase();
    if (usedNames.has(subVarName)) {
      subVarName = generateUniqueRName(rawName, usedNames, 32);
    }
    usedNames.add(subVarName);

    result.push({
      field,
      varName: subVarName,
      optionCode: opt.code,
      optLabel: opt.label || opt.code,
    });
  });

  return result;
}

/**
 * Generates R Header Comments.
 */
function generateRHeader(study: StudyProtocol, formScope?: string): string {
  const timestamp = new Date().toISOString();
  return `#==============================================================================
# PROGRAM:      create_raw_${formScope ? formScope.toLowerCase() : "datasets"}.R
# STUDY:        ${escapeRString(study.protocolNumber)} (${escapeRString(study.studyName)})
# SPONSOR:      ${escapeRString(study.sponsor)}
# PHASE:        ${escapeRString(study.phase)} | THERAPEUTIC AREA: ${escapeRString(study.therapeuticArea)}
# GENERATED:    ${timestamp}
# STANDARD:     CDISC CDASH v2.2 / SDTM-IG v3.4 / Pharmaverse R Standards
# DESCRIPTION:  Automated R tibble dataset scaffolding with explicit factor levels,
#               CDASH variable label attributes, synthetic clinical test rows,
#               and diagnostic glimpse inspection.
# AUTHOR:       CRF Studio Automated Statistical Exporter
# CONSULTATION: Schedule Consultation: /schedule
#==============================================================================

# Recommended packages:
# install.packages(c("tibble", "dplyr", "labelled"))
suppressPackageStartupMessages({
  library(tibble)
  library(dplyr)
  if (requireNamespace("labelled", quietly = TRUE)) {
    library(labelled)
  }
})

`;
}

/**
 * Generates Factor definitions for study codelists.
 */
/* jscpd:ignore-start */
export function generateRCodelists(study: StudyProtocol, formsToInclude: CRFForm[]): string {
  const referencedCodelistIds = new Set<string>();
  let hasMultiOrCheckbox = false;

  formsToInclude.forEach((f) => {
    f.sections.forEach((s) => {
      s.fields.forEach((fld) => {
        if (fld.codelistId) referencedCodelistIds.add(fld.codelistId);
        if (fld.dataType === "multi_select" || fld.dataType === "checkbox") {
          hasMultiOrCheckbox = true;
        }
      });
    });
  });

  const userCodelists = study.codelists || [];
  if (userCodelists.length === 0) {
    return `# No codelists defined for this study\n\n`;
  }

  const allAvailableCodelists = [...userCodelists];
  if (hasMultiOrCheckbox && !allAvailableCodelists.some((c) => c.id === "CL_NY")) {
    const ny = STANDARD_CODELISTS.find((c) => c.id === "CL_NY");
    if (ny) allAvailableCodelists.push(ny);
  }

  const relevantCodelists = allAvailableCodelists.filter(
    (cl) => referencedCodelistIds.has(cl.id) || (hasMultiOrCheckbox && cl.id === "CL_NY") || cl.isStandard
  );

  if (relevantCodelists.length === 0) {
    return `# No codelists defined for this study\n\n`;
  }
/* jscpd:ignore-end */

  let output = `#------------------------------------------------------------------------------
# STEP 1: Codelist Factor Levels & Labels (NCI Thesaurus / Controlled Terminology)
#------------------------------------------------------------------------------\n`;

  relevantCodelists.forEach((cl) => {
    if (!cl.options || cl.options.length === 0) return;
    const safeName = sanitizeRName(cl.id || cl.name).toLowerCase();
    const levels = cl.options.map((opt) => `"${escapeRString(opt.code)}"`).join(", ");
    const labels = cl.options.map((opt) => `"${escapeRString(opt.label)}"`).join(", ");
    const nciComment = cl.nciCodelistCode ? ` # NCI Codelist: ${cl.nciCodelistCode}` : "";

    output += `# Codelist: ${escapeRString(cl.name)}${nciComment}\n`;
    output += `cl_${safeName}_levels <- c(${levels})\n`;
    output += `cl_${safeName}_labels <- c(${labels})\n\n`;
  });

  return output;
}

/**
 * Generates dichotomous Yes/No factor code for expanded sub-variables.
 */
function getRSubVarSampleCode(optionCode: string | undefined, rowCount = 3): string {
  const codeIdx = optionCode ? optionCode.charCodeAt(0) : 0;
  const vals = Array.from({ length: rowCount }, (_, i) =>
    (i + codeIdx) % 2 === 1 ? '"Y"' : '"N"'
  );
  return `factor(c(${vals.join(", ")}), levels = cl_cl_ny_levels, labels = cl_cl_ny_labels)`;
}

/**
 * Generates synthetic sample column values for R tibble construction.
 */
function getRSampleColumnCode(
  field: CRFField,
  study: StudyProtocol,
  rowCount = 3
): string {
  const codelist = study.codelists?.find((c) => c.id === field.codelistId);
  const hasCodelist = !!codelist && codelist.options.length > 0;
  const varName = sanitizeRName(field.variableName || field.id).toUpperCase();

  switch (field.dataType) {
    case "integer": {
      const vals: number[] = [];
      for (let i = 1; i <= rowCount; i++) {
        if (field.minValue !== undefined && field.maxValue !== undefined) {
          vals.push(Math.round(field.minValue + ((field.maxValue - field.minValue) * i) / (rowCount + 1)));
        } else if (varName.includes("AGE") || varName.includes("YEAR")) {
          vals.push(45 + i * 5);
        } else {
          vals.push(i * 10);
        }
      }
      return `as.integer(c(${vals.join(", ")}))`;
    }

    case "number":
    case "calculated": {
      const vals: number[] = [];
      for (let i = 1; i <= rowCount; i++) {
        if (field.minValue !== undefined && field.maxValue !== undefined) {
          vals.push(Number((field.minValue + ((field.maxValue - field.minValue) * i) / (rowCount + 1)).toFixed(1)));
        } else if (varName.includes("WEIGHT") || varName.includes("WT")) {
          vals.push(Number((70.5 + i * 2.2).toFixed(1)));
        } else if (varName.includes("HEIGHT") || varName.includes("HT")) {
          vals.push(Number((170.0 + i * 1.5).toFixed(1)));
        } else if (varName.includes("SYS") || varName.includes("DIAS")) {
          vals.push(120 + i * 2);
        } else {
          vals.push(Number((10.5 * i).toFixed(1)));
        }
      }
      return `c(${vals.join(", ")})`;
    }

    case "vas_scale":
    case "nrs_scale": {
      const vals = Array.from({ length: rowCount }, (_, i) => (i + 1) * 2);
      return `c(${vals.join(", ")})`;
    }

    case "date":
    case "partial_date":
    case "precision_date": {
      const vals = Array.from({ length: rowCount }, (_, i) => `"2026-03-0${i + 1}"`);
      return `as.Date(c(${vals.join(", ")}))`;
    }

    case "time": {
      const vals = Array.from({ length: rowCount }, (_, i) => `"08:3${i + 1}:00"`);
      return `c(${vals.join(", ")})`;
    }

    case "datetime": {
      const vals = Array.from({ length: rowCount }, (_, i) => `"2026-03-0${i + 1} 08:30:00"`);
      return `as.POSIXct(c(${vals.join(", ")}), tz = "UTC")`;
    }

    case "single_select":
    case "radio":
      if (hasCodelist) {
        const safeName = sanitizeRName(codelist!.id || codelist!.name).toLowerCase();
        const sampleCodes = Array.from({ length: rowCount }, (_, i) => {
          const opt = codelist!.options[i % codelist!.options.length];
          return `"${escapeRString(opt.code)}"`;
        }).join(", ");
        return `factor(c(${sampleCodes}), levels = cl_${safeName}_levels, labels = cl_${safeName}_labels)`;
      }
      return `c("VALUE_1", "VALUE_2", "VALUE_1")`;

    case "multi_select":
    case "checkbox":
      return getRSubVarSampleCode(undefined, rowCount);

    case "textarea":
    case "signature":
    case "text":
    default: {
      const vals = Array.from({ length: rowCount }, (_, i) => `"${varName}_TEST_${i + 1}"`);
      return `c(${vals.join(", ")})`;
    }
  }
}

/**
 * Generates an R tibble construction and variable labeling block for a CRFForm.
 */
export function generateRDataStepForForm(
  form: CRFForm,
  study: StudyProtocol,
  options?: ExportROptions
): string {
  const domain = sanitizeRName(form.domain || form.id, 20);
  const prefix = options?.tibblePrefix || "tbl_";
  const tibbleName = `${prefix}${domain.toLowerCase()}`;
  const includeSample = options?.includeSampleData !== false;
  const includeGlimpse = options?.includeGlimpse !== false;
  const useLabelled = options?.useLabelledPackage !== false;

  const fields = form.sections.flatMap((s) => s.fields);
  const usedNames = new Set<string>([
    "STUDYID",
    "DOMAIN",
    "USUBJID",
    "VISIT",
    "VISITNUM",
    "DTC_INIT",
  ]);

  const expandedFields: ExpandedRField[] = [];
  fields.forEach((field) => {
    const expanded = getExpandedRFields(field, study, usedNames);
    expanded.forEach((item) => expandedFields.push(item));
  });

  let code = `#------------------------------------------------------------------------------
# DATASET:      ${tibbleName}
# FORM:         ${escapeRString(form.name)} [Domain: ${domain.toUpperCase()}]
# DESCRIPTION:  CDASH Tibble Scaffolding with Variable Labels & Factor Levels
#------------------------------------------------------------------------------\n`;

  const visitNames = study.visits && study.visits.length > 0
    ? study.visits.map((v) => `"${escapeRString(v.name)}"`)
    : ['"Screening"', '"Visit 1 (Day 1)"', '"Visit 2 (Day 28)"'];

  code += `${tibbleName} <- tibble::tibble(\n`;
  code += `  # Standard Clinical Trial Identifiers\n`;
  code += `  STUDYID   = rep("${escapeRString(study.protocolNumber)}", 3),\n`;
  code += `  DOMAIN    = rep("${domain.toUpperCase()}", 3),\n`;
  code += `  USUBJID   = c("101-1001", "101-1002", "101-1003"),\n`;
  code += `  VISIT     = c(${visitNames.slice(0, 3).join(", ")}),\n`;
  code += `  VISITNUM  = c(1, 2, 3),\n`;
  code += `  DTC_INIT  = as.Date(c("2026-03-01", "2026-03-02", "2026-03-03")),\n`;

  if (expandedFields.length > 0) {
    code += `\n  # Form Specific CDASH Fields\n`;
    expandedFields.forEach((item, fIdx) => {
      const colCode = includeSample
        ? (item.field.dataType === "multi_select" || item.field.dataType === "checkbox"
            ? getRSubVarSampleCode(item.optionCode, 3)
            : getRSampleColumnCode(item.field, study, 3))
        : "character(0)";
      const isLast = fIdx === expandedFields.length - 1;
      code += `  ${item.varName.padEnd(10)} = ${colCode}${isLast ? "" : ",\n"}`;
    });
    code += `\n`;
  }

  code += `)\n\n`;

  // Variable Labels Block
  code += `# Variable Label Metadata (CDASH / SDTM Variable Definitions)\n`;
  if (useLabelled) {
    code += `if (requireNamespace("labelled", quietly = TRUE)) {\n`;
    code += `  labelled::var_label(${tibbleName}) <- list(\n`;
    code += `    STUDYID   = "Study Identifier",\n`;
    code += `    DOMAIN    = "Domain Abbreviation",\n`;
    code += `    USUBJID   = "Unique Subject Identifier",\n`;
    code += `    VISIT     = "Visit Name",\n`;
    code += `    VISITNUM  = "Visit Number",\n`;
    code += `    DTC_INIT  = "Form Initiation Date",\n`;

    expandedFields.forEach((item, fIdx) => {
      const baseLabel = item.field.cdashMetadata?.cdashLabel || item.field.label || item.varName;
      const fullLabel = item.optLabel ? `${baseLabel} - ${item.optLabel}` : baseLabel;
      const escapedLabel = escapeRString(fullLabel);
      const isLast = fIdx === expandedFields.length - 1;
      code += `    ${item.varName.padEnd(10)} = "${escapedLabel}"${isLast ? "" : ",\n"}`;
    });
    code += `\n  )\n} else {\n`;
    code += `  # Fallback to base R attributes\n`;
    expandedFields.forEach((item) => {
      const baseLabel = item.field.cdashMetadata?.cdashLabel || item.field.label || item.varName;
      const fullLabel = item.optLabel ? `${baseLabel} - ${item.optLabel}` : baseLabel;
      const escapedLabel = escapeRString(fullLabel);
      code += `  attr(${tibbleName}$${item.varName}, "label") <- "${escapedLabel}"\n`;
    });
    code += `}\n\n`;
  } else {
    expandedFields.forEach((item) => {
      const baseLabel = item.field.cdashMetadata?.cdashLabel || item.field.label || item.varName;
      const fullLabel = item.optLabel ? `${baseLabel} - ${item.optLabel}` : baseLabel;
      const escapedLabel = escapeRString(fullLabel);
      code += `attr(${tibbleName}$${item.varName}, "label") <- "${escapedLabel}"\n`;
    });
    code += `\n`;
  }

  // Diagnostics
  if (includeGlimpse) {
    code += `# Diagnostic Inspection\n`;
    code += `dplyr::glimpse(${tibbleName})\n`;
    code += `summary(${tibbleName})\n\n`;
  }

  return code;
}

/**
 * Exports a single form as a self-contained R script.
 */
export function exportFormToR(
  form: CRFForm,
  study: StudyProtocol,
  options?: ExportROptions
): string {
  let output = generateRHeader(study, form.domain || form.id);
  output += generateRCodelists(study, [form]);
  output += generateRDataStepForForm(form, study, options);
  output += `# Schedule Consultation: /schedule\n`;
  return output;
}

/**
 * Exports all forms in a study into a complete R Pharmaverse Suite.
 */
export function exportStudyToR(
  study: StudyProtocol,
  options?: ExportROptions
): string {
  const formsToExport = options?.selectedFormId
    ? study.forms.filter((f) => f.id === options.selectedFormId)
    : study.forms;

  if (formsToExport.length === 0) {
    return generateRHeader(study) + `# No forms selected or available in study\n# Schedule Consultation: /schedule\n`;
  }

  let output = generateRHeader(
    study,
    options?.selectedFormId ? formsToExport[0]?.domain || formsToExport[0]?.id : "suite"
  );
  output += generateRCodelists(study, formsToExport);

  formsToExport.forEach((form, idx) => {
    output += `#==============================================================================
# SECTION ${idx + 1}: ${form.name.toUpperCase()} (DOMAIN: ${(form.domain || form.id).toUpperCase()})
#==============================================================================\n`;
    output += generateRDataStepForForm(form, study, options);
  });

  output += `# Schedule Consultation: /schedule\n`;
  return output;
}
