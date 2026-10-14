/**
 * Endless-mode escalation for Clinical Trial Chaos: "Audit Years" (#2053).
 *
 * Endless mode runs on phase 1 rules, so on its own it never gets harder.
 * Every `AUDIT_YEAR_LOCKS` locked CRFs the study enters a new Audit Year, and
 * each new year raises one difficulty axis in a fixed rotation: the spawn
 * interval tightens, then a station opens, then the error chance rises, then
 * amendments arrive more often, then the rotation starts again. Every
 * function here is pure; the component and the tests share them.
 */
import { clamp } from "../game-utils";

/** CRF locks that make up one Audit Year in endless mode. */
export const AUDIT_YEAR_LOCKS = 6;

/** A difficulty axis an Audit Year can raise. */
export type AuditYearAxis = "spawn" | "stations" | "errors" | "amendments";

/** The order in which successive Audit Years raise the axes. */
export const AUDIT_YEAR_AXES: readonly AuditYearAxis[] = [
  "spawn",
  "stations",
  "errors",
  "amendments",
];

/** Stations open at the start of an endless run. */
export const ENDLESS_BASE_STATIONS = 6;

/** Every station the floor can hold. */
export const ENDLESS_MAX_STATIONS = 8;

/** Spawn interval multiplier applied by each spawn step. */
const SPAWN_STEP_FACTOR = 0.85;
/** The spawn interval never drops below this share of the phase rate. */
const MIN_SPAWN_FACTOR = 0.35;
/** Error chance added by each error step. */
const ERROR_STEP = 0.1;
/** Highest error chance escalation can reach. */
const MAX_ERROR_CHANCE = 0.95;
/** Amendment interval multiplier applied by each amendment step. */
const AMENDMENT_STEP_FACTOR = 0.8;
/** The amendment interval never drops below this share of the phase rate. */
const MIN_AMENDMENT_FACTOR = 0.4;

/** How many times each axis has been raised by a given Audit Year. */
export type AuditYearEscalation = Readonly<Record<AuditYearAxis, number>>;

/**
 * The Audit Year an endless run is in after a number of CRF locks. Year 1
 * covers the first `AUDIT_YEAR_LOCKS` locks.
 *
 * @param locks - CRFs locked so far this run.
 * @returns The Audit Year, starting at 1.
 */
export function getAuditYear(locks: number): number {
  const safe = Number.isFinite(locks) ? Math.max(0, Math.floor(locks)) : 0;
  return 1 + Math.floor(safe / AUDIT_YEAR_LOCKS);
}

/**
 * Locks still needed to reach the next Audit Year.
 *
 * @param locks - CRFs locked so far this run.
 * @returns A count from 1 to `AUDIT_YEAR_LOCKS`.
 */
export function getLocksToNextAuditYear(locks: number): number {
  const safe = Number.isFinite(locks) ? Math.max(0, Math.floor(locks)) : 0;
  return AUDIT_YEAR_LOCKS - (safe % AUDIT_YEAR_LOCKS);
}

/**
 * The axis raised on entering a year, or `null` for year 1.
 *
 * @param year - The Audit Year.
 * @returns The axis that year raised.
 */
export function getAuditYearAxis(year: number): AuditYearAxis | null {
  const tier = Math.floor(year) - 1;
  if (!Number.isFinite(tier) || tier < 1) return null;
  return AUDIT_YEAR_AXES[(tier - 1) % AUDIT_YEAR_AXES.length];
}

/**
 * How many steps each axis has taken by a given year. Once every station is
 * open, further station steps tighten the spawn interval instead, so each
 * year still makes the run harder.
 *
 * @param year - The Audit Year.
 * @returns Steps per axis.
 */
export function getAuditYearEscalation(year: number): AuditYearEscalation {
  const tier = Number.isFinite(year) ? Math.max(0, Math.floor(year) - 1) : 0;
  const steps = AUDIT_YEAR_AXES.map((_, i) =>
    tier > i ? Math.floor((tier - 1 - i) / AUDIT_YEAR_AXES.length) + 1 : 0
  );
  const [spawn, rawStations, errors, amendments] = steps;
  const stationRoom = ENDLESS_MAX_STATIONS - ENDLESS_BASE_STATIONS;
  const stations = Math.min(rawStations, stationRoom);
  return {
    spawn: spawn + (rawStations - stations),
    stations,
    errors,
    amendments,
  };
}

/**
 * Multiplier on the phase spawn interval for a year: 1 in year 1, smaller as
 * the spawn axis rises, never below `MIN_SPAWN_FACTOR`.
 *
 * @param year - The Audit Year.
 * @returns A factor from 0.35 to 1.
 */
export function getAuditYearSpawnFactor(year: number): number {
  const { spawn } = getAuditYearEscalation(year);
  return Math.max(MIN_SPAWN_FACTOR, SPAWN_STEP_FACTOR ** spawn);
}

/**
 * Stations open in endless mode in a given year.
 *
 * @param year - The Audit Year.
 * @returns A count from 6 to 8.
 */
export function getAuditYearStationCount(year: number): number {
  return ENDLESS_BASE_STATIONS + getAuditYearEscalation(year).stations;
}

/**
 * Chance that a new subject carries a data error in a given year.
 *
 * @param baseChance - The chance before escalation.
 * @param year - The Audit Year.
 * @returns A probability, at most 0.95.
 */
export function getAuditYearErrorChance(
  baseChance: number,
  year: number
): number {
  const { errors } = getAuditYearEscalation(year);
  const safeBase = Number.isFinite(baseChance) ? baseChance : 0;
  return clamp(safeBase + ERROR_STEP * errors, 0, MAX_ERROR_CHANCE);
}

/**
 * Multiplier on the seconds between random amendments for a year.
 *
 * @param year - The Audit Year.
 * @returns A factor from 0.4 to 1.
 */
export function getAuditYearAmendmentFactor(year: number): number {
  const { amendments } = getAuditYearEscalation(year);
  return Math.max(MIN_AMENDMENT_FACTOR, AMENDMENT_STEP_FACTOR ** amendments);
}

/** What each axis does, as the audit log and the announcer say it. */
const AXIS_COPY: Readonly<Record<AuditYearAxis, string>> = {
  spawn: "Enrollment accelerates: CRFs reach the conveyor faster.",
  stations: "A new SDTM domain station opens on the floor.",
  errors: "Site data quality slips: more CRFs arrive with discrepancies.",
  amendments: "The sponsor files protocol amendments more often.",
};

/**
 * What entering a year changes, in one sentence for the announcer and log.
 *
 * @param year - The Audit Year just entered.
 * @returns The sentence.
 */
export function describeAuditYear(year: number): string {
  const axis = getAuditYearAxis(year);
  if (!axis) return "Initial inspection cycle.";
  // A spent station step tightens the spawn interval instead.
  if (
    axis === "stations" &&
    getAuditYearEscalation(year).stations ===
      getAuditYearEscalation(year - 1).stations
  ) {
    return AXIS_COPY.spawn;
  }
  return AXIS_COPY[axis];
}

/**
 * The audit log line for entering a new Audit Year.
 *
 * @param year - The Audit Year just entered.
 * @returns The log message.
 */
export function formatAuditYearLog(year: number): string {
  return `[AUDIT YEAR ${year}] FDA re-inspection cycle begins. ${describeAuditYear(year)}`;
}

/** The best endless run a viewer has recorded. */
export interface EndlessBest {
  score: number;
  auditYear: number;
}

/** Local storage key for the endless best, separate from the campaign score. */
export const ENDLESS_BEST_STORAGE_KEY = "clinical_chaos_endless_best";

/**
 * Reads a stored endless best, falling back to zero for anything missing or
 * malformed.
 *
 * @param raw - The stored string, if any.
 * @returns The parsed best.
 */
export function parseEndlessBest(raw: string | null | undefined): EndlessBest {
  const empty: EndlessBest = { score: 0, auditYear: 1 };
  if (!raw) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return empty;
    const { score, auditYear } = parsed as Record<string, unknown>;
    return {
      score:
        typeof score === "number" && Number.isFinite(score)
          ? Math.max(0, Math.floor(score))
          : 0,
      auditYear:
        typeof auditYear === "number" && Number.isFinite(auditYear)
          ? Math.max(1, Math.floor(auditYear))
          : 1,
    };
  } catch {
    return empty;
  }
}

/**
 * Merges a finished or running endless result into the best: the higher
 * score and the furthest Audit Year are kept independently.
 *
 * @param best - The best so far.
 * @param score - This run's score.
 * @param auditYear - This run's Audit Year.
 * @returns The new best, and whether it changed.
 */
export function mergeEndlessBest(
  best: EndlessBest,
  score: number,
  auditYear: number
): { best: EndlessBest; improved: boolean } {
  const safeScore = Number.isFinite(score) ? Math.floor(score) : 0;
  const safeYear = Number.isFinite(auditYear) ? Math.floor(auditYear) : 1;
  const next: EndlessBest = {
    score: Math.max(best.score, safeScore),
    auditYear: Math.max(best.auditYear, safeYear),
  };
  return {
    best: next,
    improved: next.score !== best.score || next.auditYear !== best.auditYear,
  };
}

/**
 * Adds stations a new Audit Year opened to the live floor. Stations already
 * open keep their position (a scramble survives) and their counts; each new
 * one takes the next free position.
 *
 * @param current - Stations on the floor now.
 * @param target - Stations the new year opens, from `getStationsForPhase`.
 * @returns The floor with any new stations appended.
 */
export function addOpenedStations<
  T extends { id: string; positionIndex: number },
>(current: readonly T[], target: readonly T[]): T[] {
  const open = new Set(current.map((station) => station.id));
  let nextPosition =
    current.reduce((max, station) => Math.max(max, station.positionIndex), -1) +
    1;
  const added = target
    .filter((station) => !open.has(station.id))
    .map((station) => ({ ...station, positionIndex: nextPosition++ }));
  return [...current, ...added];
}
