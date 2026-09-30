import type { Phase, StudyState } from "@/lib/study-director";

/** Minutes after midnight the working day starts. */
export const DAY_START = 8 * 60;
/** Minutes after midnight the office day ends; work after this is overtime. */
export const DAY_END = 18 * 60;
/** Minutes after midnight past which the Study Director must go home. */
export const HARD_STOP = 22 * 60;
/** Minutes of the working day routine load takes per attention point it would have cost. */
export const ROUTINE_MINUTES_PER_POINT = 45;

/** Kinds of things the player spends time on. */
export const WORLD_ACTIONS = [
  "walk",
  "talk",
  "readMail",
  "reviewEdc",
  "document",
  "sponsorCall",
  "meeting",
  "amendment",
  "coffee",
] as const;
export type WorldActionKind = (typeof WORLD_ACTIONS)[number];

/** What one action costs the player. Walking is priced per tile. */
export interface ActionCost {
  minutes: number;
  /** Energy spent, 0 to 100 scale. */
  energy: number;
  /** Focus spent, 0 to 100 scale. Demanding work spends more. */
  focus: number;
}

/**
 * The world on top of a study: the clock, the player's energy and focus,
 * and what the player has learned. The study itself stays authoritative
 * (ADR 0055) and runs in clock budget mode.
 */
export interface WorldState {
  version: 1;
  study: StudyState;
  /** Minutes after midnight. */
  minute: number;
  /** 0 to 100. Spent by activity, restored overnight. */
  energy: number;
  /** 0 to 100. Spent by demanding work, restored overnight and by coffee. */
  focus: number;
  /** Cups of coffee today. */
  coffees: number;
  /** Minutes worked past the end of the office day, today. */
  overtime: number;
  /** Energy the player could not recover overnight after working late. */
  fatigue: number;
  /** Where the player is. */
  location: string;
  /** Facts the player has learned, by id. */
  known: string[];
}

export type WorldRefusal =
  "too-late" | "too-tired" | "unknown-action" | "study-complete";

export type WorldResult<T extends object = object> =
  ({ ok: true; world: WorldState } & T) | { ok: false; reason: WorldRefusal };

/** One line of the morning digest, most important first. */
export interface DigestLine {
  text: string;
  tone: "neutral" | "good" | "bad";
}

/** What the player is told on arriving in the morning. Short on purpose. */
export interface MorningDigest {
  day: number;
  weekday: string;
  phase: Phase;
  /** Clock time the player can start on their own work, after routine load. */
  startsAt: number;
  routineMinutes: number;
  energy: number;
  lines: DigestLine[];
}

/** One change the player learns about overnight. */
export interface OvernightLine {
  text: string;
  tone: "neutral" | "good" | "bad";
}

/** What happened while the player was home, from what they could know. */
export interface OvernightReport {
  day: number;
  lines: OvernightLine[];
  /** Set when the study moved into a new phase overnight. */
  newPhase: Phase | null;
  /** True when the study finished overnight. */
  complete: boolean;
}
