/**
 * CSV Study Specification Parser
 * Converts structured CSV study specification rows into CRF Studio StudyProtocol.
 * Requires explicit REDCap or CDISC header schemas without positional column fallbacks.
 */

import {
  StudyProtocol,
  CRFForm,
  CRFSection,
  CRFField,
  ClinicalDataType,
  CdashVariableMetadata,
} from "../types";
import {
  isRedcapHeader,
  isRedcapCsv,
  detectCsvDialect,
  importStudyFromRedcapCsv,
  parseCsvRows,
  parseRedcapCsvRows,
  stripBom,
  stripHtmlAndEntities,
  REQUIRED_REDCAP_HEADERS,
} from "./redcap-dictionary";

export {
  isRedcapHeader,
  isRedcapCsv,
  detectCsvDialect,
  importStudyFromRedcapCsv,
  stripHtmlAndEntities,
  REQUIRED_REDCAP_HEADERS,
};

const CDISC_DOMAIN_TOKENS = new Set([
  "domain",
  "sdtmdomain",
  "cdashdomain",
  "domaincode",
]);

const CDISC_FORM_TOKENS = new Set([
  "form",
  "formname",
  "crf",
  "crfform",
  "activity",
  "activityname",
  "dataset",
]);

const CDISC_VARIABLE_TOKENS = new Set([
  "variable",
  "variablecdash",
  "variablesdtm",
  "cdashvariable",
  "sdtmvariable",
  "variablename",
  "fieldname",
  "field",
  "item",
  "itemname",
  "itemoid",
]);

const CDISC_LABEL_TOKENS = new Set([
  "label",
  "fieldlabel",
  "cdashlabel",
  "sdtmlabel",
  "question",
  "questiontext",
  "prompt",
  "description",
]);

const CDISC_TYPE_TOKENS = new Set([
  "type",
  "datatype",
  "clinicaldatatype",
  "fieldtype",
  "odmdatatype",
]);

const CDISC_CORE_TOKENS = new Set([
  "core",
  "cdashcore",
  "req",
  "required",
  "mandatory",
]);

const CDISC_ACRF_TOKENS = new Set([
  "acrf",
  "acrfoverlaytag",
  "overlay",
  "overlaytag",
  "annotation",
  "sdtmannotation",
]);

function normalizeHeaderCell(cell: string): string {
  return (cell || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolveCdiscColumns(rawHeader: string[]) {
  const normalized = rawHeader.map(normalizeHeaderCell);

  const findCol = (allowed: Set<string>): number =>
    normalized.findIndex(
      (token, idx) =>
        rawHeader[idx].trim().length <= 48 &&
        token.length > 0 &&
        allowed.has(token)
    );

  return {
    domainIdx: findCol(CDISC_DOMAIN_TOKENS),
    formIdx: findCol(CDISC_FORM_TOKENS),
    varIdx: findCol(CDISC_VARIABLE_TOKENS),
    labelIdx: findCol(CDISC_LABEL_TOKENS),
    typeIdx: findCol(CDISC_TYPE_TOKENS),
    coreIdx: findCol(CDISC_CORE_TOKENS),
    acrfIdx: findCol(CDISC_ACRF_TOKENS),
  };
}

/**
 * Checks whether CSV header columns match an explicit CDISC CSV Study Specification schema.
 * Rejects prose, single-column text, REDCap dictionaries, and arbitrary CSV files.
 */
export function isCdiscCsvHeader(header: string[]): boolean {
  if (!header || !Array.isArray(header) || header.length < 3) {
    return false;
  }
  if (isRedcapHeader(header)) {
    return false;
  }
  const cols = resolveCdiscColumns(header);
  const hasDomainOrForm = cols.domainIdx !== -1 || cols.formIdx !== -1;
  const hasVariable = cols.varIdx !== -1;
  const hasMetadataCol =
    cols.labelIdx !== -1 || cols.typeIdx !== -1 || cols.coreIdx !== -1;
  return hasDomainOrForm && hasVariable && hasMetadataCol;
}

/**
 * Inspects a raw CSV string to determine whether it carries an explicit CDISC CSV Study Specification header.
 */
export function isCdiscSpecCsv(csvContent: string): boolean {
  if (!csvContent || typeof csvContent !== "string" || !csvContent.trim()) {
    return false;
  }
  const clean = stripBom(csvContent.trim());
  const rows = parseCsvRows(clean);
  if (rows.length === 0) return false;
  return isCdiscCsvHeader(rows[0]);
}

function deterministicSpecHash(rows: string[][]): string {
  let h = 0x811c9dc5;
  for (const row of rows) {
    for (const cell of row) {
      for (let i = 0; i < cell.length; i++) {
        h ^= cell.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      h ^= 0x2c;
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

function normalizeDataType(rawType: string): ClinicalDataType {
  const t = (rawType || "").toLowerCase();
  if (t.includes("integer") || t === "int") return "integer";
  if (
    t.includes("number") ||
    t.includes("float") ||
    t.includes("decimal") ||
    t === "num"
  )
    return "number";
  if (t.includes("partial") && t.includes("date")) return "partial_date";
  if (t.includes("datetime")) return "datetime";
  if (t.includes("date")) return "date";
  if (t.includes("time") && !t.includes("date")) return "time";
  if (t.includes("radio")) return "radio";
  if (t.includes("check")) return "checkbox";
  if (t.includes("select") || t.includes("dropdown") || t.includes("code"))
    return "single_select";
  if (t.includes("calc")) return "calculated";
  return "text";
}

export function parseCdiscCsvRows(rows: string[][]): StudyProtocol {
  if (!isCdiscCsvHeader(rows[0])) {
    throw new Error(
      "Invalid CSV specification: Missing explicit CDISC header columns (expected Domain/Form, Variable, and Label/Type)"
    );
  }

  const { domainIdx, formIdx, varIdx, labelIdx, typeIdx, coreIdx, acrfIdx } =
    resolveCdiscColumns(rows[0]);

  const formsMap = new Map<
    string,
    { domain: string; name: string; fields: CRFField[] }
  >();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || row.every((c) => !c.trim())) continue;

    const domain = (
      (domainIdx !== -1 ? row[domainIdx] : "") || "GENERAL"
    ).toUpperCase();
    const formName = (formIdx !== -1 ? row[formIdx] : "") || `${domain} Form`;
    const variableName = (row[varIdx] || `VAR_${r}`).trim();
    const label = (labelIdx !== -1 ? row[labelIdx] : "") || variableName;
    const rawType = (typeIdx !== -1 ? row[typeIdx] : "") || "text";
    const coreVal = coreIdx !== -1 ? row[coreIdx] || "O" : "O";
    const acrfTag =
      acrfIdx !== -1 && row[acrfIdx]
        ? row[acrfIdx]
        : `${domain}.${variableName}`;

    const formKey = `${domain}_${formName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    if (!formsMap.has(formKey)) {
      formsMap.set(formKey, {
        domain,
        name: formName,
        fields: [],
      });
    }

    const formEntry = formsMap.get(formKey)!;
    const isRequired = /^(r|hr|required|yes|true|1)$/i.test(coreVal);

    const cdashMetadata: CdashVariableMetadata = {
      domain,
      sdtmVariable: variableName,
      cdashLabel: label,
      core: coreVal.toUpperCase() === "HR" ? "HR" : isRequired ? "R" : "O",
      acrfAnnotation: acrfTag || `${domain}.${variableName}`,
    };

    formEntry.fields.push({
      id: `fld_${variableName.toLowerCase().replace(/[^a-z0-9_]/g, "_")}_${r}`,
      variableName,
      label,
      dataType: normalizeDataType(rawType),
      columnSpan: 6,
      required: isRequired,
      cdashMetadata,
    });
  }

  if (formsMap.size === 0) {
    throw new Error(
      "Invalid CSV specification: No valid data rows found under header"
    );
  }

  const forms: CRFForm[] = Array.from(formsMap.entries()).map(
    ([key, entry], idx) => {
      const section: CRFSection = {
        id: `sec_${key}`,
        title: `${entry.name} Specifications`,
        fields: entry.fields,
      };

      return {
        id: `f_${entry.domain.toLowerCase()}_${idx + 1}`,
        name: entry.name,
        domain: entry.domain,
        description: `Imported from CSV Study Specification sheet for ${entry.name}`,
        version: "1.0",
        sections: [section],
        rules: [],
      };
    }
  );

  const allFormIds = forms.map((f) => f.id);
  const visits = [
    {
      id: "vis_screening",
      oid: "SE.SCREENING",
      name: "Screening Visit",
      visitType: "Scheduled" as const,
      targetDay: 0,
      windowBefore: 0,
      windowAfter: 0,
      assignedFormIds: allFormIds,
    },
    {
      id: "vis_baseline",
      oid: "SE.BASELINE",
      name: "Day 1 Baseline",
      visitType: "Scheduled" as const,
      targetDay: 1,
      windowBefore: 0,
      windowAfter: 0,
      assignedFormIds: allFormIds,
    },
  ];

  const protoNum = `CSV-SPEC-${deterministicSpecHash(rows)}`;

  return {
    id: `study_${protoNum.toLowerCase()}`,
    protocolNumber: protoNum,
    studyName: `CSV Study Specification (${forms.length} domains)`,
    phase: "Phase III",
    sponsor: "Sponsor",
    therapeuticArea: "General",
    version: "1.0",
    lastModified: "1970-01-01T00:00:00.000Z",
    forms,
    visits,
    codelists: [],
    provenance: {
      sourceFormat: "CSV Study Specification",
      sourceVersion: "1.0",
      importedBy: "Unverified Session",
    },
  };
}

/**
 * Imports a StudyProtocol from raw CSV content.
 * Requires an explicit Vanderbilt REDCap data dictionary header or CDISC CSV study specification header.
 */
export function importStudyFromCsvSpec(csvContent: string): StudyProtocol {
  if (!csvContent || typeof csvContent !== "string" || !csvContent.trim()) {
    throw new Error("Invalid CSV specification: Empty file content");
  }

  const clean = stripBom(csvContent.trim());
  const rows = parseCsvRows(clean);
  if (rows.length < 2) {
    throw new Error(
      "Invalid CSV specification: Insufficient rows (header and data required)"
    );
  }

  if (isRedcapHeader(rows[0])) {
    return parseRedcapCsvRows(rows);
  }

  if (isCdiscCsvHeader(rows[0])) {
    return parseCdiscCsvRows(rows);
  }

  throw new Error(
    "Invalid CSV specification: Unrecognized CSV header schema (expected REDCap Data Dictionary or CDISC Study Specification headers)"
  );
}
