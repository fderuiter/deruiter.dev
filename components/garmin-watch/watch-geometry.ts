/**
 * Monkey C Mayhem watch hardware geometry (#1520).
 *
 * The watch is one SVG drawn in a fixed 520 x 580 view box: a round case with
 * a bezel, lugs, strap stubs and five pushers. The game canvas sits over the
 * round screen, and the DOM pusher buttons sit over the drawn pushers, so both
 * are placed in percentages of the same box and scale with it.
 */

/** Width of the watch view box. */
export const WATCH_VIEW_WIDTH = 520;
/** Height of the watch view box, including the strap stubs. */
export const WATCH_VIEW_HEIGHT = 580;
/** Centre of the case in view-box units. */
export const WATCH_CENTER = { x: 260, y: 290 } as const;
/** Outer radius of the case. */
export const CASE_RADIUS = 236;
/** Outer radius of the bezel ring, inside the case edge. */
export const BEZEL_OUTER_RADIUS = 228;
/** Inner radius of the bezel ring, where the black lens rim starts. */
export const BEZEL_INNER_RADIUS = 200;
/** Radius of the visible screen that the canvas fills. */
export const SCREEN_RADIUS = 192;
/** Radius at which the pusher stems are centred. */
const PUSHER_RADIUS = 241;

export type PusherId = "light" | "up" | "down" | "start" | "back";

/**
 * Pusher angles in degrees, measured clockwise from 3 o'clock as canvas and
 * SVG do. Garmin's five-button layout: LIGHT, UP and DOWN down the left side,
 * START and BACK on the right.
 */
export const PUSHER_ANGLES: Record<PusherId, number> = {
  light: 215,
  up: 180,
  down: 145,
  start: 325,
  back: 35,
};

/** A point on a circle around the case centre, in view-box units. */
export function pointOnCase(
  angleDeg: number,
  radius: number
): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return {
    x: WATCH_CENTER.x + radius * Math.cos(a),
    y: WATCH_CENTER.y + radius * Math.sin(a),
  };
}

/** Rounds to two decimals so the CSS percentages stay readable. */
const pct = (value: number, total: number) =>
  Math.round((value / total) * 10000) / 100;

/**
 * Where the canvas sits over the screen, as CSS percentages of the watch box.
 * The canvas is the square that circumscribes the round screen.
 */
export function screenBoxPercent(): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: pct(WATCH_CENTER.x - SCREEN_RADIUS, WATCH_VIEW_WIDTH),
    top: pct(WATCH_CENTER.y - SCREEN_RADIUS, WATCH_VIEW_HEIGHT),
    width: pct(SCREEN_RADIUS * 2, WATCH_VIEW_WIDTH),
    height: pct(SCREEN_RADIUS * 2, WATCH_VIEW_HEIGHT),
  };
}

/**
 * Where a pusher's DOM button is anchored, as CSS percentages of the watch
 * box, and which side its caption sits on (outward, away from the case).
 */
export function pusherAnchorPercent(id: PusherId): {
  x: number;
  y: number;
  side: "left" | "right";
} {
  const angle = PUSHER_ANGLES[id];
  const point = pointOnCase(angle, PUSHER_RADIUS);
  return {
    x: pct(point.x, WATCH_VIEW_WIDTH),
    y: pct(point.y, WATCH_VIEW_HEIGHT),
    side: Math.cos((angle * Math.PI) / 180) < 0 ? "left" : "right",
  };
}
