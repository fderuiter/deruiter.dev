/**
 * Pure transformation contracts behind each Tabulation chip. Executors in
 * the pipeline runner call these; tests can call them directly.
 */
import { KPA_TO_MMHG } from "../presets";
import type {
  ProtocolVersion,
  SiteProfile,
  VsPosition,
  VsTestCode,
} from "../types";

/** Result of standardizing one value. */
export interface StandardizedValue {
  orres: string;
  orresu: string;
  stresn: number;
  stresu: string;
  /** Decimal places for display. */
  precision: number;
}

function decimals(text: string): number {
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * UnitStandardizer: kPa x 7.50062 = mmHg, kept unrounded; mmHg and
 * beats/min pass through. The original value and unit are preserved.
 * Returns null for an unknown unit, which is quarantined, never guessed.
 */
export function standardizeUnit(
  orres: string,
  unit: string
): StandardizedValue | null {
  const value = Number(orres);
  if (orres.trim() === "" || !Number.isFinite(value)) return null;
  if (unit === "kPa") {
    return {
      orres,
      orresu: "kPa",
      stresn: value * KPA_TO_MMHG,
      stresu: "mmHg",
      precision: 1,
    };
  }
  if (unit === "mmHg" || unit === "beats/min") {
    return {
      orres,
      orresu: unit,
      stresn: value,
      stresu: unit,
      precision: decimals(orres),
    };
  }
  return null;
}

/** Rounds a value for display at the given precision. */
export function formatDisplay(value: number, precision: number): string {
  const factor = 10 ** precision;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return rounded.toFixed(precision);
}

function validCalendarDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last;
}

function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Result of normalizing a collected date. */
export type DateNormalization =
  { ok: true; iso: string; partial: boolean } | { ok: false; reason: string };

/**
 * DateLocaleNormalizer: resolves DD/MM/YYYY or MM/DD/YYYY against the site's
 * verified profile and accepts ISO dates and partial dates (YYYY-MM, YYYY,
 * MM/YYYY). Anything else is unparseable.
 */
export function normalizeDate(
  raw: string,
  dateFormat: SiteProfile["dateFormat"]
): DateNormalization {
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return validCalendarDate(y, m, d)
      ? { ok: true, iso: text, partial: false }
      : { ok: false, reason: `Invalid calendar date: ${raw}` };
  }
  const isoMonth = /^(\d{4})-(\d{2})$/.exec(text);
  if (isoMonth) {
    const m = Number(isoMonth[2]);
    return m >= 1 && m <= 12
      ? { ok: true, iso: text, partial: true }
      : { ok: false, reason: `Invalid month: ${raw}` };
  }
  if (/^\d{4}$/.test(text)) return { ok: true, iso: text, partial: true };
  const monthYear = /^(\d{1,2})\/(\d{4})$/.exec(text);
  if (monthYear) {
    const m = Number(monthYear[1]);
    return m >= 1 && m <= 12
      ? {
          ok: true,
          iso: `${monthYear[2]}-${String(m).padStart(2, "0")}`,
          partial: true,
        }
      : { ok: false, reason: `Invalid month: ${raw}` };
  }
  const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (slashed) {
    const a = Number(slashed[1]);
    const b = Number(slashed[2]);
    const y = Number(slashed[3]);
    const [m, d] = dateFormat === "DD/MM/YYYY" ? [b, a] : [a, b];
    return validCalendarDate(y, m, d)
      ? { ok: true, iso: isoOf(y, m, d), partial: false }
      : { ok: false, reason: `Invalid ${dateFormat} date: ${raw}` };
  }
  return { ok: false, reason: `Unparseable date: ${raw}` };
}

/** Result of RegexSplit on a free-text blood pressure entry. */
export interface RegexSplitResult {
  sbp: number | null;
  dbp: number | null;
  /** Text after the primary reading; empty when nothing remains. */
  unmatched: string;
  /** Every SBP/DBP reading found in the text. */
  readings: Array<{ sbp: number; dbp: number }>;
}

/**
 * RegexSplit: matches ^(\d{2,3})\/(\d{2,3}) as the protocol's primary
 * reading. The rest of the text, including any repeat reading, goes to
 * unmatched; it is never silently dropped.
 */
export function regexSplit(text: string): RegexSplitResult {
  const trimmed = text.trim();
  const readings = Array.from(trimmed.matchAll(/(\d{2,3})\/(\d{2,3})/g)).map(
    (m) => ({ sbp: Number(m[1]), dbp: Number(m[2]) })
  );
  const lead = /^(\d{2,3})\/(\d{2,3})/.exec(trimmed);
  if (!lead) {
    return { sbp: null, dbp: null, unmatched: trimmed, readings };
  }
  return {
    sbp: Number(lead[1]),
    dbp: Number(lead[2]),
    unmatched: trimmed.slice(lead[0].length).trim(),
    readings,
  };
}

/** Input the AmendmentRouter reads from a submission. */
export interface RouterInput {
  assessedAtMinute: number;
  submittedAtMinute: number;
  formVersion: ProtocolVersion | null;
}

/** Router decision. */
export interface RouterDecision {
  handle: "v1" | "v2" | "review";
  requiredVersion: ProtocolVersion;
  reason: string;
}

/**
 * AmendmentRouter: the applicable version is v2 when the routing timestamp is
 * on or after the site's activation, else v1. The routing timestamp is the
 * assessment date unless the chip is misconfigured to use submission time.
 * A form that does not match the applicable version goes to review.
 */
export function routeAmendment(
  input: RouterInput,
  activationMinute: number,
  routeBy: "assessedAt" | "submittedAt" = "assessedAt"
): RouterDecision {
  const at =
    routeBy === "assessedAt" ? input.assessedAtMinute : input.submittedAtMinute;
  const requiredVersion: ProtocolVersion = at >= activationMinute ? "v2" : "v1";
  if (input.formVersion === null) {
    return {
      handle: "review",
      requiredVersion,
      reason: "Missing protocol version metadata",
    };
  }
  if (input.formVersion !== requiredVersion) {
    return {
      handle: "review",
      requiredVersion,
      reason:
        requiredVersion === "v2"
          ? "Applicability discrepancy: v1 form used for a visit after v2 activation (standing BP required)"
          : "Applicability discrepancy: v2 form used for a visit governed by v1",
    };
  }
  return {
    handle: requiredVersion,
    requiredVersion,
    reason: `Routed by ${routeBy} to ${requiredVersion}`,
  };
}

/** Test and position each Pivot input handle writes. */
export const PIVOT_HANDLE_MAP: Readonly<
  Record<string, { testcd: VsTestCode; pos: VsPosition }>
> = {
  sbp: { testcd: "SYSBP", pos: "SITTING" },
  dbp: { testcd: "DIABP", pos: "SITTING" },
  pulse: { testcd: "PULSE", pos: "SITTING" },
  sbp_stand: { testcd: "SYSBP", pos: "STANDING" },
  dbp_stand: { testcd: "DIABP", pos: "STANDING" },
};

/** VSTEST label for a test code. */
export function vsTestName(
  testcd: VsTestCode
): "Systolic Blood Pressure" | "Diastolic Blood Pressure" | "Pulse Rate" {
  if (testcd === "SYSBP") return "Systolic Blood Pressure";
  if (testcd === "DIABP") return "Diastolic Blood Pressure";
  return "Pulse Rate";
}

/** The standard unit for a test code. */
export function standardUnit(testcd: VsTestCode): "mmHg" | "beats/min" {
  return testcd === "PULSE" ? "beats/min" : "mmHg";
}
