/**
 * The Medicine Ball for Monkey C Mayhem (#2024).
 *
 * Medicine balls rest on the lane of land stages. Standing next to one, the
 * action key picks it up; pressed again, it throws the ball forward. A
 * thrown ball knocks out the first foe it hits and breaks a brick, then is
 * gone; one that lands rolls on along the footing, still knocking out the
 * first foe in its way, and rests where it stops to be picked up again. A carried ball slows the pace meter's fill, like
 * running with a weight. The engine in `lib/garmin-engine.ts` applies these
 * rules; this module holds the pure geometry.
 */
import {
  MEDBALL_SIZE,
  isFootingOverGap,
  type CourseLayout,
  type CourseMedBall,
} from "./garmin-course";

export { MEDBALL_SIZE };

/** How far past the runner's body a ball can be picked up, in px. */
export const MEDBALL_REACH = 6;
/** A throw's forward speed, in world px per 60 Hz frame. */
export const MEDBALL_THROW_VX = 5;
/** A throw's upward speed at release (negative is up). */
export const MEDBALL_THROW_VY = -2.5;
/** Pull on a thrown ball, per frame. */
export const MEDBALL_GRAVITY = 0.4;
/** Fastest a thrown ball falls. */
export const MEDBALL_MAX_FALL = 8;
/** Share of a rolling ball's speed kept each frame along the lane. */
export const MEDBALL_ROLL_FRICTION = 0.94;
/** A rolling ball slower than this comes to rest, in px per frame. */
export const MEDBALL_REST_VX = 0.3;
/** Pace meter fill rate while carrying a ball, as a share of the normal rate. */
export const MEDBALL_FILL_SCALE = 0.5;
/** Points for a foe knocked out by a thrown ball. */
export const MEDBALL_KO_SCORE = 200;
/** Popup text the first time a ball is picked up in a run. */
export const MEDBALL_TOAST = "Med ball!";

/** A medicine ball in flight. Positions are world pixels; `x`, `y` the top-left. */
export interface ThrownBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * The resting ball within reach of a runner whose body spans `left` to
 * `right` (world px) with its feet at `feetY`, or null. Only a ball resting
 * on the same footing counts.
 */
export function ballInReach(
  balls: readonly CourseMedBall[] | undefined,
  left: number,
  right: number,
  feetY: number
): CourseMedBall | null {
  for (const b of balls ?? []) {
    const bottom = b.y + MEDBALL_SIZE;
    if (Math.abs(bottom - feetY) > 2) continue;
    if (
      b.x + MEDBALL_SIZE >= left - MEDBALL_REACH &&
      b.x <= right + MEDBALL_REACH
    ) {
      return b;
    }
  }
  return null;
}

/** A ball thrown from a runner whose front is at `frontX` (world px), held at `handY`. */
export function throwBall(
  id: number,
  frontX: number,
  handY: number
): ThrownBall {
  return {
    id,
    x: frontX,
    y: handY - MEDBALL_SIZE / 2,
    vx: MEDBALL_THROW_VX,
    vy: MEDBALL_THROW_VY,
  };
}

/** Whether a thrown ball overlaps the box `left`..`right`, `top`..`bottom`. */
export function ballHits(
  ball: ThrownBall,
  left: number,
  top: number,
  right: number,
  bottom: number
): boolean {
  return (
    ball.x + MEDBALL_SIZE > left &&
    ball.x < right &&
    ball.y + MEDBALL_SIZE > top &&
    ball.y < bottom
  );
}

/**
 * Moves a thrown ball one tick. It falls under gravity; on the lane or a
 * ledge it rolls on, slowing, and once it is slow enough it comes to rest
 * there, returned as `landed`. A ball that drops off the face or leaves the
 * view is gone (both null).
 */
export function stepThrownBall(
  ball: ThrownBall,
  course: CourseLayout,
  groundY: number,
  cameraX: number,
  canvasSize: number,
  deltaMs: number
): { ball: ThrownBall | null; landed: CourseMedBall | null } {
  const dtRatio =
    Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs / 16.666 : 0;
  const x = ball.x + ball.vx * dtRatio;
  const vy = Math.min(MEDBALL_MAX_FALL, ball.vy + MEDBALL_GRAVITY * dtRatio);
  const y = ball.y + vy * dtRatio;
  if (vy >= 0) {
    const prevBottom = ball.y + MEDBALL_SIZE;
    const nextBottom = y + MEDBALL_SIZE;
    let landing = Infinity;
    const consider = (top: number) => {
      if (prevBottom <= top + 1 && nextBottom >= top && top < landing) {
        landing = top;
      }
    };
    if (!isFootingOverGap(course, x + 1, x + MEDBALL_SIZE - 1)) {
      consider(groundY);
    }
    for (const l of course.ledges) {
      if (x + MEDBALL_SIZE > l.x && x < l.x + l.width) consider(l.y);
    }
    if (landing !== Infinity) {
      const vx = ball.vx * MEDBALL_ROLL_FRICTION ** dtRatio;
      if (Math.abs(vx) < MEDBALL_REST_VX) {
        return {
          ball: null,
          landed: { id: ball.id, x, y: landing - MEDBALL_SIZE },
        };
      }
      return {
        ball: { ...ball, x, y: landing - MEDBALL_SIZE, vx, vy: 0 },
        landed: null,
      };
    }
  }
  if (y > canvasSize || x > cameraX + canvasSize + 40) {
    return { ball: null, landed: null };
  }
  return { ball: { ...ball, x, y, vy }, landed: null };
}
