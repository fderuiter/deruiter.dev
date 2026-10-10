import { clamp } from "@/lib/game-utils";
import type { StudyState } from "@/lib/study-director";
import { CRO_FLOOR, WORLD_MAPS, isWalkable } from "./floor";
import { readVisit } from "./sites";
import {
  DAY_START,
  FACINGS,
  HARD_STOP,
  GUEST_IDS,
  PRIORITY_IDS,
  WORK_STREAMS,
  type Assignment,
  type DayPlan,
  type GuestRecord,
  type Bond,
  type CallRecord,
  type Meeting,
  type Observation,
  type PlayerState,
  type WorldMap,
  type WorldState,
} from "../types";

/** Storage key for a world run. Separate from the classic desk's save. */
export const WORLD_SAVE_KEY = "study_director_world_v1";

/** A world run as JSON. */
export function serializeWorld(world: WorldState): string {
  return JSON.stringify(world);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number, lo: number, hi: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, lo, hi)
    : fallback;
}

function looksLikeStudy(value: unknown): value is StudyState {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.seed === "string" &&
    typeof value.day === "number" &&
    Array.isArray(value.sites) &&
    Array.isArray(value.team) &&
    Array.isArray(value.log) &&
    isRecord(value.setup)
  );
}

/** A saved position, if it is a free tile on its map; else the spawn. */
function readPlayer(value: unknown, map: WorldMap = CRO_FLOOR): PlayerState {
  if (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    isWalkable(map, value.x, value.y)
  ) {
    const facing = FACINGS.find((f) => f === value.facing) ?? "down";
    return { x: value.x, y: value.y, facing };
  }
  return { ...map.spawn };
}

const str = (v: unknown): v is string => typeof v === "string";
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter(str) : [];

function readBonds(value: unknown): Record<string, Bond> | undefined {
  if (!isRecord(value)) return undefined;
  const bonds: Record<string, Bond> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    bonds[id] = {
      trust: num(raw.trust, 50, 0, 100),
      confidence: num(raw.confidence, 50, 0, 100),
      coached: Math.floor(num(raw.coached, 0, 0, 1000)),
      talkedDay: Math.floor(num(raw.talkedDay, 0, 0, 10_000)),
      coachedDay: Math.floor(num(raw.coachedDay, 0, 0, 10_000)),
      askedDay: Math.floor(num(raw.askedDay, 0, 0, 10_000)),
      owns: WORK_STREAMS.find((w) => w === raw.owns) ?? null,
    };
    for (const key of ["coffeeDay", "favourDay", "coverDay"] as const)
      if (typeof raw[key] === "number")
        bonds[id][key] = Math.floor(num(raw[key], 0, 0, 10_000));
  }
  return bonds;
}

function readObservations(value: unknown): Observation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(
    (o): o is Observation =>
      isRecord(o) &&
      str(o.id) &&
      str(o.text) &&
      str(o.source) &&
      typeof o.day === "number"
  );
}

function readCalls(value: unknown): CallRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(
    (c): c is CallRecord =>
      isRecord(c) &&
      str(c.eventId) &&
      typeof c.day === "number" &&
      (c.status === "answered" ||
        c.status === "ignored" ||
        c.status === "voicemail")
  );
}

function readAssignments(value: unknown): Assignment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(
    (a): a is Assignment =>
      isRecord(a) &&
      str(a.id) &&
      str(a.memberId) &&
      WORK_STREAMS.some((w) => w === a.stream) &&
      typeof a.remaining === "number" &&
      typeof a.amount === "number"
  );
}

function readPlan(value: unknown): DayPlan | undefined {
  if (!isRecord(value) || typeof value.day !== "number") return undefined;
  return {
    day: Math.floor(num(value.day, 1, 1, 10_000)),
    priority: PRIORITY_IDS.find((p) => p === value.priority) ?? null,
    handled: strings(value.handled),
  };
}

function readGuests(value: unknown): GuestRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const records: GuestRecord[] = [];
  for (const entry of value.slice(-12)) {
    if (!isRecord(entry)) continue;
    const id = GUEST_IDS.find((g) => g === entry.id);
    if (!id || typeof entry.day !== "number") continue;
    if (entry.outcome !== "met" && entry.outcome !== "missed") continue;
    records.push({
      id,
      day: Math.floor(num(entry.day, 1, 1, 10_000)),
      outcome: entry.outcome,
      ...(typeof entry.choice === "string" && entry.choice.length <= 40
        ? { choice: entry.choice }
        : {}),
    });
  }
  return records;
}

function readMeeting(value: unknown): Meeting | null {
  if (
    isRecord(value) &&
    (value.kind === "team" || value.kind === "sponsor") &&
    typeof value.startedAt === "number"
  )
    return {
      kind: value.kind,
      attendees: strings(value.attendees),
      startedAt: value.startedAt,
      logStart: Math.floor(num(value.logStart, 0, 0, 100_000)),
    };
  return null;
}

/**
 * Reads a saved world run. Anything unreadable, from another version, or
 * missing its study is dropped (returns null) rather than trusted; numbers
 * are clamped to their ranges, and a position that is not a free tile on the
 * floor (or a save from before the floor existed) starts at the lobby.
 */
export function parseWorld(text: string | null): WorldState | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw.version !== 1 || !looksLikeStudy(raw.study))
    return null;
  // A site visit (#1690) is kept only while its map and site still exist.
  const visit = readVisit(raw.visit, raw.study);
  const map = visit ? WORLD_MAPS[visit.mapId] : CRO_FLOOR;
  const world: WorldState = {
    version: 1,
    study: { ...raw.study, budget: "clock" },
    minute: num(raw.minute, DAY_START, 0, HARD_STOP),
    energy: num(raw.energy, 100, 0, 100),
    focus: num(raw.focus, 100, 0, 100),
    coffees: Math.floor(num(raw.coffees, 0, 0, 50)),
    overtime: num(raw.overtime, 0, 0, 24 * 60),
    fatigue: num(raw.fatigue, 0, 0, 100),
    location: typeof raw.location === "string" ? raw.location : "lobby",
    player: readPlayer(
      (raw.map ?? CRO_FLOOR.id) === map.id ? raw.player : null,
      map
    ),
    walked: Math.floor(num(raw.walked, 0, 0, 100_000)),
    known: Array.isArray(raw.known)
      ? raw.known.filter((k): k is string => typeof k === "string")
      : [],
    map: map.id,
    visit,
  };
  // The team layer's fields are optional: keep only those the save has.
  const observations = readObservations(raw.observations);
  if (observations) world.observations = observations;
  const bonds = readBonds(raw.bonds);
  if (bonds) world.bonds = bonds;
  const calls = readCalls(raw.calls);
  if (calls) world.calls = calls;
  if (Array.isArray(raw.raised)) world.raised = strings(raw.raised);
  const assignments = readAssignments(raw.assignments);
  if (assignments) world.assignments = assignments;
  if ("meeting" in raw) world.meeting = readMeeting(raw.meeting);
  const plan = readPlan(raw.plan);
  if (plan) world.plan = plan;
  const guests = readGuests(raw.guests);
  if (guests) world.guests = guests;
  return world;
}
