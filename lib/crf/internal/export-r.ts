/**
 * Automated R & Pharmaverse-Ready Scaffolding Generator for CRF Studio
 * Generates CDASH-modelled R programs (.R) including:
 * 1. Comprehensive Header Metadata & Study Specifications
 * 2. Codelist Factor definitions with explicit levels and labels
 * 3. Modular tibble::tibble data frames per Form/Domain
 * 4. Variable label metadata via labelled::var_label / attr
 * 5. Diagnostic dplyr::glimpse() and summary() verification suites
 */

import { standardCitation } from "@/lib/clinical-standards";
import {
  StudyProtocol,
  CRFForm,
  CRFField,
  ExportROptions,
  CodelistOption,
} from "../types";
import { consultationUrl } from "./export-annotations";
import {
  allocateUniqueIdentifier,
  getFieldOptions,
  prepareExportContext,
  type PreparedExportContext,
  resolveFieldOptions,
  resolveStudyCodelist,
} from "./export-common";
import {
  type CapturedFormRow,
  extractCapturedFormRows,
  hasSimulationRecords,
  parseMultiSelectValue,
} from "./simulation-records";

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
export function escapeRString(text: string): string {
  if (!text) return "";
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export interface ExpandedRField {
  field: CRFField;
  varName: string;
  optionCode?: string;
  optLabel?: string;
}

function expandRFieldsWithOptions(
  field: CRFField,
  options: CodelistOption[],
  usedNames: Set<string>
): ExpandedRField[] {
  if (field.dataType !== "multi_select" && field.dataType !== "checkbox") {
    const varName = allocateUniqueIdentifier(
      field.variableName || field.id,
      usedNames,
      sanitizeRName,
      32
    );
    return [{ field, varName }];
  }

  const baseVar = sanitizeRName(field.variableName || field.id).toUpperCase();

  if (options.length === 0) {
    const varName = allocateUniqueIdentifier(
      baseVar,
      usedNames,
      sanitizeRName,
      32
    );
    return [{ field, varName }];
  }

  const result: ExpandedRField[] = [];
  options.forEach((opt) => {
    const rawName = `${baseVar}_${opt.code}`;
    const subVarName = allocateUniqueIdentifier(
      rawName,
      usedNames,
      sanitizeRName,
      32
    );

    result.push({
      field,
      varName: subVarName,
      optionCode: opt.code,
      optLabel: opt.label || opt.code,
    });
  });

  return result;
}

export function getExpandedRFields(
  field: CRFField,
  study: StudyProtocol,
  usedNames = new Set<string>()
): ExpandedRField[] {
  return expandRFieldsWithOptions(
    field,
    getFieldOptions(field, study),
    usedNames
  );
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
# STANDARD:     CDISC ${standardCitation("CDASHIG")} / ${standardCitation("SDTMIG")} / Pharmaverse R Standards
# DESCRIPTION:  Automated R tibble dataset scaffolding with explicit factor levels,
#               CDASH variable label attributes, synthetic clinical test rows,
#               and diagnostic glimpse inspection.
# AUTHOR:       CRF Studio Automated Statistical Exporter
# CONSULTATION: Schedule Consultation: ${consultationUrl()}
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

function renderRCodelists(context: PreparedExportContext): string {
  const relevantCodelists = context.activeCodelists;
  if (relevantCodelists.length === 0) {
    return `# No codelists defined for this study\n\n`;
  }

  let output = `#------------------------------------------------------------------------------
# STEP 1: Codelist Factor Levels & Labels (NCI Thesaurus / Controlled Terminology)
#------------------------------------------------------------------------------\n`;

  relevantCodelists.forEach((cl) => {
    if (!cl.options || cl.options.length === 0) return;
    const safeName = sanitizeRName(cl.id || cl.name).toLowerCase();
    const levels = cl.options
      .map((opt) => `"${escapeRString(opt.code)}"`)
      .join(", ");
    const labels = cl.options
      .map((opt) => `"${escapeRString(opt.label)}"`)
      .join(", ");
    const nciComment = cl.nciCodelistCode
      ? ` # NCI Codelist: ${cl.nciCodelistCode}`
      : "";

    output += `# Codelist: ${escapeRString(cl.name)}${nciComment}\n`;
    output += `cl_${safeName}_levels <- c(${levels})\n`;
    output += `cl_${safeName}_labels <- c(${labels})\n\n`;
  });

  return output;
}

/**
 * Generates Factor definitions for study codelists.
 */
export function generateRCodelists(
  study: StudyProtocol,
  formsToInclude: CRFForm[]
): string {
  return renderRCodelists(
    prepareExportContext(study, { forms: formsToInclude })
  );
}

/**
 * Generates dichotomous Yes/No factor code for expanded sub-variables.
 */
function getRSubVarSampleCode(
  optionCode: string | undefined,
  rowCount = 3
): string {
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
  context: PreparedExportContext,
  rowCount = 3
): string {
  const codelist = resolveStudyCodelist(context, field);
  const hasCodelist = !!codelist && codelist.options.length > 0;
  const varName = sanitizeRName(field.variableName || field.id).toUpperCase();

  switch (field.dataType) {
    case "integer": {
      const vals: number[] = [];
      for (let i = 1; i <= rowCount; i++) {
        if (field.minValue !== undefined && field.maxValue !== undefined) {
          vals.push(
            Math.round(
              field.minValue +
                ((field.maxValue - field.minValue) * i) / (rowCount + 1)
            )
          );
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
          vals.push(
            Number(
              (
                field.minValue +
                ((field.maxValue - field.minValue) * i) / (rowCount + 1)
              ).toFixed(1)
            )
          );
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
      const vals = Array.from(
        { length: rowCount },
        (_, i) => `"2026-03-0${i + 1}"`
      );
      return `as.Date(c(${vals.join(", ")}))`;
    }

    case "time": {
      const vals = Array.from(
        { length: rowCount },
        (_, i) => `"08:3${i + 1}:00"`
      );
      return `c(${vals.join(", ")})`;
    }

    case "datetime": {
      const vals = Array.from(
        { length: rowCount },
        (_, i) => `"2026-03-0${i + 1} 08:30:00"`
      );
      return `as.POSIXct(c(${vals.join(", ")}), tz = "UTC")`;
    }

    case "single_select":
    case "radio":
      if (hasCodelist) {
        const safeName = sanitizeRName(
          codelist!.id || codelist!.name
        ).toLowerCase();
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
      const vals = Array.from(
        { length: rowCount },
        (_, i) => `"${varName}_TEST_${i + 1}"`
      );
      return `c(${vals.join(", ")})`;
    }
  }
}

function getRLiveColumnCode(
  item: ExpandedRField,
  rows: CapturedFormRow[],
  context: PreparedExportContext
): string {
  const { field, optionCode } = item;
  const codelist = resolveStudyCodelist(context, field);
  const hasCodelist = !!codelist && codelist.options.length > 0;

  if (rows.length === 0) {
    if (field.dataType === "multi_select" || field.dataType === "checkbox") {
      if (optionCode) {
        return `factor(character(0), levels = cl_cl_ny_levels, labels = cl_cl_ny_labels)`;
      }
      return `character(0)`;
    }
    switch (field.dataType) {
      case "integer":
        return `integer(0)`;
      case "number":
      case "calculated":
      case "vas_scale":
      case "nrs_scale":
        return `numeric(0)`;
      case "date":
      case "partial_date":
      case "precision_date":
        return `as.Date(character(0))`;
      case "datetime":
        return `as.POSIXct(character(0), tz = "UTC")`;
      case "single_select":
      case "radio":
        if (hasCodelist) {
          const safeName = sanitizeRName(
            codelist!.id || codelist!.name
          ).toLowerCase();
          return `factor(character(0), levels = cl_${safeName}_levels, labels = cl_${safeName}_labels)`;
        }
        return `character(0)`;
      default:
        return `character(0)`;
    }
  }

  const rawValues = rows.map((r) => r.values[field.id]);

  if (field.dataType === "multi_select" || field.dataType === "checkbox") {
    if (optionCode) {
      const encoded = rawValues
        .map((raw) =>
          raw === null || raw === undefined || raw === ""
            ? "NA_character_"
            : `"${escapeRString(parseMultiSelectValue(String(raw), optionCode))}"`
        )
        .join(", ");
      return `factor(c(${encoded}), levels = cl_cl_ny_levels, labels = cl_cl_ny_labels)`;
    }
    const encoded = rawValues
      .map((raw) => {
        if (raw === null || raw === undefined || raw === "") {
          return "NA_character_";
        }
        if (raw === true || raw === "true" || raw === "Y") return `"Y"`;
        if (raw === false || raw === "false" || raw === "N") return `"N"`;
        return `"${escapeRString(String(raw))}"`;
      })
      .join(", ");
    return `c(${encoded})`;
  }

  switch (field.dataType) {
    case "integer": {
      const encoded = rawValues
        .map((raw) => {
          if (raw === null || raw === undefined || raw === "") {
            return "NA_integer_";
          }
          const num = Number(raw);
          return Number.isFinite(num) ? String(Math.trunc(num)) : "NA_integer_";
        })
        .join(", ");
      return `as.integer(c(${encoded}))`;
    }

    case "number":
    case "calculated":
    case "vas_scale":
    case "nrs_scale": {
      const encoded = rawValues
        .map((raw) => {
          if (raw === null || raw === undefined || raw === "") {
            return "NA_real_";
          }
          const num = Number(raw);
          return Number.isFinite(num) ? String(num) : "NA_real_";
        })
        .join(", ");
      return `c(${encoded})`;
    }

    case "date":
    case "partial_date":
    case "precision_date": {
      const presentStrings = rawValues
        .filter((raw) => raw !== null && raw !== undefined && raw !== "")
        .map((raw) => String(raw));
      const allFullIso = presentStrings.every((s) =>
        /^\d{4}-\d{2}-\d{2}$/.test(s)
      );
      const encoded = rawValues
        .map((raw) =>
          raw === null || raw === undefined || raw === ""
            ? "NA_character_"
            : `"${escapeRString(String(raw))}"`
        )
        .join(", ");
      return allFullIso ? `as.Date(c(${encoded}))` : `c(${encoded})`;
    }

    case "datetime": {
      const encoded = rawValues
        .map((raw) => {
          if (raw === null || raw === undefined || raw === "") {
            return "NA_character_";
          }
          const normalized = String(raw).replace("T", " ").replace(/Z$/, "");
          return `"${escapeRString(normalized)}"`;
        })
        .join(", ");
      return `as.POSIXct(c(${encoded}), tz = "UTC")`;
    }

    case "single_select":
    case "radio": {
      const encoded = rawValues
        .map((raw) =>
          raw === null || raw === undefined || raw === ""
            ? "NA_character_"
            : `"${escapeRString(String(raw))}"`
        )
        .join(", ");
      if (hasCodelist) {
        const safeName = sanitizeRName(
          codelist!.id || codelist!.name
        ).toLowerCase();
        return `factor(c(${encoded}), levels = cl_${safeName}_levels, labels = cl_${safeName}_labels)`;
      }
      return `c(${encoded})`;
    }

    default: {
      const encoded = rawValues
        .map((raw) =>
          raw === null || raw === undefined || raw === ""
            ? "NA_character_"
            : `"${escapeRString(typeof raw === "object" ? JSON.stringify(raw) : String(raw))}"`
        )
        .join(", ");
      return `c(${encoded})`;
    }
  }
}

function renderRDataStepForForm(
  form: CRFForm,
  context: PreparedExportContext,
  options?: ExportROptions
): string {
  const { study } = context;
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
    const expanded = expandRFieldsWithOptions(
      field,
      resolveFieldOptions(context, field),
      usedNames
    );
    expanded.forEach((item) => expandedFields.push(item));
  });

  let code = `#------------------------------------------------------------------------------
# DATASET:      ${tibbleName}
# FORM:         ${escapeRString(form.name)} [Domain: ${domain.toUpperCase()}]
# DESCRIPTION:  CDASH Tibble Scaffolding with Variable Labels & Factor Levels
#------------------------------------------------------------------------------\n`;

  const useLiveSimulation = hasSimulationRecords(study);
  const liveRows = useLiveSimulation
    ? extractCapturedFormRows(form, study)
    : [];

  const visitNames =
    study.visits && study.visits.length > 0
      ? study.visits.map((v) => `"${escapeRString(v.name)}"`)
      : ['"Screening"', '"Visit 1 (Day 1)"', '"Visit 2 (Day 28)"'];

  code += `${tibbleName} <- tibble::tibble(\n`;
  code += `  # Standard Clinical Trial Identifiers\n`;

  if (useLiveSimulation) {
    if (!includeSample || liveRows.length === 0) {
      code += `  STUDYID   = character(0),\n`;
      code += `  DOMAIN    = character(0),\n`;
      code += `  USUBJID   = character(0),\n`;
      code += `  VISIT     = character(0),\n`;
      code += `  VISITNUM  = integer(0),\n`;
      code += `  DTC_INIT  = as.Date(character(0)),\n`;
    } else {
      const n = liveRows.length;
      const usubjids = liveRows
        .map((r) => `"${escapeRString(r.subjectId)}"`)
        .join(", ");
      const visitsVec = liveRows
        .map((r) => `"${escapeRString(r.visitName)}"`)
        .join(", ");
      const visitNums = liveRows.map((r) => r.visitNum).join(", ");
      const dtcs = liveRows
        .map((r) => `"${escapeRString(r.dtcInit)}"`)
        .join(", ");
      code += `  STUDYID   = rep("${escapeRString(study.protocolNumber)}", ${n}),\n`;
      code += `  DOMAIN    = rep("${domain.toUpperCase()}", ${n}),\n`;
      code += `  USUBJID   = c(${usubjids}),\n`;
      code += `  VISIT     = c(${visitsVec}),\n`;
      code += `  VISITNUM  = as.integer(c(${visitNums})),\n`;
      code += `  DTC_INIT  = as.Date(c(${dtcs})),\n`;
    }
  } else {
    code += `  STUDYID   = rep("${escapeRString(study.protocolNumber)}", 3),\n`;
    code += `  DOMAIN    = rep("${domain.toUpperCase()}", 3),\n`;
    code += `  USUBJID   = c("101-1001", "101-1002", "101-1003"),\n`;
    code += `  VISIT     = c(${visitNames.slice(0, 3).join(", ")}),\n`;
    code += `  VISITNUM  = c(1, 2, 3),\n`;
    code += `  DTC_INIT  = as.Date(c("2026-03-01", "2026-03-02", "2026-03-03")),\n`;
  }

  if (expandedFields.length > 0) {
    code += `\n  # Form Specific CDASH Fields\n`;
    expandedFields.forEach((item, fIdx) => {
      const colCode = !includeSample
        ? "character(0)"
        : useLiveSimulation
          ? getRLiveColumnCode(item, liveRows, context)
          : item.field.dataType === "multi_select" ||
              item.field.dataType === "checkbox"
            ? getRSubVarSampleCode(item.optionCode, 3)
            : getRSampleColumnCode(item.field, context, 3);
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
      const baseLabel =
        item.field.cdashMetadata?.cdashLabel ||
        item.field.label ||
        item.varName;
      const fullLabel = item.optLabel
        ? `${baseLabel} - ${item.optLabel}`
        : baseLabel;
      const escapedLabel = escapeRString(fullLabel);
      const isLast = fIdx === expandedFields.length - 1;
      code += `    ${item.varName.padEnd(10)} = "${escapedLabel}"${isLast ? "" : ",\n"}`;
    });
    code += `\n  )\n} else {\n`;
    code += `  # Fallback to base R attributes\n`;
    expandedFields.forEach((item) => {
      const baseLabel =
        item.field.cdashMetadata?.cdashLabel ||
        item.field.label ||
        item.varName;
      const fullLabel = item.optLabel
        ? `${baseLabel} - ${item.optLabel}`
        : baseLabel;
      const escapedLabel = escapeRString(fullLabel);
      code += `  attr(${tibbleName}$${item.varName}, "label") <- "${escapedLabel}"\n`;
    });
    code += `}\n\n`;
  } else {
    expandedFields.forEach((item) => {
      const baseLabel =
        item.field.cdashMetadata?.cdashLabel ||
        item.field.label ||
        item.varName;
      const fullLabel = item.optLabel
        ? `${baseLabel} - ${item.optLabel}`
        : baseLabel;
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
 * Generates an R tibble construction and variable labeling block for a CRFForm.
 */
export function generateRDataStepForForm(
  form: CRFForm,
  study: StudyProtocol,
  options?: ExportROptions
): string {
  const context = prepareExportContext(study, { forms: [form] });
  return renderRDataStepForForm(form, context, options);
}

/**
 * Exports a single form as a self-contained R script.
 */
export function exportFormToR(
  form: CRFForm,
  study: StudyProtocol,
  options?: ExportROptions
): string {
  const context = prepareExportContext(study, { forms: [form] });
  let output = generateRHeader(study, form.domain || form.id);
  output += renderRCodelists(context);
  output += renderRDataStepForForm(form, context, options);
  output += `# Schedule Consultation: ${consultationUrl()}\n`;
  return output;
}

/**
 * Exports all forms in a study into a complete R Pharmaverse Suite.
 */
export function exportStudyToR(
  study: StudyProtocol,
  options?: ExportROptions
): string {
  const context = prepareExportContext(study, options);
  const formsToExport = context.forms;

  if (formsToExport.length === 0) {
    return (
      generateRHeader(study) +
      `# No forms selected or available in study\n# Schedule Consultation: ${consultationUrl()}\n`
    );
  }

  let output = generateRHeader(study, context.headerScope);
  output += renderRCodelists(context);

  formsToExport.forEach((form, idx) => {
    output += `#==============================================================================
# SECTION ${idx + 1}: ${form.name.toUpperCase()} (DOMAIN: ${(form.domain || form.id).toUpperCase()})
#==============================================================================\n`;
    output += renderRDataStepForForm(form, context, options);
  });

  output += `# Schedule Consultation: ${consultationUrl()}\n`;
  return output;
}
