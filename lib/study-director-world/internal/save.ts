import { clamp } from "@/lib/game-utils";
import type { StudyState } from "@/lib/study-director";
import { DAY_START, HARD_STOP, type WorldState } from "../types";

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

/**
 * Reads a saved world run. Anything unreadable, from another version, or
 * missing its study is dropped (returns null) rather than trusted; numbers
 * are clamped to their ranges.
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
  return {
    version: 1,
    study: { ...raw.study, budget: "clock" },
    minute: num(raw.minute, DAY_START, 0, HARD_STOP),
    energy: num(raw.energy, 100, 0, 100),
    focus: num(raw.focus, 100, 0, 100),
    coffees: Math.floor(num(raw.coffees, 0, 0, 50)),
    overtime: num(raw.overtime, 0, 0, 24 * 60),
    fatigue: num(raw.fatigue, 0, 0, 100),
    location: typeof raw.location === "string" ? raw.location : "lobby",
    known: Array.isArray(raw.known)
      ? raw.known.filter((k): k is string => typeof k === "string")
      : [],
  };
}
