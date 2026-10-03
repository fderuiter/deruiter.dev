/**
 * RFC 4180 dataset export: VS.csv, MH.csv, ADVS.csv and audit_trail.json.
 * Standardized results are rounded only here, for display and export.
 */
import { CSV_HEADERS } from "../presets";
import type {
  ADaMVitalSignRecord,
  AuditTrailEvent,
  DatasetExportBundle,
  SDTMMedicalHistoryRecord,
  SDTMVitalSignRecord,
} from "../types";
import { formatDisplay } from "./chips";

/** Quotes one CSV field per RFC 4180 when it needs quoting. */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Joins a header and rows into RFC 4180 CSV with CRLF line endings. */
export function toCsv(
  header: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>
): string {
  return (
    [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") +
    "\r\n"
  );
}

/** Parses RFC 4180 CSV into rows of fields (used to verify exports). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function bySubjectSeq<T extends { USUBJID: string }>(
  seq: (r: T) => number
): (a: T, b: T) => number {
  return (a, b) =>
    a.USUBJID === b.USUBJID ? seq(a) - seq(b) : a.USUBJID < b.USUBJID ? -1 : 1;
}

/** Builds the export bundle from current records. */
export function buildDatasetExport(input: {
  vs: readonly SDTMVitalSignRecord[];
  mh: readonly SDTMMedicalHistoryRecord[];
  adam: readonly ADaMVitalSignRecord[];
  unpaired: readonly ADaMVitalSignRecord[];
  audit: readonly AuditTrailEvent[];
}): DatasetExportBundle {
  const vs = input.vs
    .filter((r) => !r.superseded)
    .sort(bySubjectSeq((r) => r.VSSEQ));
  const mh = input.mh
    .filter((r) => !r.superseded)
    .sort(bySubjectSeq((r) => r.MHSEQ));
  const adam = input.adam
    .filter((r) => r.AVAL !== null && !r.stale)
    .sort((a, b) =>
      a.AVISITN !== b.AVISITN
        ? a.AVISITN - b.AVISITN
        : a.USUBJID === b.USUBJID
          ? a.PARAMCD < b.PARAMCD
            ? 1
            : -1
          : a.USUBJID < b.USUBJID
            ? -1
            : 1
    );
  return {
    "VS.csv": toCsv(
      CSV_HEADERS.VS,
      vs.map((r) => [
        r.STUDYID,
        r.DOMAIN,
        r.USUBJID,
        r.VSSEQ,
        r.VSTESTCD,
        r.VSTEST,
        r.VSORRES,
        r.VSORRESU,
        r.VSSTRESC,
        formatDisplay(r.VSSTRESN, r.precision),
        r.VSSTRESU,
        r.VSPOS,
        r.VISIT,
        r.VISITNUM,
        r.VSDTC,
        r.EPOCH,
      ])
    ),
    "MH.csv": toCsv(
      CSV_HEADERS.MH,
      mh.map((r) => [
        r.STUDYID,
        r.DOMAIN,
        r.USUBJID,
        r.MHSEQ,
        r.MHTERM,
        r.MHDECOD,
        r.MHCAT,
        r.MHSTDTC,
        r.MHENRTPT,
      ])
    ),
    "ADVS.csv": toCsv(
      CSV_HEADERS.ADVS,
      adam.map((r) => [
        r.STUDYID,
        r.USUBJID,
        r.PARAMCD,
        r.PARAM,
        r.AVISIT,
        r.AVISITN,
        r.AVAL === null ? "" : formatDisplay(r.AVAL, r.precision),
        r.AVALC,
        r.BASE === null ? "" : formatDisplay(r.BASE, r.precision),
        r.CHG === null ? "" : formatDisplay(r.CHG, r.precision),
        r.CRIT1 ?? "",
        r.CRIT1FL ?? "",
        r.ANL01FL,
      ])
    ),
    "audit_trail.json": JSON.stringify(
      {
        events: input.audit,
        unpaired: input.unpaired.map((r) => ({
          USUBJID: r.USUBJID,
          AVISIT: r.AVISIT,
          PARAMCD: r.PARAMCD,
          AVAL: r.AVAL,
          AVALC: r.AVALC,
          reason: r.reason ?? "",
        })),
      },
      null,
      2
    ),
  };
}
