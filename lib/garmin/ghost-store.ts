/**
 * Virtual Partner storage for Monkey C Mayhem (#2020): one ghost per course,
 * category and seed, and the ghost options. Kept apart from the pure
 * lib/garmin/ghost.ts and from the engine bundle. Every read and write is
 * guarded: unreadable storage or a corrupt ghost reads as no ghost.
 */

import {
  COURSE_VERSION,
  boardKey,
  dailySeed,
  type RaceSetup,
} from "./race";
import { decodeGhost, encodeGhost, type GhostTrack } from "./ghost";
import { safeGetRawItem, safeSetRawItem } from "../safe-storage";

/** localStorage key holding every ghost, as one JSON object of ghost key to stored ghost. */
export const GHOST_STORE_KEY = "garmin_race_ghosts";
/** localStorage key: "0" when the Virtual Partner is off; on otherwise. */
export const GHOST_ON_KEY = "garmin_race_ghost";
/** localStorage key holding who the Virtual Partner replays. */
export const GHOST_TARGET_KEY = "garmin_race_ghost_target";

/** At most this many ghosts are kept; the oldest go first. */
export const MAX_GHOSTS = 10;

/** Who the Virtual Partner replays: your PR, or the course record. */
export type GhostTarget = "pr" | "cr";

/** Every target, in picker order. */
export const GHOST_TARGETS: readonly GhostTarget[] = ["pr", "cr"];

interface StoredGhost {
  timeMs: number;
  /** When it was run, as an ISO timestamp. */
  at: string;
  data: string;
}

/** The ghost key of a race: its board, seed and course version. */
function ghostKey(setup: RaceSetup): string {
  return `${boardKey(setup.course, setup.category)}:${setup.seed}:v${COURSE_VERSION}`;
}

function isStoredGhost(value: unknown): value is StoredGhost {
  if (typeof value !== "object" || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.timeMs === "number" &&
    Number.isFinite(g.timeMs) &&
    typeof g.at === "string" &&
    typeof g.data === "string"
  );
}

/** Every stored ghost, with malformed entries dropped. */
function readAll(): Record<string, StoredGhost> {
  try {
    const parsed: unknown = JSON.parse(
      safeGetRawItem(GHOST_STORE_KEY) ?? "null"
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    const out: Record<string, StoredGhost> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isStoredGhost(value)) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * The ghost for a race, or null when there is none or it is corrupt. Both
 * targets read the same ghost: this device keeps one profile, so its PR is
 * also its course record. Never throws.
 */
export function loadGhost(setup: RaceSetup): GhostTrack | null {
  try {
    const stored = readAll()[ghostKey(setup)];
    return stored ? decodeGhost(stored.data) : null;
  } catch {
    return null;
  }
}

/**
 * Whether a stored ghost can still be raced: it is from this course version,
 * and a Daily Workout ghost is from today's seed. `today` is `:<seed>:`.
 */
function isLive(key: string, today: string): boolean {
  if (!key.endsWith(`:v${COURSE_VERSION}`)) return false;
  return !key.startsWith("daily:") || key.includes(today);
}

/**
 * Stores `track` as the ghost for a race, replacing the one before. Ghosts
 * that can no longer be raced (another day's Daily Workout or an older course
 * version) are dropped first. Ghosts past {@link MAX_GHOSTS} are dropped
 * oldest first, and so are more when
 * storage is too full to take the new one. Returns whether it was stored.
 * Never throws.
 */
export function saveGhost(
  setup: RaceSetup,
  track: GhostTrack,
  date: Date
): boolean {
  try {
    const data = encodeGhost(track);
    if (data === null) return false;
    const key = ghostKey(setup);
    const today = `:${dailySeed(date)}:`;
    const others = Object.entries(readAll())
      .filter(([k]) => k !== key && isLive(k, today))
      .sort(([, a], [, b]) => b.at.localeCompare(a.at))
      .slice(0, MAX_GHOSTS - 1);
    const mine: StoredGhost = {
      timeMs: track.timeMs,
      at: date.toISOString(),
      data,
    };
    for (let keep = others.length; keep >= 0; keep--) {
      const next = Object.fromEntries([...others.slice(0, keep), [key, mine]]);
      const ok = safeSetRawItem(GHOST_STORE_KEY, JSON.stringify(next), {
        retainInMemory: false,
      });
      if (ok) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Whether the Virtual Partner is on. It is on unless switched off. */
export function readGhostOn(): boolean {
  try {
    return safeGetRawItem(GHOST_ON_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Who the Virtual Partner replays, your PR when none is stored. */
export function readGhostTarget(): GhostTarget {
  try {
    const raw = safeGetRawItem(GHOST_TARGET_KEY);
    return GHOST_TARGETS.find((t) => t === raw) ?? "pr";
  } catch {
    return "pr";
  }
}
