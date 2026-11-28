import {
  AuditTrailEntry,
  ClinicalDataCsvKind,
  CRFField,
  CRFForm,
  EDCQuery,
  EdcSimulationState,
  ExportClinicalCsvOptions,
  StudyProtocol,
} from "../types";
import {
  discoverSimulationSubjects,
  parseSimulationFormValues,
} from "./simulation-records";
import { generateEngineId } from "./precision-date";

const CSV_FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;
const CSV_QUOTE_ESCAPED_TRIGGER_RE = /^'+[=+\-@\t\r]/;
const STRICT_NUMERIC_CSV_CELL_RE = /^-?\d+(\.\d+)?$/;

function neutralizeCsvFormulaTrigger(raw: string): string {
  if (raw.length === 0) {
    return raw;
  }
  if (
    (CSV_FORMULA_TRIGGER_RE.test(raw) &&
      !STRICT_NUMERIC_CSV_CELL_RE.test(raw)) ||
    CSV_QUOTE_ESCAPED_TRIGGER_RE.test(raw)
  ) {
    return `'${raw}`;
  }
  return raw;
}

function stripCsvFormulaPrefix(cell: string): string {
  if (CSV_QUOTE_ESCAPED_TRIGGER_RE.test(cell)) {
    return cell.slice(1);
  }
  return cell;
}

/**
 * Escapes a single cell value according to RFC 4180 and neutralizes leading
 * spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) per OWASP
 * CSV Injection (CWE-1236) guidance. Finite `number` values and strictly
 * numeric strings matching `/^-?\d+(\.\d+)?$/` (such as `-1.5`) remain
 * unprefixed, while strings already starting with one or more `'` characters
 * immediately followed by a trigger (`/^'+[=+\-@\t\r]/`, such as `'=x`) are
 * prefixed with an additional `'` so `parseRfc4180Csv` round-trips them
 * identically.
 */
export function escapeRfc4180Cell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  const str =
    typeof value === "number" && Number.isFinite(value)
      ? raw
      : neutralizeCsvFormulaTrigger(raw);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats a header and rows into an RFC 4180 CSV payload with CRLF line endings.
 */
export function formatRfc4180Csv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>
): string {
  const lines = [
    headers.map(escapeRfc4180Cell).join(","),
    ...rows.map((row) => row.map(escapeRfc4180Cell).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Parses an RFC 4180 CSV string (supporting embedded commas, escaped quotes,
 * embedded CRLF/LF newlines, optional UTF-8 BOM, and OWASP single-quote
 * formula-injection guards) into string rows.
 */
export function parseRfc4180Csv(csvText: string): string[][] {
  const cleaned = csvText.replace(/^\uFEFF/, "");
  if (!cleaned.trim()) {
    return [];
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      currentRow.push(stripCsvFormulaPrefix(currentCell));
      currentCell = "";
    } else if (ch === "\r") {
      if (cleaned[i + 1] === "\n") {
        i++;
      }
      currentRow.push(stripCsvFormulaPrefix(currentCell));
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
    } else if (ch === "\n") {
      currentRow.push(stripCsvFormulaPrefix(currentCell));
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += ch;
    }
  }

  if (inQuotes) {
    throw new Error("Invalid RFC 4180 CSV: unterminated quoted field.");
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(stripCsvFormulaPrefix(currentCell));
    rows.push(currentRow);
  }

  return rows.filter(
    (row, idx) => idx === 0 || row.some((cell) => cell.length > 0)
  );
}

const SUBJECTS_CSV_HEADERS = [
  "STUDYID",
  "SUBJECT_ID",
  "VISIT_ID",
  "VISIT_NAME",
  "FORM_ID",
  "DOMAIN",
  "FIELD_ID",
  "VARIABLE_NAME",
  "VALUE",
  "VALUE_TYPE",
  "SDV_VERIFIED",
  "SDV_AUDITED_BY",
  "SDV_TIMESTAMP",
  "FORM_LOCKED",
  "FORM_LOCKED_BY",
  "FORM_LOCKED_TIMESTAMP",
] as const;

const QUERIES_CSV_HEADERS = [
  "QUERY_ID",
  "SUBJECT_ID",
  "VISIT_ID",
  "FORM_ID",
  "FIELD_ID",
  "FIELD_NAME",
  "RULE_ID",
  "SEVERITY",
  "STATUS",
  "MESSAGE",
  "RAISED_BY",
  "RAISED_AT",
  "RESPONSE",
  "RESPONDED_BY",
  "RESPONDED_AT",
  "RESOLVED_BY",
  "RESOLVED_AT",
  "RESOLUTION_REASON",
] as const;

const AUDITS_CSV_HEADERS = [
  "AUDIT_ID",
  "TIMESTAMP",
  "SUBJECT_ID",
  "FORM_ID",
  "FIELD_ID",
  "FIELD_NAME",
  "PREVIOUS_VALUE",
  "PREVIOUS_VALUE_TYPE",
  "NEW_VALUE",
  "NEW_VALUE_TYPE",
  "CHANGED_BY",
  "USER_ROLE",
  "REASON_FOR_CHANGE",
  "ACTION_TYPE",
] as const;

function getPrimitiveTypeTag(
  value: unknown
): "null" | "number" | "boolean" | "json" | "string" {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "json";
  return "string";
}

function coerceTypedCell(
  raw: string,
  typeTag?: string,
  field?: CRFField
): string | number | boolean | null {
  if (typeTag === "null") return null;
  if (typeTag === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (typeTag === "boolean") {
    return raw === "true" || raw === "1";
  }
  if (!typeTag && field) {
    if (raw === "") return null;
    if (
      field.dataType === "number" ||
      field.dataType === "integer" ||
      field.dataType === "calculated" ||
      field.dataType === "vas_scale" ||
      field.dataType === "nrs_scale"
    ) {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
    if (field.dataType === "checkbox" && (raw === "true" || raw === "false")) {
      return raw === "true";
    }
  }
  return raw;
}

function coerceAuditValue(raw: string, typeTag?: string): unknown {
  if (typeTag === "null") return null;
  if (typeTag === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (typeTag === "boolean") {
    return raw === "true" || raw === "1";
  }
  if (typeTag === "json") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  if (!typeTag && raw === "") {
    return null;
  }
  return raw;
}

/**
 * Exports simulated subjects and captured form values to RFC 4180 CSV.
 */
export function exportSimulationSubjectsCsv(
  study: StudyProtocol,
  options?: ExportClinicalCsvOptions
): string {
  const sim = study.simulationState;
  const selectedFormId =
    options?.selectedFormId && options.selectedFormId !== "all"
      ? options.selectedFormId
      : undefined;

  const visitMap = new Map((study.visits || []).map((v) => [v.id, v]));
  const fieldLookup = new Map<string, { form: CRFForm; field: CRFField }>();
  for (const form of study.forms || []) {
    for (const sec of form.sections || []) {
      for (const field of sec.fields || []) {
        fieldLookup.set(field.id, { form, field });
      }
    }
  }

  const subjects = discoverSimulationSubjects(study, sim);
  const cells = parseSimulationFormValues(study, sim);
  const subjectsWithRows = new Set<string>();
  const rows: unknown[][] = [];

  for (const cell of cells) {
    const meta = fieldLookup.get(cell.fieldId);
    const resolvedFormId = cell.formId || meta?.form.id || "";
    if (selectedFormId && resolvedFormId !== selectedFormId) {
      continue;
    }

    subjectsWithRows.add(cell.subjectId);
    const visit = visitMap.get(cell.visitId);
    const sdv = sim?.sdvMap?.[cell.key];
    const lockKey = resolvedFormId
      ? `${cell.subjectId}_${cell.visitId}_${resolvedFormId}`
      : "";
    const lock = lockKey ? sim?.lockedForms?.[lockKey] : undefined;

    rows.push([
      study.protocolNumber || "",
      cell.subjectId,
      cell.visitId,
      visit?.name || cell.visitId,
      resolvedFormId,
      meta?.form.domain || "",
      cell.fieldId,
      meta?.field.variableName || cell.fieldId,
      cell.value === null ? "" : cell.value,
      getPrimitiveTypeTag(cell.value),
      sdv?.verified ? "true" : "",
      sdv?.auditedBy || "",
      sdv?.timestamp || "",
      lock?.locked ? "true" : "",
      lock?.lockedBy || "",
      lock?.timestamp || "",
    ]);
  }

  // Emit enrollment rows for subjects with no captured field rows yet so `availableSubjects` round-trips cleanly.
  if (!selectedFormId) {
    for (const subjectId of subjects) {
      if (!subjectsWithRows.has(subjectId)) {
        rows.push([
          study.protocolNumber || "",
          subjectId,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
      }
    }
  }

  return formatRfc4180Csv(SUBJECTS_CSV_HEADERS, rows);
}

/**
 * Exports simulated discrepancy queries to RFC 4180 CSV.
 */
export function exportSimulationQueriesCsv(
  study: StudyProtocol,
  options?: ExportClinicalCsvOptions
): string {
  const queries = study.simulationState?.queries || [];
  const selectedFormId =
    options?.selectedFormId && options.selectedFormId !== "all"
      ? options.selectedFormId
      : undefined;

  const filtered = selectedFormId
    ? queries.filter((q) => q.formId === selectedFormId)
    : queries;

  const rows = filtered.map((q) => [
    q.id,
    q.subjectId,
    q.visitId,
    q.formId,
    q.fieldId,
    q.fieldName,
    q.ruleId || "",
    q.severity,
    q.status,
    q.message,
    q.raisedBy,
    q.raisedAt,
    q.response || "",
    q.respondedBy || "",
    q.respondedAt || "",
    q.resolvedBy || "",
    q.resolvedAt || "",
    q.resolutionReason || "",
  ]);

  return formatRfc4180Csv(QUERIES_CSV_HEADERS, rows);
}

/**
 * Exports simulated EDC audit log entries to RFC 4180 CSV.
 */
export function exportSimulationAuditsCsv(
  study: StudyProtocol,
  options?: ExportClinicalCsvOptions
): string {
  const audits = study.simulationState?.auditLog || [];
  const selectedFormId =
    options?.selectedFormId && options.selectedFormId !== "all"
      ? options.selectedFormId
      : undefined;

  const filtered = selectedFormId
    ? audits.filter((a) => a.formId === selectedFormId)
    : audits;

  const rows = filtered.map((a) => [
    a.id,
    a.timestamp,
    a.subjectId || "",
    a.formId || "",
    a.fieldId || "",
    a.fieldName || "",
    a.previousValue === null || a.previousValue === undefined
      ? ""
      : a.previousValue,
    getPrimitiveTypeTag(a.previousValue),
    a.newValue === null || a.newValue === undefined ? "" : a.newValue,
    getPrimitiveTypeTag(a.newValue),
    a.changedBy,
    a.userRole || "",
    a.reasonForChange || "",
    a.actionType || "",
  ]);

  return formatRfc4180Csv(AUDITS_CSV_HEADERS, rows);
}

function buildHeaderIndex(headerRow: string[]): Map<string, number> {
  const index = new Map<string, number>();
  headerRow.forEach((col, i) => {
    const normalized = col
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
    if (!index.has(normalized)) {
      index.set(normalized, i);
    }
  });
  return index;
}

function readCol(
  row: string[],
  headerIndex: Map<string, number>,
  ...aliases: string[]
): string {
  for (const alias of aliases) {
    const idx = headerIndex.get(alias.toUpperCase());
    if (idx !== undefined && idx < row.length) {
      return row[idx];
    }
  }
  return "";
}

/**
 * Detects whether a CSV string represents simulated subjects, queries, or audits.
 */
export function detectClinicalCsvKind(
  csvText: string
): ClinicalDataCsvKind | null {
  const rows = parseRfc4180Csv(csvText);
  if (rows.length === 0) return null;
  const headerIndex = buildHeaderIndex(rows[0]);

  if (
    headerIndex.has("QUERY_ID") ||
    (headerIndex.has("MESSAGE") && headerIndex.has("RAISED_BY"))
  ) {
    return "queries";
  }
  if (
    headerIndex.has("AUDIT_ID") ||
    (headerIndex.has("CHANGED_BY") &&
      (headerIndex.has("REASON_FOR_CHANGE") ||
        headerIndex.has("PREVIOUS_VALUE") ||
        headerIndex.has("NEW_VALUE")))
  ) {
    return "audits";
  }
  if (headerIndex.has("SUBJECT_ID") || headerIndex.has("USUBJID")) {
    return "subjects";
  }
  return null;
}

/**
 * Imports simulated subjects and captured form values from an RFC 4180 CSV string
 * into `EdcSimulationState`.
 */
export function importSimulationSubjectsCsv(
  csvText: string,
  study: StudyProtocol,
  baseState?: EdcSimulationState
): EdcSimulationState {
  const rows = parseRfc4180Csv(csvText);
  if (rows.length === 0) {
    throw new Error("Subjects CSV payload is empty.");
  }

  const headerIndex = buildHeaderIndex(rows[0]);
  if (!headerIndex.has("SUBJECT_ID") && !headerIndex.has("USUBJID")) {
    throw new Error(
      "Invalid Subjects CSV: missing required SUBJECT_ID (or USUBJID) column."
    );
  }

  const fieldById = new Map<string, { form: CRFForm; field: CRFField }>();
  const fieldByVar = new Map<string, { form: CRFForm; field: CRFField }>();
  for (const form of study.forms || []) {
    for (const sec of form.sections || []) {
      for (const field of sec.fields || []) {
        fieldById.set(field.id, { form, field });
        if (
          field.variableName &&
          !fieldByVar.has(field.variableName.toUpperCase())
        ) {
          fieldByVar.set(field.variableName.toUpperCase(), { form, field });
        }
      }
    }
  }

  const visitByKey = new Map<string, string>();
  for (const visit of study.visits || []) {
    visitByKey.set(visit.id.toUpperCase(), visit.id);
    if (visit.oid) visitByKey.set(visit.oid.toUpperCase(), visit.id);
    visitByKey.set(visit.name.toUpperCase(), visit.id);
  }
  const defaultVisitId = study.visits?.[0]?.id || "v_screen";

  const availableSubjects = [...(baseState?.availableSubjects || [])];
  const seenSubjects = new Set(availableSubjects);
  const formValues: Record<string, string | number | boolean | null> = {
    ...(baseState?.formValues || {}),
  };
  const sdvMap: NonNullable<EdcSimulationState["sdvMap"]> = {
    ...(baseState?.sdvMap || {}),
  };
  const lockedForms: NonNullable<EdcSimulationState["lockedForms"]> = {
    ...(baseState?.lockedForms || {}),
  };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const subjectId = readCol(
      row,
      headerIndex,
      "SUBJECT_ID",
      "SUBJECTID",
      "USUBJID"
    ).trim();
    if (!subjectId) continue;

    if (!seenSubjects.has(subjectId)) {
      seenSubjects.add(subjectId);
      availableSubjects.push(subjectId);
    }

    const rawVisit = readCol(
      row,
      headerIndex,
      "VISIT_ID",
      "VISITID",
      "VISIT"
    ).trim();
    const rawFieldId = readCol(row, headerIndex, "FIELD_ID", "FIELDID").trim();
    const rawVarName = readCol(
      row,
      headerIndex,
      "VARIABLE_NAME",
      "VARIABLENAME",
      "VARIABLE"
    ).trim();

    if (!rawFieldId && !rawVarName) {
      continue;
    }

    const visitId = rawVisit
      ? visitByKey.get(rawVisit.toUpperCase()) || rawVisit
      : defaultVisitId;
    const matchedField =
      (rawFieldId ? fieldById.get(rawFieldId) : undefined) ||
      (rawVarName ? fieldByVar.get(rawVarName.toUpperCase()) : undefined);
    const fieldId = matchedField?.field.id || rawFieldId || rawVarName;
    const formId =
      readCol(row, headerIndex, "FORM_ID", "FORMID").trim() ||
      matchedField?.form.id ||
      "";

    const rawVal = readCol(row, headerIndex, "VALUE");
    const rawType = readCol(row, headerIndex, "VALUE_TYPE", "VALUETYPE").trim();
    const cellKey = `${subjectId}_${visitId}_${fieldId}`;
    formValues[cellKey] = coerceTypedCell(
      rawVal,
      rawType || undefined,
      matchedField?.field
    );

    const sdvVerified = readCol(row, headerIndex, "SDV_VERIFIED").trim();
    if (sdvVerified === "true" || sdvVerified === "1") {
      sdvMap[cellKey] = {
        verified: true,
        auditedBy:
          readCol(row, headerIndex, "SDV_AUDITED_BY").trim() ||
          "M. Vance, CRA (Monitor)",
        timestamp:
          readCol(row, headerIndex, "SDV_TIMESTAMP").trim() ||
          new Date().toISOString(),
      };
    }

    const formLocked = readCol(row, headerIndex, "FORM_LOCKED").trim();
    if ((formLocked === "true" || formLocked === "1") && formId) {
      lockedForms[`${subjectId}_${visitId}_${formId}`] = {
        locked: true,
        lockedBy:
          readCol(row, headerIndex, "FORM_LOCKED_BY").trim() ||
          "Dr. A. Patel, MD (PI)",
        timestamp:
          readCol(row, headerIndex, "FORM_LOCKED_TIMESTAMP").trim() ||
          new Date().toISOString(),
      };
    }
  }

  return {
    ...baseState,
    availableSubjects,
    formValues,
    sdvMap,
    lockedForms,
  };
}

/**
 * Imports discrepancy queries from an RFC 4180 CSV string into `EdcSimulationState`.
 */
export function importSimulationQueriesCsv(
  csvText: string,
  baseState?: EdcSimulationState
): EdcSimulationState {
  const rows = parseRfc4180Csv(csvText);
  if (rows.length === 0) {
    throw new Error("Queries CSV payload is empty.");
  }

  const headerIndex = buildHeaderIndex(rows[0]);
  if (
    !headerIndex.has("QUERY_ID") &&
    !headerIndex.has("ID") &&
    !headerIndex.has("MESSAGE")
  ) {
    throw new Error("Invalid Queries CSV: missing QUERY_ID or MESSAGE column.");
  }

  const importedQueries: EDCQuery[] = [];
  const availableSubjects = [...(baseState?.availableSubjects || [])];
  const seenSubjects = new Set(availableSubjects);

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const id =
      readCol(row, headerIndex, "QUERY_ID", "ID").trim() ||
      generateEngineId("q_csv");
    const subjectId = readCol(
      row,
      headerIndex,
      "SUBJECT_ID",
      "SUBJECTID",
      "USUBJID"
    ).trim();
    const visitId =
      readCol(row, headerIndex, "VISIT_ID", "VISITID", "VISIT").trim() ||
      "v_screen";
    const formId =
      readCol(row, headerIndex, "FORM_ID", "FORMID", "FORM").trim() ||
      "form_crf";
    const fieldId =
      readCol(row, headerIndex, "FIELD_ID", "FIELDID", "FIELD").trim() ||
      "field_1";
    const fieldName =
      readCol(row, headerIndex, "FIELD_NAME", "FIELDNAME").trim() || fieldId;
    const rawMessage = readCol(row, headerIndex, "MESSAGE");
    const message = rawMessage.trim() ? rawMessage : "";
    if (!subjectId && !message) continue;

    if (subjectId && !seenSubjects.has(subjectId)) {
      seenSubjects.add(subjectId);
      availableSubjects.push(subjectId);
    }

    const rawSeverity = readCol(row, headerIndex, "SEVERITY")
      .trim()
      .toLowerCase();
    const severity: EDCQuery["severity"] =
      rawSeverity === "error" || rawSeverity === "info"
        ? rawSeverity
        : "warning";

    const rawStatus = readCol(row, headerIndex, "STATUS").trim();
    const status: EDCQuery["status"] =
      rawStatus === "Answered" ||
      rawStatus === "Closed" ||
      rawStatus === "Cancelled"
        ? rawStatus
        : "Open";

    const ruleId = readCol(row, headerIndex, "RULE_ID", "RULEID").trim();
    const rawResponse = readCol(row, headerIndex, "RESPONSE");
    const response = rawResponse.trim() ? rawResponse : "";
    const respondedBy = readCol(
      row,
      headerIndex,
      "RESPONDED_BY",
      "RESPONDEDBY"
    ).trim();
    const respondedAt = readCol(
      row,
      headerIndex,
      "RESPONDED_AT",
      "RESPONDEDAT"
    ).trim();
    const resolvedBy = readCol(
      row,
      headerIndex,
      "RESOLVED_BY",
      "RESOLVEDBY"
    ).trim();
    const resolvedAt = readCol(
      row,
      headerIndex,
      "RESOLVED_AT",
      "RESOLVEDAT"
    ).trim();
    const rawResolutionReason = readCol(
      row,
      headerIndex,
      "RESOLUTION_REASON",
      "RESOLUTIONREASON"
    );
    const resolutionReason = rawResolutionReason.trim()
      ? rawResolutionReason
      : "";

    importedQueries.push({
      id,
      subjectId: subjectId || "001-101",
      visitId,
      formId,
      fieldId,
      fieldName,
      ...(ruleId ? { ruleId } : {}),
      severity,
      status,
      message,
      raisedBy:
        readCol(row, headerIndex, "RAISED_BY", "RAISEDBY").trim() || "System",
      raisedAt:
        readCol(row, headerIndex, "RAISED_AT", "RAISEDAT").trim() ||
        new Date().toISOString(),
      ...(response ? { response } : {}),
      ...(respondedBy ? { respondedBy } : {}),
      ...(respondedAt ? { respondedAt } : {}),
      ...(resolvedBy ? { resolvedBy } : {}),
      ...(resolvedAt ? { resolvedAt } : {}),
      ...(resolutionReason ? { resolutionReason } : {}),
    });
  }

  // Merge by query ID (imported rows replace existing queries with same ID)
  const importedIds = new Set(importedQueries.map((q) => q.id));
  const mergedQueries = [
    ...importedQueries,
    ...(baseState?.queries || []).filter((q) => !importedIds.has(q.id)),
  ];

  return {
    ...baseState,
    availableSubjects,
    queries: mergedQueries,
  };
}

/**
 * Imports EDC audit trail entries from an RFC 4180 CSV string into `EdcSimulationState`.
 */
export function importSimulationAuditsCsv(
  csvText: string,
  baseState?: EdcSimulationState
): EdcSimulationState {
  const rows = parseRfc4180Csv(csvText);
  if (rows.length === 0) {
    throw new Error("Audit Log CSV payload is empty.");
  }

  const headerIndex = buildHeaderIndex(rows[0]);
  if (
    !headerIndex.has("AUDIT_ID") &&
    !headerIndex.has("ID") &&
    !headerIndex.has("CHANGED_BY") &&
    !headerIndex.has("CHANGEDBY")
  ) {
    throw new Error(
      "Invalid Audit Log CSV: missing AUDIT_ID or CHANGED_BY column."
    );
  }

  const importedAudits: AuditTrailEntry[] = [];
  const availableSubjects = [...(baseState?.availableSubjects || [])];
  const seenSubjects = new Set(availableSubjects);

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const id =
      readCol(row, headerIndex, "AUDIT_ID", "ID").trim() ||
      generateEngineId("aud_csv");
    const changedBy = readCol(
      row,
      headerIndex,
      "CHANGED_BY",
      "CHANGEDBY"
    ).trim();
    const timestamp = readCol(row, headerIndex, "TIMESTAMP").trim();
    if (!changedBy && !timestamp) continue;

    const subjectId = readCol(
      row,
      headerIndex,
      "SUBJECT_ID",
      "SUBJECTID",
      "USUBJID"
    ).trim();
    if (subjectId && !seenSubjects.has(subjectId)) {
      seenSubjects.add(subjectId);
      availableSubjects.push(subjectId);
    }

    const formId = readCol(row, headerIndex, "FORM_ID", "FORMID").trim();
    const fieldId = readCol(row, headerIndex, "FIELD_ID", "FIELDID").trim();
    const fieldName = readCol(
      row,
      headerIndex,
      "FIELD_NAME",
      "FIELDNAME"
    ).trim();
    const prevRaw = readCol(
      row,
      headerIndex,
      "PREVIOUS_VALUE",
      "PREVIOUSVALUE"
    );
    const prevType = readCol(
      row,
      headerIndex,
      "PREVIOUS_VALUE_TYPE",
      "PREVIOUSVALUETYPE"
    ).trim();
    const newRaw = readCol(row, headerIndex, "NEW_VALUE", "NEWVALUE");
    const newType = readCol(
      row,
      headerIndex,
      "NEW_VALUE_TYPE",
      "NEWVALUETYPE"
    ).trim();
    const userRole = readCol(row, headerIndex, "USER_ROLE", "USERROLE").trim();
    const rawReasonForChange = readCol(
      row,
      headerIndex,
      "REASON_FOR_CHANGE",
      "REASONFORCHANGE"
    );
    const reasonForChange = rawReasonForChange.trim() ? rawReasonForChange : "";
    const actionType = readCol(
      row,
      headerIndex,
      "ACTION_TYPE",
      "ACTIONTYPE"
    ).trim();

    importedAudits.push({
      id,
      timestamp: timestamp || new Date().toISOString(),
      changedBy: changedBy || "Clinical User",
      ...(subjectId ? { subjectId } : {}),
      ...(formId ? { formId } : {}),
      ...(fieldId ? { fieldId } : {}),
      ...(fieldName ? { fieldName } : {}),
      previousValue: coerceAuditValue(prevRaw, prevType || undefined),
      newValue: coerceAuditValue(newRaw, newType || undefined),
      ...(userRole ? { userRole } : {}),
      ...(reasonForChange ? { reasonForChange } : {}),
      ...(actionType ? { actionType } : {}),
    });
  }

  const importedIds = new Set(importedAudits.map((a) => a.id));
  const mergedAudits = [
    ...importedAudits,
    ...(baseState?.auditLog || []).filter((a) => !importedIds.has(a.id)),
  ];

  return {
    ...baseState,
    availableSubjects,
    auditLog: mergedAudits,
  };
}

/**
 * Dispatches an RFC 4180 clinical CSV import (auto-detected or explicit kind)
 * into `EdcSimulationState`.
 */
export function importClinicalCsvIntoSimulationState(
  csvText: string,
  study: StudyProtocol,
  baseState?: EdcSimulationState,
  explicitKind?: ClinicalDataCsvKind
): { kind: ClinicalDataCsvKind; simulationState: EdcSimulationState } {
  const kind = explicitKind || detectClinicalCsvKind(csvText);
  if (!kind) {
    throw new Error(
      "Unrecognized Clinical Data CSV headers. Expected SUBJECT_ID, QUERY_ID, or AUDIT_ID columns."
    );
  }

  switch (kind) {
    case "subjects":
      return {
        kind,
        simulationState: importSimulationSubjectsCsv(csvText, study, baseState),
      };
    case "queries":
      return {
        kind,
        simulationState: importSimulationQueriesCsv(csvText, baseState),
      };
    case "audits":
      return {
        kind,
        simulationState: importSimulationAuditsCsv(csvText, baseState),
      };
  }
}
