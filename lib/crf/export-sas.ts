/**
 * Automated SAS Export Script Generator for CRF Studio
 * Generates CDASH-compliant SAS programs (.sas) including:
 * 1. Comprehensive Header Metadata & Study Specifications
 * 2. PROC FORMAT libraries for NCI Thesaurus & Custom Codelists
 * 3. Modular DATA steps per Form/Domain with explicit ATTRIB definitions
 * 4. Synthetic Clinical Test Records for immediate validation
 * 5. Diagnostic PROC CONTENTS, PROC FREQ, and PROC PRINT steps
 */

import {
  StudyProtocol,
  CRFForm,
  CRFField,
  CodelistDefinition,
  ExportSasOptions,
  CodelistOption,
} from "./types";
import { STANDARD_CODELISTS } from "./cdisc-controlled-terminology";

/**
 * Sanitizes a string into a valid SAS variable or dataset name.
 * - Maximum 32 characters
 * - Must start with letter or underscore
 * - May contain letters, numbers, underscores
 * - Converted to uppercase
 */
export function sanitizeSasName(name: string, maxLength = 32): string {
  if (!name) return "VAR";
  let cleaned = name.trim().replace(/[^A-Za-z0-9_]/g, "_");
  if (!/^[A-Za-z_]/.test(cleaned)) {
    cleaned = `V_${cleaned}`;
  }
  return cleaned.substring(0, maxLength).toUpperCase();
}

/**
 * Formats a format name for PROC FORMAT.
 * Character formats start with $, numeric do not.
 */
export function getSasFormatName(
  codelistIdOrName: string,
  isCharacter: boolean
): string {
  const base = sanitizeSasName(codelistIdOrName.replace(/^CL_/, ""), 28);
  const suffix = "F";
  const name = `${base}${suffix}`;
  return isCharacter ? `$${name}` : name;
}

/**
 * Escapes single quotes for SAS string literals.
 */
export function escapeSasString(text: string): string {
  if (!text) return "";
  return text.replace(/'/g, "''");
}

/**
 * Retrieves field options from custom options or referenced codelists.
 */
export function getFieldOptions(
  field: CRFField,
  study: StudyProtocol
): CodelistOption[] {
  if (field.customOptions && field.customOptions.length > 0) {
    return field.customOptions;
  }
  if (field.codelistId) {
    const cl =
      study.codelists?.find((c) => c.id === field.codelistId) ||
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
  if (edcValue === null || edcValue === undefined || edcValue === false)
    return "N";
  if (edcValue === true) return "Y";
  let selectedCodes: string[] = [];
  if (Array.isArray(edcValue)) {
    selectedCodes = edcValue.map((s) => String(s).trim().toUpperCase());
  } else if (typeof edcValue === "string") {
    const trimmed = edcValue.trim().toUpperCase();
    if (
      trimmed === "TRUE" ||
      trimmed === "1" ||
      trimmed === "Y" ||
      trimmed === "YES"
    ) {
      const targetUpper = String(optionCode).trim().toUpperCase();
      if (
        targetUpper === "Y" ||
        targetUpper === "1" ||
        targetUpper === "YES" ||
        targetUpper === "TRUE"
      ) {
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
 * Generates a unique SAS variable name guaranteed not to collide with usedNames and within maxLength.
 */
function generateUniqueSasName(
  baseName: string,
  usedNames: Set<string>,
  maxLength = 32
): string {
  let counter = 1;
  const sanitizedBase = sanitizeSasName(baseName, maxLength);
  let candidate = sanitizedBase;
  while (usedNames.has(candidate)) {
    const suffix = `_${counter}`;
    const maxPrefixLen = maxLength - suffix.length;
    candidate = `${sanitizedBase.substring(0, maxPrefixLen)}${suffix}`;
    counter++;
  }
  return candidate;
}

/**
 * Determines if a codelist contains strictly numeric codes.
 */
function isNumericCodelist(codelist: CodelistDefinition): boolean {
  if (!codelist.options || codelist.options.length === 0) return false;
  return codelist.options.every(
    (opt) => !isNaN(Number(opt.code)) && opt.code.trim() !== ""
  );
}

/**
 * Maps a ClinicalDataType to SAS Variable Attributes (Type, Length, Format, Informat).
 */
export interface SasFieldAttributes {
  sasVarName: string;
  isNumeric: boolean;
  length: string;
  label: string;
  format?: string;
  informat?: string;
  codelistRef?: CodelistDefinition;
}

export interface ExpandedSasField {
  field: CRFField;
  attrs: SasFieldAttributes;
  optionCode?: string;
}

export function getFieldSasAttributes(
  field: CRFField,
  study: StudyProtocol
): SasFieldAttributes {
  const sasVarName = sanitizeSasName(field.variableName || field.id);
  const label = escapeSasString(
    field.cdashMetadata?.cdashLabel || field.label || sasVarName
  );

  // Check for codelist
  const codelist = study.codelists?.find((c) => c.id === field.codelistId);
  const hasCodelist = !!codelist && codelist.options.length > 0;

  switch (field.dataType) {
    case "integer":
    case "number":
    case "calculated":
    case "vas_scale":
    case "nrs_scale":
      return {
        sasVarName,
        isNumeric: true,
        length: "8",
        label,
        format: "BEST12.",
        informat: "BEST12.",
      };

    case "date":
    case "partial_date":
    case "precision_date":
      return {
        sasVarName,
        isNumeric: false,
        length: "$10",
        label,
        format: "$10.",
        informat: "$10.",
      };

    case "time":
      return {
        sasVarName,
        isNumeric: false,
        length: "$8",
        label,
        format: "$8.",
        informat: "$8.",
      };

    case "datetime":
      return {
        sasVarName,
        isNumeric: false,
        length: "$19",
        label,
        format: "$19.",
        informat: "$19.",
      };

    case "textarea":
      return {
        sasVarName,
        isNumeric: false,
        length: "$2000",
        label,
        format: "$2000.",
        informat: "$2000.",
      };

    case "signature":
      return {
        sasVarName,
        isNumeric: false,
        length: "$64",
        label,
        format: "$64.",
        informat: "$64.",
      };

    case "single_select":
    case "radio":
      if (hasCodelist) {
        const isNum = isNumericCodelist(codelist!);
        const formatName = getSasFormatName(
          codelist!.id || codelist!.name,
          !isNum
        );
        return {
          sasVarName,
          isNumeric: isNum,
          length: isNum ? "8" : "$40",
          label,
          format: `${formatName}.`,
          informat: isNum ? "BEST12." : "$40.",
          codelistRef: codelist,
        };
      }
      return {
        sasVarName,
        isNumeric: false,
        length: "$40",
        label,
        format: "$40.",
        informat: "$40.",
      };

    case "multi_select":
    case "checkbox":
      const nyCodelist = STANDARD_CODELISTS.find((c) => c.id === "CL_NY");
      return {
        sasVarName,
        isNumeric: false,
        length: "$1",
        label,
        format: "$NYF.",
        informat: "$1.",
        codelistRef: nyCodelist,
      };

    case "repeating_table":
    case "text":
    default:
      return {
        sasVarName,
        isNumeric: false,
        length: "$200",
        label,
        format: "$200.",
        informat: "$200.",
      };
  }
}

/**
 * Expands fields, converting multi_select and checkbox fields into individual dichotomous sub-variables.
 */
export function getExpandedSasAttributes(
  field: CRFField,
  study: StudyProtocol,
  usedNames = new Set<string>()
): ExpandedSasField[] {
  if (field.dataType !== "multi_select" && field.dataType !== "checkbox") {
    const attrs = getFieldSasAttributes(field, study);
    let sasVarName = attrs.sasVarName;
    if (usedNames.has(sasVarName)) {
      sasVarName = generateUniqueSasName(sasVarName, usedNames, 32);
      attrs.sasVarName = sasVarName;
    }
    usedNames.add(sasVarName);
    return [{ field, attrs }];
  }

  const options = getFieldOptions(field, study);
  const baseVar = sanitizeSasName(field.variableName || field.id);
  const fieldLabel = field.cdashMetadata?.cdashLabel || field.label || baseVar;
  const nyCodelist = STANDARD_CODELISTS.find((c) => c.id === "CL_NY");

  if (options.length === 0) {
    let sasVarName = baseVar;
    if (usedNames.has(sasVarName)) {
      sasVarName = generateUniqueSasName(sasVarName, usedNames, 32);
    }
    usedNames.add(sasVarName);
    return [
      {
        field,
        attrs: {
          sasVarName,
          isNumeric: false,
          length: "$1",
          label: escapeSasString(fieldLabel),
          format: "$NYF.",
          informat: "$1.",
          codelistRef: nyCodelist,
        },
      },
    ];
  }

  const result: ExpandedSasField[] = [];
  options.forEach((opt) => {
    const rawName = `${baseVar}_${opt.code}`;
    let subVarName = sanitizeSasName(rawName, 32);
    if (usedNames.has(subVarName)) {
      subVarName = generateUniqueSasName(rawName, usedNames, 32);
    }
    usedNames.add(subVarName);

    const optLabel = opt.label || opt.code;
    const combinedLabel = `${fieldLabel} - ${optLabel}`;

    result.push({
      field,
      optionCode: opt.code,
      attrs: {
        sasVarName: subVarName,
        isNumeric: false,
        length: "$1",
        label: escapeSasString(combinedLabel),
        format: "$NYF.",
        informat: "$1.",
        codelistRef: nyCodelist,
      },
    });
  });

  return result;
}

/**
 * Generates SAS Header Comments.
 */
function generateSasHeader(study: StudyProtocol, formScope?: string): string {
  const timestamp = new Date().toISOString();
  return `/*=============================================================================
  PROGRAM:      create_raw_${formScope ? formScope.toLowerCase() : "datasets"}.sas
  STUDY:        ${escapeSasString(study.protocolNumber)} (${escapeSasString(study.studyName)})
  SPONSOR:      ${escapeSasString(study.sponsor)}
  PHASE:        ${escapeSasString(study.phase)} | THERAPEUTIC AREA: ${escapeSasString(study.therapeuticArea)}
  GENERATED:    ${timestamp}
  STANDARD:     CDISC CDASH v2.2 / SDTM-IG v3.4 Conformance
  DESCRIPTION:  Automated SAS dataset creation program with PROC FORMAT dictionaries,
                explicit ATTRIB specifications, synthetic test records, and
                PROC CONTENTS/FREQ data integrity validation.
  AUTHOR:       CRF Studio Automated Statistical Exporter
  CONSULTATION: Schedule Consultation: /schedule
=============================================================================*/

OPTIONS NODATE NONUMBER LS=132 PS=60 NOFMTERR;
TITLE1 "Study ${escapeSasString(study.protocolNumber)} - Clinical Data Acquisition";
`;
}

/**
 * Generates PROC FORMAT library for study codelists.
 */
export function generateSasProcFormat(
  study: StudyProtocol,
  formsToInclude: CRFForm[]
): string {
  // Collect all unique codelists referenced in the included forms or defined in the study
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
    return `/* No codelists defined for this study */\n\n`;
  }

  const allAvailableCodelists = [...userCodelists];
  if (
    hasMultiOrCheckbox &&
    !allAvailableCodelists.some((c) => c.id === "CL_NY")
  ) {
    const ny = STANDARD_CODELISTS.find((c) => c.id === "CL_NY");
    if (ny) allAvailableCodelists.push(ny);
  }

  const relevantCodelists = allAvailableCodelists.filter(
    (cl) =>
      referencedCodelistIds.has(cl.id) ||
      (hasMultiOrCheckbox && cl.id === "CL_NY") ||
      cl.isStandard
  );

  if (relevantCodelists.length === 0) {
    return `/* No codelists defined for this study */\n\n`;
  }

  let output = `/*-----------------------------------------------------------------------------
  STEP 1: PROC FORMAT - Clinical Terminology & Codelist Formats
-----------------------------------------------------------------------------*/\n`;
  output += `PROC FORMAT;\n`;

  relevantCodelists.forEach((cl) => {
    if (!cl.options || cl.options.length === 0) return;
    const isNum = isNumericCodelist(cl);
    const fmtName = getSasFormatName(cl.id || cl.name, !isNum);
    const nciComment = cl.nciCodelistCode
      ? ` | NCI Codelist: ${cl.nciCodelistCode}`
      : "";

    output += `  /* Codelist: ${escapeSasString(cl.name)}${nciComment} */\n`;
    output += `  VALUE ${fmtName}\n`;

    cl.options.forEach((opt) => {
      const escapedLabel = escapeSasString(opt.label);
      if (isNum) {
        output += `    ${opt.code} = '${escapedLabel}'\n`;
      } else {
        const escapedCode = escapeSasString(opt.code);
        output += `    '${escapedCode}' = '${escapedLabel}'\n`;
      }
    });

    if (isNum) {
      output += `    . = 'Missing / Not Done'\n`;
      output += `    OTHER = 'Unknown / Unmapped';\n\n`;
    } else {
      output += `    ' ' = 'Missing / Not Done'\n`;
      output += `    OTHER = 'Unknown / Unmapped';\n\n`;
    }
  });

  output += `RUN;\n\n`;
  return output;
}

/**
 * Generates synthetic clinical mock data records for testing.
 */
function generateSyntheticMockData(
  form: CRFForm,
  fieldsWithAttrs: ExpandedSasField[],
  study: StudyProtocol,
  rowCount = 3
): string {
  const rows: string[][] = [];

  const visitNames =
    study.visits && study.visits.length > 0
      ? study.visits.map((v) => v.name)
      : ["Screening", "Visit 1 (Day 1)", "Visit 2 (Day 28)"];

  for (let i = 1; i <= rowCount; i++) {
    const subjid = `101-${1000 + i}`;
    const visit = visitNames[(i - 1) % visitNames.length];
    const visitNum = ((i - 1) % visitNames.length) + 1;

    const rowValues: string[] = [
      study.protocolNumber || "STUDY01",
      (form.domain || "CRF").toUpperCase(),
      subjid,
      visit,
      String(visitNum),
      "2026-03-15",
    ];

    fieldsWithAttrs.forEach(({ field, attrs, optionCode }, idx) => {
      if (field.dataType === "multi_select" || field.dataType === "checkbox") {
        const charVal = optionCode ? optionCode.charCodeAt(0) : idx;
        const isYes = (i + charVal) % 2 === 1;
        rowValues.push(isYes ? "Y" : "N");
      } else if (
        field.dataType === "number" ||
        field.dataType === "integer" ||
        field.dataType === "calculated"
      ) {
        if (field.minValue !== undefined && field.maxValue !== undefined) {
          const val = Math.round(
            field.minValue +
              ((field.maxValue - field.minValue) * i) / (rowCount + 1)
          );
          rowValues.push(String(val));
        } else if (
          attrs.sasVarName.includes("AGE") ||
          attrs.sasVarName.includes("YEAR")
        ) {
          rowValues.push(String(45 + i * 5));
        } else if (
          attrs.sasVarName.includes("WEIGHT") ||
          attrs.sasVarName.includes("WT")
        ) {
          rowValues.push(String(70 + i * 3));
        } else if (
          attrs.sasVarName.includes("HEIGHT") ||
          attrs.sasVarName.includes("HT")
        ) {
          rowValues.push(String(170 + i));
        } else if (
          attrs.sasVarName.includes("SYS") ||
          attrs.sasVarName.includes("DIAS")
        ) {
          rowValues.push(String(120 + i * 2));
        } else {
          rowValues.push(String(10 * i));
        }
      } else if (
        field.dataType === "date" ||
        field.dataType === "partial_date" ||
        field.dataType === "precision_date"
      ) {
        rowValues.push(`2026-03-0${i}`);
      } else if (field.dataType === "time") {
        rowValues.push(`08:3${i}:00`);
      } else if (field.dataType === "datetime") {
        rowValues.push(`2026-03-0${i}T08:30:00`);
      } else if (attrs.codelistRef && attrs.codelistRef.options.length > 0) {
        const opt =
          attrs.codelistRef.options[(i - 1) % attrs.codelistRef.options.length];
        rowValues.push(opt.code);
      } else if (
        field.dataType === "vas_scale" ||
        field.dataType === "nrs_scale"
      ) {
        rowValues.push(String(i * 2));
      } else {
        rowValues.push(`TEST_${attrs.sasVarName}_${i}`);
      }
    });

    rows.push(rowValues);
  }

  // Format as DATALINES with DSD CSV
  let datalinesStr = `  CARDS;\n`;
  rows.forEach((row) => {
    const formattedRow = row
      .map((val) => {
        const strVal = String(val ?? "");
        if (
          strVal.includes(",") ||
          strVal.includes(" ") ||
          strVal.includes("'")
        ) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      })
      .join(",");
    datalinesStr += `${formattedRow}\n`;
  });
  datalinesStr += `;\n`;

  return datalinesStr;
}

/**
 * Generates a SAS DATA Step for a specific CRFForm.
 */
export function generateSasDataStepForForm(
  form: CRFForm,
  study: StudyProtocol,
  options?: ExportSasOptions
): string {
  const domain = sanitizeSasName(form.domain || form.id, 20);
  const prefix = options?.datasetPrefix || "raw_";
  const datasetName = `${prefix}${domain.toLowerCase()}`;
  const includeSample = options?.includeSampleData !== false;
  const includeProcContents = options?.includeProcContents !== false;
  const includeProcFreq = options?.includeProcFreq !== false;

  // Flatten fields in section order and expand multi_select / checkbox fields
  const fields = form.sections.flatMap((s) => s.fields);
  const usedNames = new Set<string>([
    "STUDYID",
    "DOMAIN",
    "USUBJID",
    "VISIT",
    "VISITNUM",
    "DTC_INIT",
  ]);

  const fieldsWithAttrs: ExpandedSasField[] = [];
  fields.forEach((field) => {
    const expanded = getExpandedSasAttributes(field, study, usedNames);
    expanded.forEach((item) => fieldsWithAttrs.push(item));
  });

  let code = `/*-----------------------------------------------------------------------------
  DATASET:      ${datasetName}
  FORM:         ${escapeSasString(form.name)} [Domain: ${domain}]
  DESCRIPTION:  CDASH Ingestion & Attribute Assignment Step
-----------------------------------------------------------------------------*/\n`;

  code += `DATA ${datasetName} (LABEL="CDASH Raw - ${escapeSasString(form.name)}");\n`;

  // Standard Header Identifiers ATTRIB
  code += `  /* Standard Clinical Identifiers */\n`;
  code += `  ATTRIB\n`;
  code += `    STUDYID   LENGTH=$40   LABEL="Study Identifier"               FORMAT=$40.\n`;
  code += `    DOMAIN    LENGTH=$8    LABEL="Domain Abbreviation"            FORMAT=$8.\n`;
  code += `    USUBJID   LENGTH=$50   LABEL="Unique Subject Identifier"      FORMAT=$50.\n`;
  code += `    VISIT     LENGTH=$40   LABEL="Visit Name"                     FORMAT=$40.\n`;
  code += `    VISITNUM  LENGTH=8     LABEL="Visit Number"                   FORMAT=BEST12.\n`;
  code += `    DTC_INIT  LENGTH=$10   LABEL="Form Initiation Date (ISO 8601)" FORMAT=$10.\n`;

  // Form Fields ATTRIB
  if (fieldsWithAttrs.length > 0) {
    code += `  /* Form Specific CDASH Variable Attributes */\n`;
    fieldsWithAttrs.forEach(({ attrs, field }) => {
      const formatStr = attrs.format ? ` FORMAT=${attrs.format}` : "";
      const informatStr = attrs.informat ? ` INFORMAT=${attrs.informat}` : "";
      const sdtmComment = field.cdashMetadata?.sdtmVariable
        ? ` /* Mapped to SDTM ${field.cdashMetadata.domain}.${field.cdashMetadata.sdtmVariable} */`
        : "";
      code += `    ${attrs.sasVarName.padEnd(10)} LENGTH=${attrs.length.padEnd(6)} LABEL="${attrs.label}"${formatStr}${informatStr};${sdtmComment}\n`;
    });
  }

  code += `  ;\n\n`;

  if (includeSample) {
    // Variable list for INPUT
    const allInputVars = [
      "STUDYID $",
      "DOMAIN $",
      "USUBJID $",
      "VISIT $",
      "VISITNUM",
      "DTC_INIT $",
      ...fieldsWithAttrs.map(({ attrs }) =>
        attrs.isNumeric ? attrs.sasVarName : `${attrs.sasVarName} $`
      ),
    ];

    code += `  /* Ingestion from Delimited Source / EDC Transfer */\n`;
    code += `  INFILE DATALINES DSD DLM=',' TRUNCOVER;\n`;
    code += `  INPUT\n    ${allInputVars.join("\n    ")};\n\n`;
    code += generateSyntheticMockData(form, fieldsWithAttrs, study, 3);
  }

  code += `RUN;\n\n`;

  // Validation Procedures
  if (includeProcContents) {
    code += `/* Variable Metadata Specification Audit */\n`;
    code += `PROC CONTENTS DATA=${datasetName} ORDER=VARNUM;\n`;
    code += `  TITLE2 "Variable Directory & Structural Attributes - ${datasetName}";\n`;
    code += `RUN;\n\n`;
  }

  if (includeProcFreq) {
    const categoricalVars = fieldsWithAttrs
      .filter(
        ({ attrs }) =>
          attrs.codelistRef || (attrs.format && attrs.format.includes("F."))
      )
      .map(({ attrs }) => attrs.sasVarName);

    if (categoricalVars.length > 0) {
      code += `/* Categorical Frequency Validation */\n`;
      code += `PROC FREQ DATA=${datasetName};\n`;
      code += `  TABLES ${categoricalVars.join(" ")} / MISSING;\n`;
      code += `  TITLE2 "Codelist Categorical Distribution - ${datasetName}";\n`;
      code += `RUN;\n\n`;
    }
  }

  return code;
}

/**
 * Exports a single form as a self-contained SAS program.
 */
export function exportFormToSas(
  form: CRFForm,
  study: StudyProtocol,
  options?: ExportSasOptions
): string {
  let output = generateSasHeader(study, form.domain || form.id);
  output += generateSasProcFormat(study, [form]);
  output += generateSasDataStepForForm(form, study, options);
  output += `/* Schedule Consultation: /schedule */\n`;
  return output;
}

/**
 * Exports all forms in a study into a complete SAS Clinical Program Suite.
 */
export function exportStudyToSas(
  study: StudyProtocol,
  options?: ExportSasOptions
): string {
  const formsToExport = options?.selectedFormId
    ? study.forms.filter((f) => f.id === options.selectedFormId)
    : study.forms;

  if (formsToExport.length === 0) {
    return (
      generateSasHeader(study) +
      `/* No forms selected or available in study */\n/* Schedule Consultation: /schedule */\n`
    );
  }

  let output = generateSasHeader(
    study,
    options?.selectedFormId
      ? formsToExport[0]?.domain || formsToExport[0]?.id
      : "suite"
  );
  output += generateSasProcFormat(study, formsToExport);

  formsToExport.forEach((form, idx) => {
    output += `/*=============================================================================
  SECTION ${idx + 1}: ${form.name.toUpperCase()} (DOMAIN: ${(form.domain || form.id).toUpperCase()})
=============================================================================*/\n`;
    output += generateSasDataStepForForm(form, study, options);
  });

  output += `/* Schedule Consultation: /schedule */\n`;
  return output;
}
