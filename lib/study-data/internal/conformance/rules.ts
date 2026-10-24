/** Versioned, data-defined subset of SDTMIG and ADaMIG conformance checks. */
import { STANDARD_CODELISTS } from "@/lib/crf/cdisc-controlled-terminology";
import { CLINICAL_STANDARDS_PROFILE, standardCitation } from "../../standards";
import type { CellValue, Dataset, FindingSeverity } from "../../types";

export const CONFORMANCE_RULES_VERSION = "1.0.0";
export const CDISC_CORE_URL = "https://www.cdisc.org/core";
const SDTM_CITATION = `${standardCitation("SDTMIG")} / ${standardCitation("SDTM-CR")}: https://www.cdisc.org/standards/foundational/sdtmig/sdtm-and-sdtmig-conformance-rules-v2-0`;
const ADAM_CITATION = `${standardCitation("ADaMIG")}: https://www.cdisc.org/standards/foundational/adam/adamig-v1-3`;
const CT_CITATION = `Local CT subset aligned to NCI EVS CDISC CT ${CLINICAL_STANDARDS_PROFILE.CT.packageDate}, not verified against the package: https://evs.nci.nih.gov/ftp1/CDISC/`;

export interface RuleIssue {
  readonly row?: number;
  readonly variable?: string;
  readonly message: string;
}
export interface ConformanceRule {
  readonly id: string;
  readonly severity: FindingSeverity;
  readonly scope: {
    readonly layer: "sdtm" | "adam";
    readonly domain: string;
    readonly class?: string;
  };
  readonly citation: string;
  readonly kind:
    | "required"
    | "unique"
    | "iso"
    | "ct"
    | "study-day"
    | "visit"
    | "epoch"
    | "baseline"
    | "adam"
    | "exception";
  readonly variable?: string;
  readonly check: (
    dataset: Dataset,
    datasets: readonly Dataset[]
  ) => readonly RuleIssue[];
}
function values(dataset: Dataset, variable: string): readonly CellValue[] {
  return Array.isArray(dataset.columns?.[variable])
    ? dataset.columns[variable]
    : [];
}
function at(dataset: Dataset, variable: string, row: number): CellValue {
  return values(dataset, variable)[row] ?? null;
}
function string(value: CellValue): string | null {
  return typeof value === "string" ? value : null;
}
function number(value: CellValue): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function fullDate(value: CellValue): Date | null {
  const text = string(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === text
    ? date
    : null;
}
function iso(value: CellValue): boolean {
  const text = string(value);
  if (text === null || text === "") return true;
  if (/^\d{4}$/.test(text)) return true;
  if (/^\d{4}-\d{2}$/.test(text)) {
    const month = Number(text.slice(5));
    return month >= 1 && month <= 12;
  }
  return fullDate(text) !== null;
}
function required(
  id: string,
  domain: string,
  variables: readonly string[],
  layer: "sdtm" | "adam" = "sdtm"
): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer, domain },
    citation: layer === "sdtm" ? SDTM_CITATION : ADAM_CITATION,
    kind: "required",
    check(dataset) {
      return variables
        .filter(
          (variable) =>
            !dataset.variables.some((meta) => meta.name === variable) ||
            !Array.isArray(dataset.columns?.[variable])
        )
        .map((variable) => ({
          variable,
          message: `Required variable ${variable} is absent.`,
        }));
    },
  };
}
function unique(
  id: string,
  domain: string,
  variable: string,
  layer: "sdtm" | "adam" = "sdtm"
): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer, domain },
    citation: layer === "sdtm" ? SDTM_CITATION : ADAM_CITATION,
    kind: "unique",
    variable,
    check(dataset) {
      const seen = new Set<string>();
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const subject = string(at(dataset, "USUBJID", row));
        const sequence = at(dataset, variable, row);
        const key = `${subject}|${sequence}`;
        if (subject === null || sequence === null || seen.has(key))
          issues.push({
            row,
            variable,
            message: `Missing or repeated ${variable} within USUBJID.`,
          });
        seen.add(key);
      }
      return issues;
    },
  };
}
function dateRule(
  id: string,
  domain: string,
  variable: string
): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer: "sdtm", domain },
    citation: SDTM_CITATION,
    kind: "iso",
    variable,
    check(dataset) {
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1)
        if (!iso(at(dataset, variable, row)))
          issues.push({
            row,
            variable,
            message: `${variable} is not a valid full or partial ISO 8601 date.`,
          });
      return issues;
    },
  };
}
function terminology(
  id: string,
  domain: string,
  variable: string,
  codelistId: string,
  extensible: boolean
): ConformanceRule {
  const list = STANDARD_CODELISTS.find((item) => item.id === codelistId);
  const allowed = new Set(list?.options.map((option) => option.code) ?? []);
  return {
    id,
    severity: extensible ? "warning" : "error",
    scope: { layer: "sdtm", domain },
    citation: `${CT_CITATION} ${list?.nciCodelistCode ?? codelistId}; ${extensible ? "extensible" : "non-extensible"} local rule.`,
    kind: "ct",
    variable,
    check(dataset) {
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const value = string(at(dataset, variable, row));
        if (value !== null && !allowed.has(value))
          issues.push({
            row,
            variable,
            message: `${value} is outside ${codelistId} (${extensible ? "review extension" : "invalid code"}).`,
          });
      }
      return issues;
    },
  };
}
function studyDay(
  id: string,
  domain: string,
  dateVariable: string,
  dayVariable: string
): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer: "sdtm", domain },
    citation: SDTM_CITATION,
    kind: "study-day",
    variable: dayVariable,
    check(dataset, datasets) {
      const dm = datasets.find(
        (item) => item.layer === "sdtm" && item.name === "DM"
      );
      const reference = new Map<string, CellValue>();
      if (dm)
        for (let row = 0; row < dm.rowCount; row += 1)
          reference.set(String(at(dm, "USUBJID", row)), at(dm, "RFSTDTC", row));
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const date = fullDate(at(dataset, dateVariable, row));
        const ref = fullDate(
          reference.get(String(at(dataset, "USUBJID", row))) ?? null
        );
        const actual = at(dataset, dayVariable, row);
        const diff =
          date && ref
            ? Math.round((date.valueOf() - ref.valueOf()) / 86400000)
            : null;
        const expected = diff === null ? null : diff >= 0 ? diff + 1 : diff;
        if (actual !== expected)
          issues.push({
            row,
            variable: dayVariable,
            message: `${dayVariable} must equal study day ${expected ?? "missing"} from RFSTDTC; no Day 0.`,
          });
      }
      return issues;
    },
  };
}
function visitRule(id: string, domain: string): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer: "sdtm", domain },
    citation: SDTM_CITATION,
    kind: "visit",
    variable: "VISIT",
    check(dataset, datasets) {
      const tv = datasets.find(
        (item) => item.name === "TV" && item.layer === "sdtm"
      );
      if (!tv)
        return [{ message: "TV is required to validate planned visits." }];
      const visits = new Map(
        Array.from({ length: tv.rowCount }, (_, row) => [
          at(tv, "VISITNUM", row),
          at(tv, "VISIT", row),
        ])
      );
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const number = at(dataset, "VISITNUM", row);
        const name = at(dataset, "VISIT", row);
        if (name === "UNSCHEDULED") continue;
        if (visits.get(number) !== name)
          issues.push({
            row,
            variable: "VISIT",
            message: `VISIT ${String(name)} does not match TV for VISITNUM ${String(number)}.`,
          });
      }
      return issues;
    },
  };
}
function epochRule(): ConformanceRule {
  return {
    id: "SD-029",
    severity: "error",
    scope: { layer: "sdtm", domain: "SV" },
    citation: SDTM_CITATION,
    kind: "epoch",
    variable: "EPOCH",
    check(dataset, datasets) {
      const ta = datasets.find(
        (item) => item.name === "TA" && item.layer === "sdtm"
      );
      const epochs = new Set(ta ? values(ta, "EPOCH") : []);
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const value = at(dataset, "EPOCH", row);
        if (value !== null && !epochs.has(value))
          issues.push({
            row,
            variable: "EPOCH",
            message: "EPOCH is absent from TA.",
          });
      }
      return issues;
    },
  };
}
function baselineRule(): ConformanceRule {
  return {
    id: "SD-030",
    severity: "error",
    scope: { layer: "sdtm", domain: "LB" },
    citation: SDTM_CITATION,
    kind: "baseline",
    variable: "LBLOBXFL",
    check(dataset) {
      const seen = new Set<string>();
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        if (at(dataset, "LBLOBXFL", row) !== "Y") continue;
        const key = `${at(dataset, "USUBJID", row)}|${at(dataset, "LBTESTCD", row)}`;
        if (seen.has(key) || (number(at(dataset, "LBDY", row)) ?? Infinity) > 1)
          issues.push({
            row,
            variable: "LBLOBXFL",
            message:
              "Only the last pre-dose lab observation may have LBLOBXFL=Y.",
          });
        seen.add(key);
      }
      return issues;
    },
  };
}
function adamRule(
  id: string,
  domain: string,
  kind: "base" | "chg" | "trtemfl"
): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer: "adam", domain },
    citation: ADAM_CITATION,
    kind: "adam",
    variable: kind.toUpperCase(),
    check(dataset) {
      const issues: RuleIssue[] = [];
      const rows = dataset.rowCount;
      for (let row = 0; row < rows; row += 1) {
        if (kind === "base") {
          const flag = at(dataset, "ABLFL", row);
          const base = number(at(dataset, "BASE", row));
          const aval = number(at(dataset, "AVAL", row));
          if (flag === "Y" && (base === null || aval === null || base !== aval))
            issues.push({
              row,
              variable: "BASE",
              message: "Baseline row requires BASE=AVAL.",
            });
        }
        if (kind === "chg") {
          const base = number(at(dataset, "BASE", row));
          const aval = number(at(dataset, "AVAL", row));
          const chg = number(at(dataset, "CHG", row));
          if (base !== null && aval !== null && chg !== aval - base)
            issues.push({
              row,
              variable: "CHG",
              message: "CHG must equal AVAL minus BASE.",
            });
        }
        if (kind === "trtemfl") {
          const start = fullDate(at(dataset, "ASTDT", row));
          const first = fullDate(at(dataset, "TRTSDT", row));
          const last = fullDate(at(dataset, "TRTEDT", row));
          const contact = fullDate(at(dataset, "LSTALVDT", row));
          const end = last ? last.getTime() + 14 * 86_400_000 : null;
          const expected =
            start && first && end
              ? start.getTime() >= first.getTime() &&
                start.getTime() <= end &&
                (!contact || start.getTime() <= contact.getTime())
                ? "Y"
                : "N"
              : null;
          if (expected !== null && at(dataset, "TRTEMFL", row) !== expected)
            issues.push({
              row,
              variable: "TRTEMFL",
              message: "TRTEMFL disagrees with event and treatment dates.",
            });
        }
      }
      return issues;
    },
  };
}

function exceptionRule(
  id: string,
  domain: "SV" | "LB" | "AE",
  variable: string,
  message: string,
  predicate: (
    dataset: Dataset,
    row: number,
    datasets: readonly Dataset[]
  ) => boolean
): ConformanceRule {
  return {
    id,
    severity: "warning",
    scope: { layer: "sdtm", domain },
    citation: SDTM_CITATION,
    kind: "exception",
    variable,
    check(dataset, datasets) {
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1)
        if (predicate(dataset, row, datasets))
          issues.push({ row, variable, message });
      return issues;
    },
  };
}

/** Local rule ids model a documented subset; they are not official CORE ids. */
export const CONFORMANCE_RULES: readonly ConformanceRule[] = [
  required("SD-001", "DM", ["STUDYID", "USUBJID", "RFSTDTC", "ARMCD"]),
  required("SD-002", "SV", ["STUDYID", "USUBJID", "VISITNUM", "VISIT"]),
  required("SD-003", "EX", ["STUDYID", "USUBJID", "EXSEQ", "EXTRT", "EXSTDTC"]),
  required("SD-004", "AE", [
    "STUDYID",
    "USUBJID",
    "AESEQ",
    "AETERM",
    "AESTDTC",
  ]),
  required("SD-005", "VS", [
    "STUDYID",
    "USUBJID",
    "VSSEQ",
    "VSTESTCD",
    "VSORRES",
  ]),
  required("SD-006", "LB", [
    "STUDYID",
    "USUBJID",
    "LBSEQ",
    "LBTESTCD",
    "LBORRES",
  ]),
  required("SD-007", "DS", ["STUDYID", "USUBJID", "DSSEQ", "DSDECOD"]),
  required("SD-008", "SUPPDM", [
    "STUDYID",
    "RDOMAIN",
    "USUBJID",
    "QNAM",
    "QVAL",
  ]),
  unique("SD-009", "EX", "EXSEQ"),
  unique("SD-010", "AE", "AESEQ"),
  unique("SD-011", "VS", "VSSEQ"),
  unique("SD-012", "LB", "LBSEQ"),
  unique("SD-013", "DS", "DSSEQ"),
  unique("SD-035", "DM", "USUBJID"),
  dateRule("SD-014", "DM", "RFICDTC"),
  dateRule("SD-015", "SV", "SVSTDTC"),
  dateRule("SD-016", "EX", "EXSTDTC"),
  dateRule("SD-017", "AE", "AESTDTC"),
  dateRule("SD-018", "VS", "VSDTC"),
  dateRule("SD-019", "LB", "LBDTC"),
  dateRule("SD-020", "DS", "DSSTDTC"),
  terminology("SD-021", "DM", "SEX", "CL_SEX", false),
  terminology("SD-022", "AE", "AESER", "CL_NY", false),
  terminology("SD-023", "AE", "AEREL", "CL_AEREL", true),
  terminology("SD-024", "EX", "EXDOSU", "CL_DOSU", false),
  studyDay("SD-025", "AE", "AESTDTC", "AESTDY"),
  studyDay("SD-026", "VS", "VSDTC", "VSDY"),
  studyDay("SD-027", "LB", "LBDTC", "LBDY"),
  visitRule("SD-028", "SV"),
  epochRule(),
  baselineRule(),
  exceptionRule(
    "SD-031",
    "SV",
    "SVSTDY",
    "Actual visit falls outside the TV planned window.",
    (dataset, row, datasets) => {
      const tv = datasets.find(
        (item) => item.name === "TV" && item.layer === "sdtm"
      );
      if (!tv) return false;
      const visitNum = at(dataset, "VISITNUM", row);
      const actual = number(at(dataset, "SVSTDY", row));
      if (actual === null || visitNum === 99) return false;
      for (let index = 0; index < tv.rowCount; index += 1)
        if (at(tv, "VISITNUM", index) === visitNum) {
          const lower = Number(string(at(tv, "TVSTRL", index))?.split(" ")[0]);
          const upper = Number(string(at(tv, "TVENRL", index))?.split(" ")[0]);
          return (
            Number.isFinite(lower) &&
            Number.isFinite(upper) &&
            (actual < lower || actual > upper)
          );
        }
      return false;
    }
  ),
  exceptionRule(
    "SD-032",
    "LB",
    "LBNRIND",
    "Synthetic laboratory result is outside the reference range.",
    (dataset, row) => at(dataset, "LBNRIND", row) === "HIGH"
  ),
  exceptionRule(
    "SD-033",
    "AE",
    "AESTDTC",
    "Partial adverse-event onset date needs review for temporal analyses.",
    (dataset, row) =>
      /^\d{4}(?:-\d{2})?$/.test(string(at(dataset, "AESTDTC", row)) ?? "")
  ),
  exceptionRule(
    "SD-034",
    "AE",
    "AESTDY",
    "Adverse event began before first exposure.",
    (dataset, row) => (number(at(dataset, "AESTDY", row)) ?? Infinity) < 1
  ),
  required("AD-001", "ADSL", ["STUDYID", "USUBJID", "TRTSDT"], "adam"),
  unique("AD-002", "ADSL", "USUBJID", "adam"),
  adamRule("AD-003", "ADVS", "base"),
  adamRule("AD-004", "ADVS", "chg"),
  adamRule("AD-005", "ADAE", "trtemfl"),
];
