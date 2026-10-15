/**
 * Seeded study variants (#2169, #2275). The default seed plays the authored
 * study exactly; any other seed (an Arcade Daily, or "Try another study")
 * plays a different arrangement of the same authored beats, so the issues
 * land on other subjects, visits and days and the sites behave differently,
 * while every beat stays winnable with the reference pipelines.
 *
 * Beats (the study plan):
 * - Partial date: the MH payload with the partial start date ("2025-10")
 *   swaps with another subject's whole MH payload, so any of the six
 *   subjects can carry it. Every site keys MH start dates in ISO 8601 and
 *   every MH payload has the same fields, so attention costs are unchanged.
 * - Narrative repeat: the free-text "120/80 sitting, repeat after rest
 *   118/78" moves to a Site A Day 7 or Day 14 visit, or a Site B Day 0 visit,
 *   written from that visit's own reading. A free-text field costs the same
 *   attention as the two numeric fields it replaces, so Site B's fatigued
 *   backlog session is not disturbed. Site C keys kPa decimals, which
 *   RegexSplit does not read, so it never carries the narrative.
 * - Transposition (the late correction): the scripted fatigue keying error
 *   lands on one of the Site B systolics the backlog session keys below the
 *   fatigue threshold, each 120 to 129 mmHg, so it transposes out of range.
 * - Late backlog: Site B keys its Day 24 visits on Day 26 or Day 27, both on
 *   or after its amendment activation, so routing by submission date still
 *   misroutes them.
 *
 * Site behaviour: each site's starting goodwill moves by up to 6 either way,
 * which changes its reply delays, its rubber-stamp risk and the score.
 *
 * Timeline and numbers (#2169):
 * - Arrival: each entry session lands 0 to 90 minutes later than authored,
 *   never later than 22:30 that day, so no session crosses a wave end.
 * - Vitals: one offset per site per measure (-3 to +3 mmHg or bpm), applied
 *   to sitting and standing alike so orthostatic drops, and their flags, are
 *   unchanged, and to every submission of the site alike so repeated values
 *   stay repeated. An offset that would take any of the site's values out of
 *   range, or across a range limit, is dropped.
 * - Untouched: free-text narratives, kPa sites (their conversion rounds), and
 *   the transposition carrier, whose worksheet must match its reading.
 */
import {
  DEFAULT_SEED,
  FULL_SUBMISSIONS,
  RANGE_LIMITS,
  SCRIPTED_TRANSPOSITIONS,
  SITE_CLARIFICATIONS,
  SITE_IDS,
  SITE_PROFILES,
  SOURCE_WORKSHEETS,
} from "../presets";
import type {
  SiteId,
  SourceWorksheet,
  StudyPlan,
  SubmissionFixture,
} from "../types";
import { clamp } from "@/lib/game-utils";
import { MINUTES_PER_DAY, TRIAL_DAY0_EPOCH_MS } from "./clock";
import { seededDraw } from "./rng";

/** The most an entry session is delayed, in minutes. */
const MAX_ARRIVAL_DELAY = 90;
/** The latest minute of the day a delayed session may land (22:30). */
const LATEST_MINUTE_OF_DAY = 22 * 60 + 30;
/** The largest vital-sign offset, either way. */
const MAX_VITAL_OFFSET = 3;
/** The largest starting-goodwill offset, either way. */
const MAX_GOODWILL_OFFSET = 6;

/** The authored carriers, which the default seed keeps. */
const AUTHORED = {
  partialDate: "sub-a02-mh",
  narrative: "sub-a01-d07",
  transposition: SCRIPTED_TRANSPOSITIONS[0].submissionId,
  lateBacklogDay: 27,
} as const;

/** MH submissions that can carry the partial date: every subject's. */
const PARTIAL_DATE_CARRIERS = [
  "sub-a01-mh",
  "sub-a02-mh",
  "sub-b01-mh",
  "sub-b02-mh",
  "sub-c01-mh",
  "sub-c02-mh",
] as const;
/** Wave 1 mmHg visits RegexSplit can read that carry no other beat. */
const NARRATIVE_CARRIERS = [
  "sub-a01-d07",
  "sub-a02-d07",
  "sub-a01-d14",
  "sub-a02-d14",
  "sub-b01-d00",
  "sub-b02-d00",
] as const;
/**
 * Site B systolics its Wave 1 backlog session keys below the fatigue
 * threshold, each 120 to 129 mmHg so the transposition is out of range.
 */
const TRANSPOSITION_CARRIERS = [
  "sub-b02-d07",
  "sub-b01-d14",
  "sub-b02-d14",
] as const;
/** The session Site B keys its late Day 24 backlog in. */
const LATE_BACKLOG_SESSION = "sess-b-day27-backlog";
const LATE_BACKLOG_DAYS = [26, 27] as const;

const FAMILIES = {
  sbp: { range: RANGE_LIMITS.SYSBP, keys: ["sbp", "sbp_sit", "sbp_stand"] },
  dbp: { range: RANGE_LIMITS.DIABP, keys: ["dbp", "dbp_sit", "dbp_stand"] },
  pulse: { range: RANGE_LIMITS.PULSE, keys: ["pulse"] },
} as const;
type Family = keyof typeof FAMILIES;

const LEAD_READING = /^(\d{2,3})\/(\d{2,3})/;

function pick<T>(seed: number, key: string, options: readonly T[]): T {
  return options[Math.floor(seededDraw(seed, key) * options.length)];
}

function shiftIso(iso: string, minutes: number): string {
  const ms = Date.parse(iso) + minutes * 60_000;
  return `${new Date(ms).toISOString().slice(0, 19)}Z`;
}

function minuteOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function trialDayOfIso(iso: string): number {
  return Math.floor(
    (Date.parse(iso) - TRIAL_DAY0_EPOCH_MS) / (MINUTES_PER_DAY * 60_000)
  );
}

function authoredFixture(id: string): SubmissionFixture {
  return FULL_SUBMISSIONS.find(
    (f) => f.submissionId === id
  ) as SubmissionFixture;
}

/** The narrative a site keys for a reading with a repeat after rest. */
function narrativeText(sbp: number, dbp: number): string {
  return `${sbp}/${dbp} sitting, repeat after rest ${sbp - 2}/${dbp - 2}`;
}

function clarificationText(sbp: number, dbp: number): string {
  return `The scheduled assessment is the first reading, ${sbp}/${dbp} sitting. The repeat after rest (${sbp - 2}/${dbp - 2}) was an unscheduled check and is retained as a note.`;
}

function worksheetFor(f: SubmissionFixture): SourceWorksheet {
  const authored = SOURCE_WORKSHEETS[AUTHORED.transposition];
  return {
    hospital: authored.hospital,
    clinician: authored.clinician,
    text: `Blood Pressure: ${String(f.payload.sbp)}/${String(f.payload.dbp)} mmHg, Pulse: ${String(f.payload.pulse)} bpm`,
  };
}

/** The reading a visit's narrative is written from: its authored one. */
function authoredReading(id: string): { sbp: number; dbp: number } {
  const { payload } = authoredFixture(id);
  if (typeof payload.sbp === "number" && typeof payload.dbp === "number")
    return { sbp: payload.sbp, dbp: payload.dbp };
  const lead = LEAD_READING.exec(String(payload.raw_bp ?? ""));
  return { sbp: Number(lead?.[1]), dbp: Number(lead?.[2]) };
}

/**
 * Where this seed puts the study's puzzle beats and how its sites behave.
 * A pure function of the seed, so a save replays against the same study.
 */
export function studyPlan(seed: number): StudyPlan {
  const initialGoodwill = {} as Record<SiteId, number>;
  for (const id of SITE_IDS) {
    const offset =
      seed === DEFAULT_SEED
        ? 0
        : Math.floor(
            seededDraw(seed, `variant|goodwill|${id}`) *
              (MAX_GOODWILL_OFFSET * 2 + 1)
          ) - MAX_GOODWILL_OFFSET;
    initialGoodwill[id] = clamp(
      SITE_PROFILES[id].initialGoodwill + offset,
      0,
      100
    );
  }
  if (seed === DEFAULT_SEED) {
    return {
      seed,
      partialDateSubmissionId: AUTHORED.partialDate,
      narrativeSubmissionId: AUTHORED.narrative,
      transpositionSubmissionId: AUTHORED.transposition,
      lateBacklogDay: AUTHORED.lateBacklogDay,
      initialGoodwill,
      worksheets: { ...SOURCE_WORKSHEETS },
      clarifications: { ...SITE_CLARIFICATIONS },
    };
  }
  const narrative = pick(seed, "variant|beat|narrative", NARRATIVE_CARRIERS);
  const transposition = pick(
    seed,
    "variant|beat|transposition",
    TRANSPOSITION_CARRIERS
  );
  const reading = authoredReading(narrative);
  return {
    seed,
    partialDateSubmissionId: pick(
      seed,
      "variant|beat|partial-date",
      PARTIAL_DATE_CARRIERS
    ),
    narrativeSubmissionId: narrative,
    transpositionSubmissionId: transposition,
    lateBacklogDay: pick(seed, "variant|beat|late-backlog", LATE_BACKLOG_DAYS),
    initialGoodwill,
    worksheets: {
      [transposition]: worksheetFor(authoredFixture(transposition)),
    },
    clarifications: {
      [narrative]: clarificationText(reading.sbp, reading.dbp),
    },
  };
}

/** A narrative payload back as numbers, in the narrative's place. */
function plainPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const lead = LEAD_READING.exec(String(payload.raw_bp ?? ""));
  if (!lead) return payload;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "raw_bp") {
      next.sbp = Number(lead[1]);
      next.dbp = Number(lead[2]);
    } else {
      next[key] = value;
    }
  }
  return next;
}

/** A numeric payload as a narrative, in the place of its systolic. */
function narrativePayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const { sbp, dbp } = payload;
  if (typeof sbp !== "number" || typeof dbp !== "number") return payload;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "sbp") next.raw_bp = narrativeText(sbp, dbp);
    else if (key !== "dbp") next[key] = value;
  }
  return next;
}

/**
 * Moves the authored beats onto the plan's carriers. A beat whose authored
 * carrier is not among the fixtures (as in the tracer) stays out.
 */
function placeBeats(
  fixtures: readonly SubmissionFixture[],
  plan: StudyPlan
): SubmissionFixture[] {
  const byId = new Map(fixtures.map((f) => [f.submissionId, f]));
  const partialFrom = AUTHORED.partialDate;
  const partialTo = plan.partialDateSubmissionId;
  const swapPartial =
    partialTo !== partialFrom && byId.has(partialFrom) && byId.has(partialTo);
  const moveNarrative =
    plan.narrativeSubmissionId !== AUTHORED.narrative &&
    typeof byId.get(AUTHORED.narrative)?.payload.raw_bp === "string" &&
    byId.has(plan.narrativeSubmissionId);
  return fixtures.map((f) => {
    let payload = f.payload;
    if (swapPartial && f.submissionId === partialFrom)
      payload = { ...(byId.get(partialTo) as SubmissionFixture).payload };
    if (swapPartial && f.submissionId === partialTo)
      payload = { ...(byId.get(partialFrom) as SubmissionFixture).payload };
    if (moveNarrative && f.submissionId === AUTHORED.narrative)
      payload = plainPayload(payload);
    if (moveNarrative && f.submissionId === plan.narrativeSubmissionId)
      payload = narrativePayload(payload);
    let submittedAt = f.submittedAt;
    if (f.sessionId === LATE_BACKLOG_SESSION) {
      const shift = plan.lateBacklogDay - trialDayOfIso(f.submittedAt);
      if (shift !== 0) submittedAt = shiftIso(submittedAt, shift * 24 * 60);
    }
    return payload === f.payload && submittedAt === f.submittedAt
      ? f
      : { ...f, payload, submittedAt };
  });
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

function isMmHgVitals(f: SubmissionFixture, carrier: string): boolean {
  return (
    f.kind === "VS" && f.submissionId !== carrier && f.payload.bp_unit !== "kPa"
  );
}

/** One offset per site and family that keeps every value's range verdict. */
function vitalOffsets(
  seed: number,
  fixtures: readonly SubmissionFixture[],
  carrier: string
): Map<string, number> {
  const offsets = new Map<string, number>();
  const sites = new Set<SiteId>(fixtures.map((f) => f.siteId));
  for (const site of sites) {
    const mine = fixtures.filter(
      (f) => f.siteId === site && isMmHgVitals(f, carrier)
    );
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
  const plan = studyPlan(seed);
  const placed = placeBeats(fixtures, plan);
  const carrier = plan.transpositionSubmissionId;
  const offsets = vitalOffsets(seed, placed, carrier);
  const delays = sessionDelays(seed, placed);
  return placed.map((f) => {
    const delay = delays.get(f.sessionId) ?? 0;
    let payload = f.payload;
    if (isMmHgVitals(f, carrier)) {
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

/** The fatigue transpositions this seed scripts in its entry sessions. */
export function scriptedTranspositions(
  seed: number
): typeof SCRIPTED_TRANSPOSITIONS {
  if (seed === DEFAULT_SEED) return SCRIPTED_TRANSPOSITIONS;
  const submissionId = studyPlan(seed).transpositionSubmissionId;
  return SCRIPTED_TRANSPOSITIONS.map((t) => ({ ...t, submissionId }));
}
