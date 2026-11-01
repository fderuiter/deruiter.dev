/** Versioned, data-defined subset of SDTMIG and ADaMIG conformance checks. */
import { STANDARD_CODELISTS } from "@/lib/clinical-standards";
import {
  CLINICAL_STANDARDS_PROFILE,
  standardCitation,
} from "@/lib/clinical-standards";
import type { CellValue, Dataset, FindingSeverity } from "../../types";

/** The ids of every collected source record in the run. */
function collectedSourceIds(datasets: readonly Dataset[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const dataset of datasets)
    if (dataset.layer === "collected")
      for (const id of values(dataset, "SRCID"))
        if (typeof id === "string") ids.add(id);
  return ids;
}

/** The lineage of one row, or null when the dataset carries none. */
function rowLineage(dataset: Dataset, row: number): readonly string[] | null {
  const lineage = Array.isArray(dataset.lineage) ? dataset.lineage[row] : null;
  return Array.isArray(lineage) ? lineage : null;
}

/**
 * An SDTM subject record that does not trace to a collected source: its
 * lineage is missing or empty, or names a record the collected data does not
 * hold. Trial design datasets are Protocol origin and carry no lineage.
 */
function sourceLineageRule(id: string, domain: string): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer: "sdtm", domain },
    citation: LINEAGE_CITATION,
    kind: "lineage",
    check(dataset, datasets) {
      const sources = collectedSourceIds(datasets);
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const lineage = rowLineage(dataset, row);
        if (!lineage || lineage.length === 0)
          issues.push({
            row,
            message: "Record has no lineage to a collected source record.",
          });
        else {
          const missing = lineage.filter((source) => !sources.has(source));
          if (missing.length > 0)
            issues.push({
              row,
              message: `Lineage names collected records that do not exist: ${missing.join(", ")}.`,
            });
        }
      }
      return issues;
    },
  };
}

/**
 * An ADaM record whose SRCDOM and SRCSEQ do not resolve to an SDTM record of
 * the same subject, or whose lineage does not reach collected data. A source
 * domain with a --SEQ variable needs a SRCSEQ that matches one; one without
 * (DM, SV) needs a record for the subject and no SRCSEQ.
 */
function adamSourceRule(id: string, domain: string): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer: "adam", domain },
    citation: ADAM_CITATION,
    kind: "lineage",
    variable: "SRCDOM",
    check(dataset, datasets) {
      const sources = collectedSourceIds(datasets);
      const sdtm = new Map(
        datasets
          .filter((item) => item.layer === "sdtm")
          .map((item) => [item.name, item])
      );
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const lineage = rowLineage(dataset, row);
        if (!lineage || lineage.length === 0)
          issues.push({
            row,
            message: "Record has no lineage to a collected source record.",
          });
        else if (lineage.some((source) => !sources.has(source)))
          issues.push({
            row,
            message: "Lineage names collected records that do not exist.",
          });
        const domainName = string(at(dataset, "SRCDOM", row));
        const source = domainName ? sdtm.get(domainName) : undefined;
        if (!source) {
          issues.push({
            row,
            variable: "SRCDOM",
            message: `SRCDOM ${domainName ?? "(missing)"} is not an SDTM dataset of this run.`,
          });
          continue;
        }
        const subject = at(dataset, "USUBJID", row);
        const sequence = number(at(dataset, "SRCSEQ", row));
        const seqVariable = `${domainName}SEQ`;
        const hasSeq = source.variables.some(
          (variable) => variable.name === seqVariable
        );
        let found = false;
        for (let index = 0; index < source.rowCount && !found; index += 1)
          found =
            at(source, "USUBJID", index) === subject &&
            (!hasSeq || at(source, seqVariable, index) === sequence);
        if (!found || (hasSeq ? sequence === null : sequence !== null))
          issues.push({
            row,
            variable: "SRCSEQ",
            message: hasSeq
              ? `SRCSEQ ${sequence ?? "(missing)"} does not match a ${seqVariable} of the subject in ${domainName}.`
              : `${domainName} has no record for the subject, or SRCSEQ is set although ${domainName} has no ${seqVariable}.`,
          });
      }
      return issues;
    },
  };
}

export const CONFORMANCE_RULES_VERSION = "1.9.1";
export const CDISC_CORE_URL = "https://www.cdisc.org/core";
const SDTM_CITATION = `${standardCitation("SDTMIG")} / ${standardCitation("SDTM-CR")}: https://www.cdisc.org/standards/foundational/sdtmig/sdtm-and-sdtmig-conformance-rules-v2-0`;
const ADAM_CITATION = `${standardCitation("ADaMIG")}: https://www.cdisc.org/standards/foundational/adam/adamig-v1-3`;
const LINEAGE_CITATION = `Source traceability for ${standardCitation("Define-XML")} origins: https://www.cdisc.org/standards/data-exchange/define-xml`;
const CT_CITATION = `Local CT subset of NCI EVS CDISC CT ${CLINICAL_STANDARDS_PROFILE.CT.packageDate}, each code checked against that release: https://evs.nci.nih.gov/ftp1/CDISC/`;

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
    | "exception"
    | "duplicate"
    | "unit"
    | "eligibility"
    | "relationship"
    | "elements"
    | "comment"
    | "lineage";
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
    scope: { layer: "sdtm", domain: "VS" },
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
  kind: "base" | "chg" | "trtemfl" | "prefl" | "ontrtfl"
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
        if (kind === "prefl" || kind === "ontrtfl") {
          // ADCM: recomputed from the analysis dates, independently of the
          // derivation (ADCM_TIMING). Never-dosed subjects carry neither flag.
          const start = fullDate(at(dataset, "ASTDT", row));
          const stop = fullDate(at(dataset, "AENDT", row));
          const first = fullDate(at(dataset, "TRTSDT", row));
          const last = fullDate(at(dataset, "TRTEDT", row));
          const contact = fullDate(at(dataset, "LSTALVDT", row));
          const windowEnd = last ? last.getTime() + 14 * 86_400_000 : null;
          const end =
            windowEnd !== null && contact
              ? Math.min(windowEnd, contact.getTime())
              : windowEnd;
          const flag = kind === "prefl" ? "PREFL" : "ONTRTFL";
          const expected = !first
            ? null
            : kind === "prefl"
              ? !start || start.getTime() < first.getTime()
              : end !== null &&
                (!start || start.getTime() <= end) &&
                (!stop || stop.getTime() >= first.getTime());
          if ((expected ? "Y" : null) !== at(dataset, flag, row))
            issues.push({
              row,
              variable: flag,
              message: `${flag} disagrees with the medication and treatment dates.`,
            });
        }
      }
      return issues;
    },
  };
}

function exceptionRule(
  id: string,
  domain: "SV" | "LB" | "AE" | "ADEG",
  variable: string,
  message: string,
  predicate: (
    dataset: Dataset,
    row: number,
    datasets: readonly Dataset[]
  ) => boolean
): ConformanceRule {
  const layer = domain === "ADEG" ? "adam" : "sdtm";
  return {
    id,
    severity: "warning",
    scope: { layer, domain },
    citation: layer === "adam" ? ADAM_CITATION : SDTM_CITATION,
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

/**
 * A collected QT interval with no QTcF beside it: the ECG's RR interval is
 * missing or not positive, so Fridericia's correction could not be applied.
 * The derived record carries the QT record's SRCSEQ, which pairs them.
 */
function qtcfNotDerivedRule(id: string): ConformanceRule {
  return {
    id,
    severity: "warning",
    scope: { layer: "adam", domain: "ADEG" },
    citation: ADAM_CITATION,
    kind: "exception",
    variable: "PARAMCD",
    check(dataset) {
      const collected = (row: number, paramcd: string) =>
        at(dataset, "PARAMCD", row) === paramcd &&
        at(dataset, "DTYPE", row) === null;
      const key = (row: number) =>
        `${at(dataset, "USUBJID", row)}|${at(dataset, "SRCSEQ", row)}`;
      const derived = new Set<string>();
      for (let row = 0; row < dataset.rowCount; row += 1)
        if (collected(row, "QTCFAG")) derived.add(key(row));
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1)
        if (collected(row, "QTAG") && !derived.has(key(row)))
          issues.push({
            row,
            variable: "PARAMCD",
            message:
              "No QTcF was derived for this ECG: its RR interval is missing or not positive.",
          });
      return issues;
    },
  };
}

/**
 * A findings record that repeats an earlier one for the same subject, test,
 * date, result and unit: the same measurement entered twice.
 */
function duplicateRule(
  id: string,
  domain: "VS" | "LB" | "EG"
): ConformanceRule {
  const fields = ["USUBJID", "TESTCD", "DTC", "ORRES", "ORRESU"].map((field) =>
    field === "USUBJID" ? field : `${domain}${field}`
  );
  return {
    id,
    severity: "warning",
    scope: { layer: "sdtm", domain },
    citation: SDTM_CITATION,
    kind: "duplicate",
    variable: `${domain}ORRES`,
    check(dataset) {
      const seen = new Set<string>();
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const key = fields.map((field) => at(dataset, field, row));
        if (key.slice(0, 4).some((value) => value === null)) continue;
        const text = JSON.stringify(key);
        if (seen.has(text))
          issues.push({
            row,
            variable: `${domain}ORRES`,
            message:
              "Repeats an earlier record for the same subject, test, date and result; query the site before analysis.",
          });
        seen.add(text);
      }
      return issues;
    },
  };
}

/**
 * A findings record collected in a unit other than the test's standard unit.
 * SDTM converts it where a conversion is defined; either way the change of
 * unit is reported so it can be confirmed with the site.
 */
function unitRule(id: string, domain: "VS" | "LB" | "EG"): ConformanceRule {
  return {
    id,
    severity: "warning",
    scope: { layer: "sdtm", domain },
    citation: SDTM_CITATION,
    kind: "unit",
    variable: `${domain}ORRESU`,
    check(dataset) {
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const original = string(at(dataset, `${domain}ORRESU`, row));
        const standard = string(at(dataset, `${domain}STRESU`, row));
        if (original === null || standard === null || original === standard)
          continue;
        issues.push({
          row,
          variable: `${domain}ORRESU`,
          message:
            number(at(dataset, `${domain}STRESN`, row)) === null
              ? `Collected in ${original} with no conversion to ${standard}; the standard result is missing.`
              : `Converted from ${original} to the standard unit ${standard}; confirm the change of unit with the site.`,
        });
      }
      return issues;
    },
  };
}

/**
 * IE and disposition disagree about who failed screening. IE records the
 * criteria a subject did not meet, so a SCREEN FAILURE disposition needs at
 * least one IE record, and a subject who was not a screen failure needs none
 * (SDTMIG 3.4 section 6.3.4). CORE v0.17.1 checks IE against TI but has no
 * rule relating IE to disposition.
 */
function eligibilityRule(id: string): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer: "sdtm", domain: "IE" },
    citation: SDTM_CITATION,
    kind: "eligibility",
    variable: "USUBJID",
    check(dataset, datasets) {
      const ds = datasets.find(
        (item) => item.layer === "sdtm" && item.name === "DS"
      );
      const failed = new Set<string>();
      if (ds)
        for (let row = 0; row < ds.rowCount; row += 1)
          if (at(ds, "DSDECOD", row) === "SCREEN FAILURE")
            failed.add(String(at(ds, "USUBJID", row)));
      const withRecords = new Set<string>();
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const subject = String(at(dataset, "USUBJID", row));
        withRecords.add(subject);
        if (!failed.has(subject))
          issues.push({
            row,
            variable: "USUBJID",
            message:
              "Subject has an IE record but no SCREEN FAILURE disposition; IE holds only criteria not met.",
          });
      }
      for (const subject of failed)
        if (!withRecords.has(subject))
          issues.push({
            variable: "USUBJID",
            message: `${subject} failed screening but has no IE record of the criterion not met.`,
          });
      return issues;
    },
  };
}

/**
 * Every RELREC row names an existing record of its domain by its --SEQ, and
 * each relationship pairs exactly one AE record with one CM record of the
 * same subject (#3414).
 */
function relatedRecordsRule(id: string): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer: "sdtm", domain: "RELREC" },
    citation: SDTM_CITATION,
    kind: "relationship",
    variable: "IDVARVAL",
    check(dataset, datasets) {
      const issues: RuleIssue[] = [];
      const keys = new Map<string, Set<string>>();
      for (const domain of ["AE", "CM"] as const) {
        const target = datasets.find(
          (item) => item.layer === "sdtm" && item.name === domain
        );
        const seen = new Set<string>();
        if (target)
          for (let row = 0; row < target.rowCount; row += 1)
            seen.add(
              `${at(target, "USUBJID", row)}|${at(target, `${domain}SEQ`, row)}`
            );
        keys.set(domain, seen);
      }
      const pairs = new Map<string, string[]>();
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const domain = String(at(dataset, "RDOMAIN", row));
        const subject = String(at(dataset, "USUBJID", row));
        const seq = at(dataset, "IDVARVAL", row);
        const known = keys.get(domain);
        if (!known || at(dataset, "IDVAR", row) !== `${domain}SEQ`)
          issues.push({
            row,
            variable: "IDVAR",
            message: `RELREC links ${domain} by ${String(at(dataset, "IDVAR", row))}; only AE and CM records by their --SEQ are related.`,
          });
        else if (!known.has(`${subject}|${seq}`))
          issues.push({
            row,
            message: `RELREC names ${domain}SEQ ${String(seq)} for ${subject}, which is not a record in ${domain}.`,
          });
        const relationship = `${subject}|${String(at(dataset, "RELID", row))}`;
        pairs.set(relationship, [...(pairs.get(relationship) ?? []), domain]);
      }
      for (const [relationship, domains] of pairs)
        if (
          domains.length !== 2 ||
          !domains.includes("AE") ||
          !domains.includes("CM")
        )
          issues.push({
            variable: "RELID",
            message: `Relationship ${relationship.replace("|", " ")} relates ${domains.join(", ")} rather than one AE and one CM record.`,
          });
      return issues;
    },
  };
}

/** Each subject's SE rows, as row indexes in SESEQ order. */
function elementsBySubject(dataset: Dataset): Map<string, number[]> {
  const bySubject = new Map<string, number[]>();
  for (let row = 0; row < dataset.rowCount; row += 1) {
    const subject = String(at(dataset, "USUBJID", row));
    bySubject.set(subject, [...(bySubject.get(subject) ?? []), row]);
  }
  for (const rows of bySubject.values())
    rows.sort(
      (a, b) =>
        (number(at(dataset, "SESEQ", a)) ?? 0) -
        (number(at(dataset, "SESEQ", b)) ?? 0)
    );
  return bySubject;
}

/**
 * Elements leave no gap: each SE row ends when the subject's next element
 * starts, and every element has a start (#2711).
 */
function elementContinuityRule(id: string): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer: "sdtm", domain: "SE" },
    citation: SDTM_CITATION,
    kind: "elements",
    variable: "SEENDTC",
    check(dataset) {
      const issues: RuleIssue[] = [];
      for (const [subject, rows] of elementsBySubject(dataset))
        rows.forEach((row, index) => {
          if (at(dataset, "SESTDTC", row) === null)
            issues.push({
              row,
              variable: "SESTDTC",
              message: `Element ${String(at(dataset, "ETCD", row))} of ${subject} has no start.`,
            });
          const next = rows[index + 1];
          if (
            next !== undefined &&
            at(dataset, "SEENDTC", row) !== at(dataset, "SESTDTC", next)
          )
            issues.push({
              row,
              variable: "SEENDTC",
              message: `SEENDTC ${String(at(dataset, "SEENDTC", row))} of ${subject} is not the start of their next element, ${String(at(dataset, "SESTDTC", next))}.`,
            });
        });
      return issues;
    },
  };
}

/**
 * Each SE row is a planned element of the subject's actual arm in TA, in
 * TA's order, with TA's description, order and epoch. A subject with no
 * actual arm may have only elements every arm shares (#2711). An unplanned
 * element (ETCD = UNPLAN) has no TAETORD and describes itself in SEUPDES
 * (#2813).
 */
function elementPlanRule(id: string): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer: "sdtm", domain: "SE" },
    citation: SDTM_CITATION,
    kind: "elements",
    variable: "ETCD",
    check(dataset, datasets) {
      const find = (name: string) =>
        datasets.find((item) => item.layer === "sdtm" && item.name === name);
      const ta = find("TA");
      const dm = find("DM");
      if (!ta) return [{ message: "TA is required to validate SE." }];
      const planned = (row: number) =>
        ["ETCD", "ELEMENT", "TAETORD", "EPOCH"]
          .map((name) => String(at(ta, name, row)))
          .join("|");
      const byArm = new Map<string, Set<string>>();
      for (let row = 0; row < ta.rowCount; row += 1) {
        const arm = String(at(ta, "ARMCD", row));
        byArm.set(arm, (byArm.get(arm) ?? new Set()).add(planned(row)));
      }
      const arms = [...byArm.values()];
      const shared = new Set(
        [...(arms[0] ?? [])].filter((element) =>
          arms.every((elements) => elements.has(element))
        )
      );
      const armOf = new Map<string, CellValue>();
      if (dm)
        for (let row = 0; row < dm.rowCount; row += 1)
          armOf.set(String(at(dm, "USUBJID", row)), at(dm, "ACTARMCD", row));
      const issues: RuleIssue[] = [];
      for (const [subject, rows] of elementsBySubject(dataset)) {
        const arm = armOf.get(subject);
        const allowed =
          typeof arm === "string" ? (byArm.get(arm) ?? new Set()) : shared;
        let order = 0;
        for (const row of rows) {
          if (at(dataset, "ETCD", row) === "UNPLAN") {
            if (
              at(dataset, "TAETORD", row) !== null ||
              !string(at(dataset, "SEUPDES", row))
            )
              issues.push({
                row,
                variable: "ETCD",
                message: `Unplanned element of ${subject} needs SEUPDES and no TAETORD.`,
              });
            continue;
          }
          const element = ["ETCD", "ELEMENT", "TAETORD", "EPOCH"]
            .map((name) => String(at(dataset, name, row)))
            .join("|");
          const taetord = number(at(dataset, "TAETORD", row)) ?? 0;
          if (!allowed.has(element) || taetord <= order)
            issues.push({
              row,
              variable: "ETCD",
              message: `Element ${String(at(dataset, "ETCD", row))} of ${subject} is not the next planned element of ${typeof arm === "string" ? `arm ${arm}` : "every arm"} in TA.`,
            });
          order = Math.max(order, taetord);
        }
      }
      return issues;
    },
  };
}

/**
 * Every CO row names an existing record of the same subject: by --SEQ, or
 * by VISITNUM for a visit in SV (#2711).
 */
function commentTargetRule(id: string): ConformanceRule {
  return {
    id,
    severity: "error",
    scope: { layer: "sdtm", domain: "CO" },
    citation: SDTM_CITATION,
    kind: "comment",
    variable: "IDVARVAL",
    check(dataset, datasets) {
      const keys = new Map<string, Set<string> | null>();
      const keysOf = (domain: string, idvar: string) => {
        const cacheKey = `${domain}|${idvar}`;
        if (!keys.has(cacheKey)) {
          const target = datasets.find(
            (item) => item.layer === "sdtm" && item.name === domain
          );
          keys.set(
            cacheKey,
            target && Array.isArray(target.columns?.[idvar])
              ? new Set(
                  Array.from(
                    { length: target.rowCount },
                    (_, row) =>
                      `${String(at(target, "USUBJID", row))}|${String(at(target, idvar, row))}`
                  )
                )
              : null
          );
        }
        return keys.get(cacheKey)!;
      };
      const issues: RuleIssue[] = [];
      for (let row = 0; row < dataset.rowCount; row += 1) {
        const domain = string(at(dataset, "RDOMAIN", row));
        const idvar = string(at(dataset, "IDVAR", row));
        // A comment on the subject as a whole names no record.
        if (domain === null && idvar === null) continue;
        const known = domain && idvar ? keysOf(domain, idvar) : null;
        const subject = String(at(dataset, "USUBJID", row));
        const value = String(at(dataset, "IDVARVAL", row));
        if (!known)
          issues.push({
            row,
            variable: "IDVAR",
            message: `CO names ${String(domain)} by ${String(idvar)}, which is not a variable of a tabulated ${String(domain)}.`,
          });
        else if (!known.has(`${subject}|${value}`))
          issues.push({
            row,
            message: `CO names ${String(domain)} ${String(idvar)} ${value} for ${subject}, which is not a record in ${String(domain)}.`,
          });
      }
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
  duplicateRule("SD-036", "VS"),
  duplicateRule("SD-037", "LB"),
  unitRule("SD-038", "VS"),
  unitRule("SD-039", "LB"),
  required("SD-048", "EG", [
    "STUDYID",
    "USUBJID",
    "EGSEQ",
    "EGTESTCD",
    "EGORRES",
  ]),
  unique("SD-049", "EG", "EGSEQ"),
  dateRule("SD-050", "EG", "EGDTC"),
  studyDay("SD-051", "EG", "EGDTC", "EGDY"),
  duplicateRule("SD-052", "EG"),
  unitRule("SD-053", "EG"),
  sourceLineageRule("SD-054", "EG"),
  required("SD-055", "CM", ["STUDYID", "USUBJID", "CMSEQ", "CMTRT"]),
  unique("SD-056", "CM", "CMSEQ"),
  dateRule("SD-057", "CM", "CMSTDTC"),
  dateRule("SD-058", "CM", "CMENDTC"),
  studyDay("SD-059", "CM", "CMSTDTC", "CMSTDY"),
  studyDay("SD-060", "CM", "CMENDTC", "CMENDY"),
  terminology("SD-061", "CM", "CMDOSU", "CL_DOSU", false),
  terminology("SD-062", "CM", "CMROUTE", "CL_ROUTE", true),
  sourceLineageRule("SD-063", "CM"),
  required("SD-064", "MH", ["STUDYID", "USUBJID", "MHSEQ", "MHTERM"]),
  unique("SD-065", "MH", "MHSEQ"),
  dateRule("SD-066", "MH", "MHDTC"),
  dateRule("SD-067", "MH", "MHSTDTC"),
  dateRule("SD-068", "MH", "MHENDTC"),
  studyDay("SD-069", "MH", "MHDTC", "MHDY"),
  sourceLineageRule("SD-070", "MH"),
  required("SD-071", "IE", [
    "STUDYID",
    "USUBJID",
    "IESEQ",
    "IETESTCD",
    "IECAT",
    "IEORRES",
  ]),
  unique("SD-072", "IE", "IESEQ"),
  dateRule("SD-073", "IE", "IEDTC"),
  eligibilityRule("SD-074"),
  sourceLineageRule("SD-075", "IE"),
  required("SD-076", "RELREC", ["STUDYID", "RDOMAIN", "IDVAR", "RELID"]),
  relatedRecordsRule("SD-077"),
  sourceLineageRule("SD-078", "RELREC"),
  required("SD-079", "SE", ["STUDYID", "USUBJID", "SESEQ", "ETCD", "SESTDTC"]),
  unique("SD-080", "SE", "SESEQ"),
  elementContinuityRule("SD-081"),
  elementPlanRule("SD-082"),
  dateRule("SD-083", "SE", "SESTDTC"),
  sourceLineageRule("SD-084", "SE"),
  required("SD-085", "CO", ["STUDYID", "USUBJID", "COSEQ", "COVAL"]),
  unique("SD-086", "CO", "COSEQ"),
  commentTargetRule("SD-087"),
  sourceLineageRule("SD-088", "CO"),
  sourceLineageRule("SD-089", "CE"),
  sourceLineageRule("SD-090", "QS"),
  required("AD-001", "ADSL", ["STUDYID", "USUBJID", "TRTSDT"], "adam"),
  unique("AD-002", "ADSL", "USUBJID", "adam"),
  adamRule("AD-003", "ADVS", "base"),
  adamRule("AD-004", "ADVS", "chg"),
  adamRule("AD-005", "ADAE", "trtemfl"),
  adamRule("AD-011", "ADEG", "base"),
  adamRule("AD-012", "ADEG", "chg"),
  adamSourceRule("AD-013", "ADEG"),
  exceptionRule(
    "AD-014",
    "ADEG",
    "CRIT1FL",
    "QTcF is above 500 ms or rose more than 60 ms from baseline, an ICH E14 categorical outlier to review.",
    (dataset, row) =>
      at(dataset, "PARAMCD", row) === "QTCFAG" &&
      at(dataset, "DTYPE", row) === null &&
      (at(dataset, "CRIT1FL", row) === "Y" ||
        at(dataset, "CRIT2FL", row) === "Y")
  ),
  qtcfNotDerivedRule("AD-015"),
  adamRule("AD-016", "ADCM", "prefl"),
  adamRule("AD-017", "ADCM", "ontrtfl"),
  adamSourceRule("AD-018", "ADCM"),
  ...(["DM", "SV", "EX", "AE", "VS", "LB", "DS", "SUPPDM"] as const).map(
    (domain, index) => sourceLineageRule(`SD-0${40 + index}`, domain)
  ),
  ...(["ADSL", "ADVS", "ADLB", "ADAE", "ADTTE"] as const).map((domain, index) =>
    adamSourceRule(`AD-${String(6 + index).padStart(3, "0")}`, domain)
  ),
];
