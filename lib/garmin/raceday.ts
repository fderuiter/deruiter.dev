/**
 * Race Day's boss for Monkey C Mayhem (#1994): The Wall.
 *
 * The Wall steps out near the end of Race Day and stands between the runner
 * and the finish, which keeps moving away until it is beaten. It takes three
 * hits, and each hit changes its pattern:
 *
 * - It holds ahead of the runner, then charges along the lane. A runner who
 *   jumps and lands on top lands a hit; one who jumps clear dodges it; one
 *   who doesn't jump is hit. After a charge it comes back in from the right.
 * - At 3 hit points it charges slowly. At 2 it charges faster and throws a
 *   brick while it holds. At 1 it charges fastest and throws two.
 *
 * The engine settles every touch (a stomp, a hurt, a heat bolt), since The
 * Wall is a foe like any other. This module only moves it, after each engine
 * step, so it adds nothing to the standalone engine bundle.
 */

import {
  CANVAS_SIZE,
  GROUND_Y,
  PLAYER_X,
  type GameEngineState,
} from "./engine";
import { PX_PER_METER, stagePoleX } from "./course";
import { clamp } from "../game-utils";
import { FOE_SHOT_SIZE, makeFoe, type Foe, type FoeShot } from "./foes";

/** Hits The Wall takes. */
export const WALL_HP = 3;

/** The Wall steps out when the runner is this many world pixels from the stage's own pole. */
export const WALL_SPAWN_LEAD = 420;

/** Where on the face The Wall holds before a charge, as its left edge. */
export const WALL_HOLD_X = 180;

/** Where on the face a charge ends, past the runner: off the left edge. */
export const WALL_CHARGE_END_X = -40;

/** Where on the face The Wall comes back in after a charge. */
export const WALL_ENTER_X = CANVAS_SIZE + 10;

/** How fast The Wall walks back to its hold, in pixels per 60 Hz frame. */
export const WALL_WALK_SPEED = 3;

/** Brick speed along the lane, in world pixels per 60 Hz frame. */
export const BRICK_VX = -2.6;

/** A brick flies low, so a jump clears it. */
export const BRICK_Y = GROUND_Y - 12;

/** The Wall's id among the stage's foes. */
export const WALL_ID = 99_999;

/** One step of the pattern: how long it holds, how fast it charges, and the bricks it throws while holding. */
export interface WallPhase {
  holdMs: number;
  /** Charge speed in pixels per 60 Hz frame, against the lane. */
  chargeSpeed: number;
  bricks: number;
}

/** The pattern at each hit point count: faster and with more bricks after each hit. */
export const WALL_PATTERN: Readonly<Record<1 | 2 | 3, WallPhase>> = {
  3: { holdMs: 1500, chargeSpeed: 1.8, bricks: 0 },
  2: { holdMs: 1300, chargeSpeed: 2.4, bricks: 1 },
  1: { holdMs: 1100, chargeSpeed: 3, bricks: 2 },
};

/** The pattern for a hit point count, clamped to 1 to 3. */
export function wallPhase(hp: number): WallPhase {
  const key = clamp(Math.round(hp), 1, 3) as 1 | 2 | 3;
  return WALL_PATTERN[key];
}

/** The Wall among `foes`, if it is on the course. */
export function findWall(foes: readonly Foe[] | undefined): Foe | null {
  return foes?.find((f) => f.kind === "wall") ?? null;
}

/**
 * The hold times at which a brick is thrown: evenly spread over the hold,
 * counted down from `holdMs`. e.g. two bricks over 1100 ms at 733 and 367.
 */
export function brickTimes(phase: WallPhase): number[] {
  return Array.from(
    { length: phase.bricks },
    (_, i) => (phase.holdMs * (phase.bricks - i)) / (phase.bricks + 1)
  );
}

/** A new Wall standing just off the right of the face at `cameraX`. */
export function spawnWall(cameraX: number): Foe {
  const foe = makeFoe(WALL_ID, "wall", cameraX + WALL_ENTER_X, GROUND_Y);
  return {
    ...foe,
    mode: "idle",
    vx: 0,
    hp: WALL_HP,
    timerMs: wallPhase(WALL_HP).holdMs,
  };
}

/**
 * Moves The Wall one step at `cameraX`. "idle" walks it to its hold and
 * counts down the hold, throwing its bricks; "walk" is a charge, which ends
 * off the left of the face and sends it back in from the right.
 */
export function stepWall(
  wall: Foe,
  cameraX: number,
  deltaMs: number,
  nextShotId: number
): { wall: Foe; shots: FoeShot[]; nextShotId: number } {
  const dt = deltaMs / 16.666;
  const phase = wallPhase(wall.hp);
  const shots: FoeShot[] = [];
  let shotId = nextShotId;
  let face = wall.x - cameraX;
  let mode = wall.mode;
  let timerMs = wall.timerMs;
  if (mode === "walk") {
    face -= phase.chargeSpeed * dt;
    if (face <= WALL_CHARGE_END_X) {
      face = WALL_ENTER_X;
      mode = "idle";
      timerMs = phase.holdMs;
    }
  } else {
    const gap = WALL_HOLD_X - face;
    face += Math.sign(gap) * Math.min(Math.abs(gap), WALL_WALK_SPEED * dt);
    if (face === WALL_HOLD_X) {
      const before = timerMs;
      timerMs -= deltaMs;
      for (const at of brickTimes(phase)) {
        if (before > at && timerMs <= at) {
          shots.push({
            id: shotId++,
            kind: "brick",
            x: cameraX + face - FOE_SHOT_SIZE,
            y: BRICK_Y,
            vx: BRICK_VX,
            vy: 0,
          });
        }
      }
      if (timerMs <= 0) {
        mode = "walk";
        timerMs = 0;
      }
    }
  }
  return {
    wall: {
      ...wall,
      mode,
      timerMs,
      x: cameraX + face,
      // It stands on the lane, over a gap too.
      y: GROUND_Y - wall.height,
      vx: 0,
      vy: 0,
    },
    shots,
    nextShotId: shotId,
  };
}

/** Text of the banner as The Wall steps out or takes a hit. */
export function wallBannerText(hp: number): string {
  if (hp >= WALL_HP) return "THE WALL · STOMP IT 3 TIMES";
  return hp === 1 ? "THE WALL · 1 TO GO" : `THE WALL · ${hp} TO GO`;
}

/**
 * Race Day after one engine step from `prev` to `next`: The Wall steps out
 * near the finish, moves through its pattern, and holds the finish pole out of
 * reach until it is beaten. A Wall that leaves the course with no life lost
 * was beaten; one that leaves with a life lost comes back at full strength
 * when the runner reaches it again. Any other run is returned unchanged.
 */
export function stepRaceDay(
  prev: GameEngineState,
  next: GameEngineState,
  deltaMs: number
): GameEngineState {
  const plan = next.plan;
  if (!plan?.raceDay || next.gameState !== "playing") return next;
  // A lost life restarts the stage, so The Wall stands again.
  if (next.wallDown && (next.lives ?? 1) < (prev.lives ?? 1)) {
    return { ...next, wallDown: false };
  }
  if (next.wallDown || prev.bonusRoom || next.bonusRoom) return next;
  const cameraX = next.distanceMeters * PX_PER_METER;
  const foes = next.foes ?? [];
  const before = findWall(prev.foes);
  let wall = findWall(foes);
  let state = next;

  if (!wall && before?.hp === 1 && (next.lives ?? 1) >= (prev.lives ?? 1)) {
    return {
      ...next,
      wallDown: true,
      banner: { text: "THE WALL IS DOWN · FINISH!", ttlMs: 2200, tone: "good" },
    };
  }
  if (!wall) {
    if (cameraX + PLAYER_X < stagePoleX(plan.stage) - WALL_SPAWN_LEAD) {
      return next;
    }
    wall = spawnWall(cameraX);
    state = {
      ...state,
      banner: { text: wallBannerText(WALL_HP), ttlMs: 2200, tone: "warn" },
    };
  } else if (before && wall.hp < before.hp) {
    // A hit sends it back to the right to hold again, with its new pattern.
    wall = { ...wall, mode: "idle", timerMs: wallPhase(wall.hp).holdMs };
    state = {
      ...state,
      banner: { text: wallBannerText(wall.hp), ttlMs: 1600, tone: "good" },
    };
  }

  const stepped = stepWall(wall, cameraX, deltaMs, state.foeShotsFired ?? 0);
  const course = state.course;
  // The finish stays just off the face while The Wall stands.
  const poleX = cameraX + CANVAS_SIZE + 60;
  return {
    ...state,
    foes: [...foes.filter((f) => f.kind !== "wall"), stepped.wall],
    foeShots: [...(state.foeShots ?? []), ...stepped.shots],
    foeShotsFired: stepped.nextShotId,
    ...(course
      ? {
          course: {
            ...course,
            poles: course.poles.map((p) =>
              p.stage === plan.stage && p.grabbed === undefined && p.x < poleX
                ? { ...p, x: poleX }
                : p
            ),
          },
        }
      : {}),
  };
}
