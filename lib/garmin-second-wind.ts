/**
 * Second Wind stage events for Monkey C Mayhem (#2026).
 *
 * Some land stages hide one Second Wind in a Sync Block. Bumping it remixes
 * the stage for {@link SECOND_WIND_MS}, then everything snaps back:
 *
 * - Hill Repeats: the lane rolls into short climbs and descents, slowing the
 *   runner uphill and speeding it downhill. Goal: cover the distance.
 * - Taper Week: gravity eases and every jump floats. Goal: grab Kudos.
 * - Fun Run: foes turn into cheering spectators; touching one is a high five
 *   that hands out a Kudos instead of a hit. Goal: high-five enough of them.
 * - Night Run: only a headlamp cone around the runner is lit. Goal: finish
 *   the event without taking a hit.
 *
 * Meeting the goal pays out the Finisher Medal the block holds. The engine
 * in `lib/garmin-engine.ts` applies the rules; this module holds the pure
 * timing and scoring, and imports nothing from the engine.
 */

/** The four Second Wind events. */
export type SecondWindKind = "hills" | "taper" | "funrun" | "night";

/** Every event, in the order a stage's draw picks from. */
export const SECOND_WIND_KINDS: readonly SecondWindKind[] = [
  "hills",
  "taper",
  "funrun",
  "night",
];

/** How long an event lasts, in ms. */
export const SECOND_WIND_MS = 15000;
/** Gravity under Taper Week, as a share of the normal pull. */
export const TAPER_GRAVITY_SCALE = 0.55;
/** Hill Repeats: the run speed swings this far above and below normal. */
export const HILL_SPEED_SWING = 0.2;
/** Hill Repeats: world px from one hilltop to the next. */
export const HILL_WAVELENGTH = 240;

/** Each event's name, toast and goal. */
export const SECOND_WIND_EVENTS: Record<
  SecondWindKind,
  { name: string; goal: number; goalText: string }
> = {
  hills: { name: "HILL REPEATS", goal: 100, goalText: "Run 100 m" },
  taper: { name: "TAPER WEEK", goal: 6, goalText: "Grab 6 Kudos" },
  funrun: { name: "FUN RUN", goal: 2, goalText: "High-five 2 fans" },
  night: { name: "NIGHT RUN", goal: 0, goalText: "Take no hits" },
};

/** Toast when an event's goal is met. */
export const SECOND_WIND_GOAL_TOAST = "Second Wind!";

/** A Second Wind in progress. */
export interface SecondWind {
  kind: SecondWindKind;
  /** Time left, in ms. */
  msLeft: number;
  /** Progress towards the goal: metres, Kudos, high fives, or hits taken. */
  progress: number;
  /** The goal has been met (Night Run: only settled when the time runs out). */
  cleared: boolean;
  /** The medal the event pays out, if not already found. */
  medalId?: number;
  /** The stage it belongs to; it ends with the stage. */
  stage: number;
}

/** A fresh event of `kind` on `stage`, paying out `medalId`. */
export function startSecondWind(
  kind: SecondWindKind,
  stage: number,
  medalId?: number
): SecondWind {
  return {
    kind,
    msLeft: SECOND_WIND_MS,
    progress: 0,
    cleared: false,
    stage,
    ...(medalId === undefined ? {} : { medalId }),
  };
}

/** What happened to the runner this tick that an event may count. */
export interface SecondWindTick {
  deltaMs: number;
  metres: number;
  kudos: number;
  highFives: number;
  hits: number;
}

/**
 * Advances an event by one tick. Returns the event (null once its time is
 * up), whether its goal was met on this tick, and whether it ended.
 */
export function stepSecondWind(
  wind: SecondWind,
  tick: SecondWindTick
): { wind: SecondWind | null; goalMet: boolean; ended: boolean } {
  const gain =
    wind.kind === "hills"
      ? tick.metres
      : wind.kind === "taper"
        ? tick.kudos
        : wind.kind === "funrun"
          ? tick.highFives
          : tick.hits;
  // A non-finite gain or tick counts as nothing, so the timer always ends.
  const amount = Number.isFinite(gain) ? Math.max(0, gain) : 0;
  const dt = Number.isFinite(tick.deltaMs) ? Math.max(0, tick.deltaMs) : 0;
  const progress = wind.progress + amount;
  // Snap float residue, so frames of 1000 / 60 ms end on the last one.
  const left = wind.msLeft - dt;
  const msLeft = left > 1e-6 ? left : 0;
  const ended = msLeft <= 0;
  const goal = SECOND_WIND_EVENTS[wind.kind].goal;
  const met =
    wind.kind === "night" ? ended && progress <= goal : progress >= goal;
  const goalMet = met && !wind.cleared;
  const next = { ...wind, progress, msLeft, cleared: wind.cleared || met };
  return { wind: ended ? null : next, goalMet, ended };
}

/** Gravity scale an event puts on jumps and falls. */
export function windGravityScale(wind: SecondWind | null | undefined): number {
  return wind?.kind === "taper" ? TAPER_GRAVITY_SCALE : 1;
}

/**
 * Run-speed scale on Hill Repeats at world x: below 1 on a climb, above 1
 * on a descent. 1 for every other event, or none.
 */
export function hillSpeedScale(
  wind: SecondWind | null | undefined,
  worldX: number
): number {
  if (wind?.kind !== "hills" || !Number.isFinite(worldX)) return 1;
  // The sine is positive on a climb, where hillTilt lifts the lane ahead.
  return (
    1 - HILL_SPEED_SWING * Math.sin((worldX / HILL_WAVELENGTH) * Math.PI * 2)
  );
}

/** The lane's tilt on Hill Repeats at world x, in radians (for the art). */
export function hillTilt(
  wind: SecondWind | null | undefined,
  worldX: number
): number {
  if (wind?.kind !== "hills" || !Number.isFinite(worldX)) return 0;
  return -0.08 * Math.sin((worldX / HILL_WAVELENGTH) * Math.PI * 2);
}
