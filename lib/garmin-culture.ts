/**
 * Garmin, gym and running culture for Monkey C Mayhem (#2010).
 *
 * The rules and copy for the moments that make the game feel like a watch:
 * the GPS lock intro before each stage, the move alert when a runner stops
 * dead, the Training Effect, Training Status and Recovery Time on the game
 * over screen, the new PR banner, the auto pause title, and the short toasts
 * that pop up on stomp chains, power-ups, 1UPs, stage clears, the Rep Max
 * and bonks.
 *
 * Everything here is pure and deterministic: the same inputs give the same
 * bars, labels and toasts, so replays and tests repeat. This module answers
 * the rules and supplies the copy; the engine in `lib/garmin-engine.ts` and
 * the watch face call it.
 */
import { clamp } from "./game-utils";

/** How long the "Waiting for GPS…" intro runs at a stage start before GO. */
export const GPS_LOCK_MS = 1200;

/** Satellite bars shown during the intro, 0..4, rising with elapsed time; 4 once locked. */
export function gpsBars(elapsedMs: number): number {
  const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  const progress = clamp(elapsed / GPS_LOCK_MS, 0, 1);
  return Math.min(4, Math.floor(progress * 4));
}

/** Banner text for the intro: "WAITING FOR GPS…" until locked, then "GPS READY · GO!". */
export function gpsBannerText(elapsedMs: number): string {
  const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  return elapsed >= GPS_LOCK_MS ? "GPS READY · GO!" : "WAITING FOR GPS…";
}

/** Idle (braking, or not advancing) this long and the watch buzzes. */
export const MOVE_ALERT_IDLE_MS = 6000;
/** The text on the move alert. */
export const MOVE_ALERT_TEXT = "MOVE!";
/** The banner when a bonk ends and sprinting works again (#2022). */
export const BONK_OVER_TEXT = "RECOVERED · SPRINT IS BACK";
/** The banner when a Rest Day ends and the bricks and Kudos swap back (#2022). */
export const REST_DAY_OVER_TEXT = "REST DAY OVER";

/** The effort a stage took, read off the run when the stage is cleared. */
export interface StageEffort {
  /** Foes stomped or spun into during the stage. */
  foesDefeated: number;
  /** Hits taken during the stage. */
  hitsTaken: number;
  /** Lives lost during the stage. */
  livesLost: number;
  /** Height of the pole grab, 0 to 1 (1 is the top step). */
  poleHeight: number;
}

/** Training Effect for a cleared stage, 0.0..5.0 rounded to one decimal: base 2.0, +0.4 per foe defeated (max +1.6), +0.8 for no hits taken, +0.6 for a top-step pole grab (poleHeight >= 0.9), -0.5 per life lost (min 0). */
export function trainingEffect(effort: StageEffort): number {
  const foes = Number.isFinite(effort.foesDefeated)
    ? clamp(Math.floor(effort.foesDefeated), 0, 4)
    : 0;
  const noHits =
    Number.isFinite(effort.hitsTaken) && effort.hitsTaken <= 0 ? 0.8 : 0;
  const topStep =
    Number.isFinite(effort.poleHeight) && effort.poleHeight >= 0.9 ? 0.6 : 0;
  const lives = Number.isFinite(effort.livesLost)
    ? Math.max(0, effort.livesLost)
    : 0;
  const raw = 2.0 + foes * 0.4 + noHits + topStep - lives * 0.5;
  return Math.round(clamp(raw, 0, 5) * 10) / 10;
}

/** Garmin-style label for a Training Effect value: <1 "No Benefit", <2 "Minor", <3 "Maintaining", <4 "Improving", <5 "Highly Improving", 5 "Overreaching". */
export function trainingEffectLabel(te: number): string {
  if (!Number.isFinite(te) || te < 1) {
    return "No Benefit";
  }
  if (te < 2) {
    return "Minor";
  }
  if (te < 3) {
    return "Maintaining";
  }
  if (te < 4) {
    return "Improving";
  }
  if (te < 5) {
    return "Highly Improving";
  }
  return "Overreaching";
}

/** Training Status shown at game over, from the stage reached (1..5) and whether the 5K was finished: finished -> "Peaking"; stage 5 -> "Productive"; stage 3-4 -> "Maintaining"; stage 2 -> "Recovery"; stage 1 -> "Unproductive". */
export function trainingStatus(
  stageReached: number,
  finished: boolean
): string {
  if (finished) {
    return "Peaking";
  }
  const stage = Number.isFinite(stageReached)
    ? clamp(Math.floor(stageReached), 1, 5)
    : 1;
  if (stage >= 5) {
    return "Productive";
  }
  if (stage >= 3) {
    return "Maintaining";
  }
  if (stage === 2) {
    return "Recovery";
  }
  return "Unproductive";
}

/** Recovery time in whole hours shown at game over: 6 + 12 per stage cleared, capped at 72; a finished 5K is 72. */
export function recoveryHours(
  stagesCleared: number,
  finished: boolean
): number {
  if (finished) {
    return 72;
  }
  const cleared = Number.isFinite(stagesCleared)
    ? Math.max(0, Math.floor(stagesCleared))
    : 0;
  return Math.min(72, 6 + 12 * cleared);
}

/** The banner for a new best score. */
export const NEW_PR_TEXT = "NEW PR!";

/** The paused overlay title. */
export const AUTO_PAUSE_TEXT = "AUTO PAUSE";

/** Short toasts, picked deterministically from a seed so tests and replays repeat. */
export type ToastEvent =
  | "stomp-chain"
  | "power-up"
  | "hit"
  | "bonk"
  | "kudos-life"
  | "stage-clear"
  | "rep-max";

/** Toast copy per event. Each line is uppercase and 24 characters or fewer. */
export const TOASTS: Readonly<Record<ToastEvent, readonly string[]>> = {
  "stomp-chain": Object.freeze([
    "NEGATIVE SPLIT",
    "STOMP PACE",
    "CADENCE ON POINT",
    "TURNOVER LOCKED IN",
  ]),
  "power-up": Object.freeze([
    "GRAB A GEL",
    "PRE-WORKOUT HIT",
    "FUELED UP",
    "CARB LOADED",
  ]),
  hit: Object.freeze([
    "HIT THE WALL",
    "FORM BREAK",
    "CRAMP ALERT",
    "ROUGH MILE",
  ]),
  bonk: Object.freeze([
    "GRAB A GEL",
    "EASE UP TO RECOVER",
    "TOO FAST, TOO SOON",
    "HIT THE WALL",
  ]),
  "kudos-life": Object.freeze([
    "KUDOS RECEIVED",
    "SQUAD HAS YOUR BACK",
    "EXTRA LIFE, EXTRA SWEAT",
    "ROUND OF APPLAUSE",
  ]),
  "stage-clear": Object.freeze([
    "PR PACE",
    "SPLIT LOGGED",
    "DID YOU EVEN SYNC?",
    "SEND IT, THEN RECOVER",
  ]),
  "rep-max": Object.freeze([
    "NEW REP MAX",
    "DO YOU EVEN LIFT?",
    "BEAST MODE ON",
    "NEVER SKIP LEG DAY",
  ]),
};

/** The toast for an event, picked from the seed: a negative, fractional or NaN seed still lands on a line. */
export function pickToast(event: ToastEvent, seed: number): string {
  const lines = TOASTS[event];
  const index = Number.isFinite(seed)
    ? Math.abs(Math.floor(seed)) % lines.length
    : 0;
  return lines[index];
}
