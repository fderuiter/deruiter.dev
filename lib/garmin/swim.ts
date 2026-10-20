/**
 * Swimming and the Basement Gym's racks for Monkey C Mayhem (#1993).
 *
 * On a pool or open water stage the runner swims: gravity is gentle, a jump
 * press is a stroke that pushes up, and the lane is a floor the runner sinks
 * onto. Open Water currents push the swimmer along. The Tri Suit lightens the
 * sink and makes the stroke quicker. Basement Gym racks are low bars the
 * runner walks under at Base height.
 *
 * This module holds the constants and answers the swim questions. It imports
 * no engine code, so the engine can import it without a cycle. The engine in
 * `lib/garmin/engine.ts` applies the rules to the run.
 */
import type { CourseCurrent } from "./course";
import { BASE_HEIGHT } from "./powerups";
import { isWaterTheme, themeForStage } from "./themes";

/** The lane's top edge, as `GROUND_Y` in `lib/garmin/engine.ts`. */
const LANE_Y = 205;
/** Gap between a rack's underside and the Base runner's head when standing. */
const RACK_HEAD_ROOM = 3;

/** Downward pull while swimming, in px per 60 Hz frame squared. */
export const SWIM_GRAVITY = 0.12;
/** Fastest the runner sinks, in px per frame. */
export const SWIM_SINK_MAX = 1.2;
/** Upward speed of a stroke. */
export const SWIM_STROKE_VY = -2.6;
/** Gap between strokes, in ms. */
export const SWIM_STROKE_MS = 180;
/** Highest the top of the runner's box goes while swimming, in canvas pixels. */
export const SWIM_SURFACE_Y = 96;

/** Swim pace scale while wading along the bottom instead of stroking. */
export const WADE_PACE_SCALE = 0.35;
/** Swim pace against the track's full pace (the pace multiplier of a run). */
export const SWIM_PACE = 0.55;
/** Swim pace of a Tri Suit runner. */
export const SUIT_SWIM_PACE = 0.8;
/** Upward speed of a Tri Suit stroke. */
export const SUIT_STROKE_VY = -3;
/** Gap between a Tri Suit runner's strokes, in ms. */
export const SUIT_STROKE_MS = 130;
/** Scale on swim gravity for a Tri Suit runner: it sinks more slowly. */
export const SUIT_GRAVITY_SCALE = 0.6;
/** Take-off speed of a Tri Suit runner on land: a lower hop, with no float. */
export const SUIT_LAND_JUMP_VY = -8.5;
/** Metres per frame a full-strength current adds to the swimmer. */
export const CURRENT_FLOW = 0.09;
/**
 * Underside of a Basement Gym rack, in canvas pixels: a Base runner standing
 * under it has head room of {@link RACK_HEAD_ROOM} pixels.
 */
export const CEILING_BOTTOM = LANE_Y - BASE_HEIGHT - RACK_HEAD_ROOM;
/** Height of the buoy line, below the surface. */
export const BUOY_Y = SWIM_SURFACE_Y + BASE_HEIGHT;

/** The parts of a run that decide whether the runner swims. */
export interface SwimStage {
  stage?: number;
  bonusRoom?: unknown;
}

/**
 * Whether the runner swims now: the stage is a water stage and the runner is
 * not in a bonus room, where the water rules are off.
 */
export function isUnderwater(state: SwimStage): boolean {
  return isWaterTheme(themeForStage(state.stage ?? 1)) && !state.bonusRoom;
}

/**
 * The summed flow of the currents a horizontal span overlaps, in metres per
 * frame: positive with the current, negative against it.
 */
export function currentFlow(
  currents: readonly CourseCurrent[] | undefined,
  left: number,
  right: number
): number {
  if (!currents) return 0;
  let flow = 0;
  for (const c of currents) {
    if (right > c.x && left < c.x + c.width) flow += c.flow;
  }
  return flow;
}
