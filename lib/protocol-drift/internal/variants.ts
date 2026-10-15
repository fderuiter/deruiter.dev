/**
 * Seeded study variants (#2169). The default seed plays the authored study
 * exactly; any other seed (an Arcade Daily, or "Try another study") shifts
 * when each site keys its sessions and nudges each site's vital signs, so the
 * timeline and the numbers on the worksheets change while every authored
 * puzzle beat, and the reference pipelines, still work.
 *
 * - Arrival: each entry session lands 0 to 90 minutes later than authored,
 *   never later than 22:30 that day, so no session crosses a wave end.
 * - Vitals: one offset per site per measure (-3 to +3 mmHg or bpm), applied
 *   to sitting and standing alike so orthostatic drops, and their flags, are
 *   unchanged, and to every submission of the site alike so repeated values
 *   stay repeated. An offset that would take any of the site's values out of
 *   range, or across a range limit, is dropped.
 * - Untouched: free-text narratives, kPa sites (their conversion rounds), and
 *   the authored transposition fixture, whose worksheet says 120/80.
 */
import {
  DEFAULT_SEED,
  RANGE_LIMITS,
  SCRIPTED_TRANSPOSITIONS,
} from "../presets";
import type { SiteId, SubmissionFixture } from "../types";
import { clamp } from "@/lib/game-utils";
import { seededDraw } from "./rng";

/** The most an entry session is delayed, in minutes. */
const MAX_ARRIVAL_DELAY = 90;
/** The latest minute of the day a delayed session may land (22:30). */
const LATEST_MINUTE_OF_DAY = 22 * 60 + 30;
/** The largest vital-sign offset, either way. */
const MAX_VITAL_OFFSET = 3;

const FAMILIES = {
  sbp: { range: RANGE_LIMITS.SYSBP, keys: ["sbp", "sbp_sit", "sbp_stand"] },
  dbp: { range: RANGE_LIMITS.DIABP, keys: ["dbp", "dbp_sit", "dbp_stand"] },
  pulse: { range: RANGE_LIMITS.PULSE, keys: ["pulse"] },
} as const;
type Family = keyof typeof FAMILIES;

const PROTECTED = new Set(SCRIPTED_TRANSPOSITIONS.map((t) => t.submissionId));

function shiftIso(iso: string, minutes: number): string {
  const ms = Date.parse(iso) + minutes * 60_000;
  return `${new Date(ms).toISOString().slice(0, 19)}Z`;
}

function minuteOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * Each session's delay in minutes for this seed: one delay per session, so
 * its submissions keep their order, capped by its latest submission's room.
 */
function sessionDelays(
  seed: number,
  fixtures: readonly SubmissionFixture[]
): Map<string, number> {
  const room = new Map<string, number>();
  for (const f of fixtures) {
    const left = LATEST_MINUTE_OF_DAY - minuteOfDay(f.submittedAt);
    room.set(f.sessionId, Math.min(room.get(f.sessionId) ?? left, left));
  }
  const delays = new Map<string, number>();
  for (const [session, left] of room) {
    const wanted = Math.floor(
      seededDraw(seed, `variant|arrival|${session}`) * (MAX_ARRIVAL_DELAY + 1)
    );
    delays.set(session, clamp(wanted, 0, Math.max(0, left)));
  }
  return delays;
}

function isMmHgVitals(f: SubmissionFixture): boolean {
  return (
    f.kind === "VS" &&
    !PROTECTED.has(f.submissionId) &&
    f.payload.bp_unit !== "kPa"
  );
}

/** One offset per site and family that keeps every value's range verdict. */
function vitalOffsets(
  seed: number,
  fixtures: readonly SubmissionFixture[]
): Map<string, number> {
  const offsets = new Map<string, number>();
  const sites = new Set<SiteId>(fixtures.map((f) => f.siteId));
  for (const site of sites) {
    const mine = fixtures.filter((f) => f.siteId === site && isMmHgVitals(f));
    for (const family of Object.keys(FAMILIES) as Family[]) {
      const { range, keys } = FAMILIES[family];
      const offset =
        Math.floor(
          seededDraw(seed, `variant|vitals|${site}|${family}`) *
            (MAX_VITAL_OFFSET * 2 + 1)
        ) - MAX_VITAL_OFFSET;
      const keepsVerdict = mine.every((f) =>
        keys.every((key) => {
          const value = f.payload[key];
          if (typeof value !== "number") return true;
          const inBefore = value >= range.low && value <= range.high;
          const next = value + offset;
          const inAfter = next >= range.low && next <= range.high;
          return inBefore === inAfter;
        })
      );
      offsets.set(`${site}|${family}`, keepsVerdict ? offset : 0);
    }
  }
  return offsets;
}

/** The study's submissions as this seed plays them. */
export function studyVariant(
  fixtures: readonly SubmissionFixture[],
  seed: number
): readonly SubmissionFixture[] {
  if (seed === DEFAULT_SEED) return fixtures;
  const offsets = vitalOffsets(seed, fixtures);
  const delays = sessionDelays(seed, fixtures);
  return fixtures.map((f) => {
    const delay = delays.get(f.sessionId) ?? 0;
    let payload = f.payload;
    if (isMmHgVitals(f)) {
      payload = { ...f.payload };
      for (const family of Object.keys(FAMILIES) as Family[]) {
        const offset = offsets.get(`${f.siteId}|${family}`) ?? 0;
        if (offset === 0) continue;
        for (const key of FAMILIES[family].keys) {
          const value = payload[key];
          if (typeof value === "number") payload[key] = value + offset;
        }
      }
    }
    return {
      ...f,
      submittedAt: delay > 0 ? shiftIso(f.submittedAt, delay) : f.submittedAt,
      payload,
    };
  });
}
