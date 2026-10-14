/**
 * The course enemy roster for Monkey C Mayhem (#1991).
 *
 * Alongside the bugs that drift in from the right (NULL, DOG, STK), each
 * stage now places its own gym foes on the course:
 *
 * - **Kettlebell** waddles along the track. A stomp tips it onto its side
 *   (its "shell" mode); touching or stomping a tipped kettlebell kicks it,
 *   and a kicked one slides along the track flattening other enemies,
 *   bouncing off blocks and hurting the runner if it comes back.
 * - **Move Alert** flies a wave. A stomp clips its wings and it walks.
 * - **Box Jumper** hops toward the runner on a timer.
 * - **Auto Lap** sits on the track or a block and, while on screen, fires
 *   slow lap pings at the runner on a schedule.
 * - **Rep Max** is a mini-boss halfway through stages 3 and 5. It hops
 *   and lobs arcing dumbbells, takes three stomps or six hits, and pays a big
 *   bonus.
 *
 * Positions are world pixels like the rest of the course: `x` is the left
 * edge and `y` the top. This module lays foes out, moves them and answers the
 * contact rules; the engine in `lib/garmin-engine.ts` applies the results.
 * Foes use their own seeded random source, so adding them changes no
 * existing course layout.
 */
import { clamp } from "./game-utils";
import {
  BLOCK_SIZE,
  STAGE_COUNT,
  courseRandom,
  isFootingOverGap,
  isOverGap,
  stagePoleX,
  stageStartX,
  type CourseLayout,
} from "./garmin-course";
import { SWIM_SURFACE_Y } from "./garmin-swim";
import type { StageTheme } from "./garmin-themes";

/** The kinds of foe placed on the course. */
export type FoeKind =
  | "kettlebell"
  | "alert"
  | "box"
  | "lap"
  | "repmax"
  | "jellyfish"
  | "goggles"
  /** Race Day's boss (#1994), moved by lib/garmin-raceday.ts. */
  | "wall";

/**
 * What a foe is doing. A Kettlebell walks, rests as a shell or slides as a
 * kicked shell; a Move Alert flies until stomped, then walks.
 */
export type FoeMode =
  | "walk"
  | "shell"
  | "kicked"
  | "fly"
  | "idle"
  /** A Jellyfish floating through the water; it cannot be stomped. */
  | "drift";

/** A foe on the course. */
export interface Foe {
  id: number;
  kind: FoeKind;
  mode: FoeMode;
  x: number;
  y: number;
  width: number;
  height: number;
  /** World pixels per 60 Hz frame. */
  vx: number;
  vy: number;
  /** Counts down to the next hop or shot. */
  timerMs: number;
  /** Hit points left; only the Rep Max and The Wall have more than one. */
  hp: number;
  /** Time left in which the foe can't be hurt again (or a kicked shell can't hurt the runner). */
  graceMs: number;
  /** Flight line for a Move Alert. */
  baseY?: number;
  /** Wave phase for a Move Alert, in radians. */
  phase?: number;
  /** Counts down to the Rep Max's next dumbbell while it is on the face. */
  throwMs?: number;
}

/** A shot fired by a foe: an Auto Lap's lap ping, a Rep Max's dumbbell or a brick from The Wall. */
export interface FoeShot {
  id: number;
  kind: "ping" | "dumbbell" | "brick";
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Box sizes for each foe kind, in pixels. */
export const FOE_SIZE: Record<FoeKind, { width: number; height: number }> = {
  kettlebell: { width: 16, height: 16 },
  alert: { width: 16, height: 12 },
  box: { width: 14, height: 14 },
  lap: { width: 14, height: 16 },
  repmax: { width: 24, height: 30 },
  jellyfish: { width: 14, height: 14 },
  goggles: { width: 16, height: 8 },
  wall: { width: 22, height: 34 },
};
/** Height of a Kettlebell's shell. */
export const SHELL_HEIGHT = 11;
/** Edge length of a foe shot, in pixels. */
export const FOE_SHOT_SIZE = 6;
/** Walking speed toward the runner. */
export const WALK_SPEED = 0.7;
/** A kicked shell's speed. */
export const SHELL_SPEED = 5.5;
/** After a kick, the shell can't hurt the runner for this long. */
export const KICK_GRACE_MS = 300;
/** A Move Alert's forward speed. */
export const ALERT_SPEED = 0.9;
/** A Move Alert's wave height above and below its line. */
export const ALERT_WAVE = 14;
/** Time between a Box Jumper's hops. */
export const HOP_MS = 1400;
/** A hop's launch speed. */
export const HOP_VY = -6.5;
/** A hop's forward speed. */
export const HOP_VX = 1.4;
/** Time between an Auto Lap's shots. */
export const LAP_MS = 2600;
/** A Auto Lap ping's speed. */
export const PING_SHOT_SPEED = 2;
/** Rep Max hit points: a stomp takes two, any other hit one. */
export const REPMAX_HP = 6;
/** Time between a Rep Max's hops. */
export const REPMAX_HOP_MS = 1800;
/** Time between a Rep Max's dumbbells. */
export const REPMAX_THROW_MS = 1600;
/** A dumbbell's launch speeds. */
export const DUMBBELL_VX = 2.4;
export const DUMBBELL_VY = -6;
/** After a hit, the Rep Max can't be hurt again for this long. */
export const REPMAX_GRACE_MS = 600;
/** Points for a stomp on an ordinary foe. */
export const FOE_STOMP_SCORE = 100;
/** Points for defeating an ordinary foe any other way. */
export const FOE_DEFEAT_SCORE = 200;
/**
 * How far below a foe's top the runner's feet may have been a frame ago and
 * still count as landing on it: forgiving, so a stomp that looks right is one.
 */
export const STOMP_WINDOW = 12;
/** Points for defeating the Rep Max. */
export const REPMAX_SCORE = 2000;
/** Stages with a Rep Max halfway along. */
export const REPMAX_STAGES: readonly number[] = [3, 5];
/** The top of the water column, in world pixels: the swim surface. */
export const WATER_TOP_Y = SWIM_SURFACE_Y;
/** A Jellyfish's drift speed, leftward, in world pixels per frame. */
export const JELLYFISH_SPEED = 0.35;
/** A Jellyfish's bob height above and below its line, in pixels. */
export const JELLYFISH_BOB = 6;
/** A pair of Lost Goggles' sink and rise height above and below their line, in pixels. */
export const GOGGLES_SINK = 22;
/** A Lost Goggles pair's drift speed, leftward, in world pixels per frame. */
export const GOGGLES_SPEED = 0.5;

const GRAVITY = 0.5;
const MAX_FALL = 9;
const DUMBBELL_GRAVITY = 0.32;

/** Which foes a stage may place, easiest first. */
export const STAGE_FOE_TABLE: Record<number, readonly FoeKind[]> = {
  1: ["kettlebell", "kettlebell", "box"],
  2: ["kettlebell", "alert", "box"],
  3: ["kettlebell", "alert", "box", "lap"],
  4: ["alert", "box", "lap", "kettlebell"],
  5: ["kettlebell", "alert", "box", "lap", "lap"],
};

/** Which foes a water stage may place, by its water theme. */
export const WATER_FOE_TABLE: Record<
  "pool" | "open-water",
  readonly FoeKind[]
> = {
  pool: ["jellyfish", "goggles"],
  "open-water": ["jellyfish", "goggles", "goggles"],
};

/** Optional placement for a foe that lives in the water column. */
interface WaterPlacement {
  /** Line the foe floats or flies on, in world pixels. */
  waterY?: number;
  /** Starting wave phase, in radians. */
  phase?: number;
}

/** A new foe of `kind` standing with its feet at `footY`. */
export function makeFoe(
  id: number,
  kind: FoeKind,
  x: number,
  footY: number,
  placement: WaterPlacement = {}
): Foe {
  const { width, height } = FOE_SIZE[kind];
  const foe: Foe = {
    id,
    kind,
    mode: "walk",
    x,
    y: footY - height,
    width,
    height,
    vx: -WALK_SPEED,
    vy: 0,
    timerMs: 0,
    hp: kind === "repmax" ? REPMAX_HP : 1,
    graceMs: 0,
  };
  if (kind === "alert") {
    const baseY = footY - 56;
    return { ...foe, mode: "fly", y: baseY, baseY, phase: 0, vx: -ALERT_SPEED };
  }
  if (kind === "jellyfish") {
    const baseY = placement.waterY ?? WATER_TOP_Y + 10;
    return {
      ...foe,
      mode: "drift",
      y: baseY,
      baseY,
      phase: 0,
      vx: -JELLYFISH_SPEED,
    };
  }
  if (kind === "goggles") {
    const baseY = placement.waterY ?? WATER_TOP_Y + 10 + GOGGLES_SINK;
    return {
      ...foe,
      mode: "fly",
      y: baseY,
      baseY,
      phase: placement.phase ?? 0,
      vx: -GOGGLES_SPEED,
    };
  }
  if (kind === "box") return { ...foe, mode: "idle", vx: 0, timerMs: HOP_MS };
  if (kind === "lap") {
    return { ...foe, mode: "idle", vx: 0, timerMs: LAP_MS / 2 };
  }
  if (kind === "repmax") {
    return {
      ...foe,
      mode: "idle",
      vx: 0,
      timerMs: REPMAX_HOP_MS,
      throwMs: REPMAX_THROW_MS,
    };
  }
  return foe;
}

/**
 * A random line inside the water column for a foe `inset` pixels tall
 * above and below it: between just under the surface and just above the
 * track's bottom edge, so the whole bob stays in the water.
 */
function waterLineY(
  rand: () => number,
  groundY: number,
  inset: number
): number {
  const top = WATER_TOP_Y + 10 + inset;
  // Low enough that a runner wading along the bottom meets them too.
  const bottom = groundY - 30 - inset;
  return top + rand() * (bottom - top);
}

/**
 * Lays out one stage's foes: three plus the stage number, picked from
 * {@link STAGE_FOE_TABLE}, spread over the stage clear of gaps, with a
 * Rep Max halfway along stages 3 and 5. A Auto Lap prefers the top
 * of a block. Water themes (pool, open water) pick from
 * {@link WATER_FOE_TABLE} instead; a Lost Goggles slot places a pair.
 */
export function generateFoes(
  stage: number,
  seed: number,
  course: CourseLayout,
  groundY: number,
  theme: StageTheme = "track"
): Foe[] {
  const s = clamp(
    Math.floor(Number.isFinite(stage) ? stage : 1),
    1,
    STAGE_COUNT
  );
  const rand = courseRandom(seed * 131 + s * 104729 + 17);
  const table: readonly FoeKind[] =
    theme === "pool" || theme === "open-water"
      ? WATER_FOE_TABLE[theme]
      : STAGE_FOE_TABLE[s];
  const start = stageStartX(s) + 520;
  const end = stagePoleX(s) - 420;
  const count = 3 + s;
  const span = (end - start) / count;
  const foes: Foe[] = [];
  let id = s * 1000 + 500;
  const clearX = (x: number, width: number) => {
    let nx = x;
    for (let tries = 0; tries < 40 && nx + width <= end; tries++) {
      if (
        !isOverGap(course, nx - 4) &&
        !isOverGap(course, nx + width + 4) &&
        !isFootingOverGap(course, nx, nx + width) &&
        // Keep foes out from under the Basement Gym racks.
        !(course.ceilings ?? []).some(
          (c) => nx < c.x + c.width + 16 && nx + width > c.x - 16
        )
      ) {
        return nx;
      }
      nx += 12;
    }
    return null;
  };
  for (let i = 0; i < count; i++) {
    const kind = table[Math.floor(rand() * table.length)];
    const want = start + span * i + rand() * span * 0.6;
    if (kind === "lap") {
      const block = course.blocks.find(
        (b) =>
          b.kind === "brick" &&
          b.x >= Math.max(start, want - span / 2) &&
          b.x <= Math.min(end, want + span / 2)
      );
      if (block) {
        const x = block.x + (BLOCK_SIZE - FOE_SIZE.lap.width) / 2;
        foes.push(makeFoe(id++, "lap", x, block.y));
        continue;
      }
    }
    const x = clearX(Math.round(want), FOE_SIZE[kind].width);
    if (x === null) continue;
    if (kind === "goggles") {
      const waterY = waterLineY(rand, groundY, GOGGLES_SINK);
      foes.push(makeFoe(id++, kind, x, groundY, { waterY, phase: 0 }));
      foes.push(makeFoe(id++, kind, x, groundY, { waterY, phase: Math.PI }));
    } else if (kind === "jellyfish") {
      const waterY = waterLineY(rand, groundY, 0);
      foes.push(makeFoe(id++, kind, x, groundY, { waterY }));
    } else {
      foes.push(makeFoe(id++, kind, x, groundY));
    }
  }
  if (REPMAX_STAGES.includes(s)) {
    const mid = Math.round((stageStartX(s) + stagePoleX(s)) / 2);
    const x = clearX(mid, FOE_SIZE.repmax.width);
    if (x !== null) foes.push(makeFoe(id++, "repmax", x, groundY));
  }
  return foes;
}

/** The top of the footing a box falling from `prevBottom` to `nextBottom` lands on, if any. */
function footingTop(
  course: CourseLayout,
  groundY: number,
  left: number,
  right: number,
  prevBottom: number,
  nextBottom: number
): number | null {
  let landing = Infinity;
  const consider = (top: number) => {
    if (prevBottom <= top + 1 && nextBottom >= top && top < landing) {
      landing = top;
    }
  };
  if (prevBottom <= groundY + 1 && !isFootingOverGap(course, left, right)) {
    consider(groundY);
  }
  for (const l of course.ledges) {
    if (right > l.x && left < l.x + l.width) consider(l.y);
  }
  for (const b of course.blocks) {
    if (right > b.x && left < b.x + BLOCK_SIZE) consider(b.y);
  }
  return landing === Infinity ? null : landing;
}

/** How far a flying or drifting foe bobs above and below its line. */
function waveHeight(foe: Foe): number {
  if (foe.kind === "goggles") return GOGGLES_SINK;
  if (foe.kind === "jellyfish") return JELLYFISH_BOB;
  return ALERT_WAVE;
}

/** Whether a foe is near enough to the face to be awake. */
export function isAwake(
  foe: Foe,
  cameraX: number,
  canvasSize: number
): boolean {
  return foe.x < cameraX + canvasSize + 24 && foe.x + foe.width > cameraX - 60;
}

/** Whether a foe can hurt the runner by touch right now. */
export function isHarmful(foe: Foe): boolean {
  if (foe.mode === "shell") return false;
  if (foe.mode === "kicked") return foe.graceMs <= 0;
  return true;
}

/**
 * Moves foes and their shots one tick. Foes off to the right of the face
 * wait; those that fall off the face or scroll well behind the camera are
 * dropped. Auto Laps and the Rep Max fire only while on the face, at
 * `runnerX` (the runner's world centre).
 */
export function stepFoes(
  foes: readonly Foe[],
  shots: readonly FoeShot[],
  course: CourseLayout,
  groundY: number,
  cameraX: number,
  canvasSize: number,
  deltaMs: number,
  runnerX: number,
  nextShotId: number
): { foes: Foe[]; shots: FoeShot[]; nextShotId: number } {
  const dt = deltaMs / 16.666;
  const nextFoes: Foe[] = [];
  const nextShots: FoeShot[] = [];
  let shotId = nextShotId;
  const onFace = (f: Foe) =>
    f.x + f.width > cameraX && f.x < cameraX + canvasSize;

  for (const f of foes) {
    if (f.x + f.width < cameraX - 80 || f.y > canvasSize) continue;
    if (!isAwake(f, cameraX, canvasSize)) {
      nextFoes.push(f);
      continue;
    }
    let next: Foe = { ...f, graceMs: Math.max(0, f.graceMs - deltaMs) };
    if (next.mode === "fly" || next.mode === "drift") {
      const phase = (next.phase ?? 0) + 0.06 * dt;
      next = {
        ...next,
        phase,
        x: next.x + next.vx * dt,
        y: (next.baseY ?? next.y) + Math.sin(phase) * waveHeight(next),
      };
      nextFoes.push(next);
      continue;
    }
    // Everything else falls under gravity and stands on footing.
    let vx = next.vx;
    let timerMs = next.timerMs;
    let throwMs = next.throwMs;
    let vy = Math.min(MAX_FALL, next.vy + GRAVITY * dt);
    let x = next.x + vx * dt;
    let y = next.y + vy * dt;
    const top = footingTop(
      course,
      groundY,
      x + 2,
      x + next.width - 2,
      next.y + next.height,
      y + next.height
    );
    const grounded = vy >= 0 && top !== null;
    if (grounded) {
      y = top - next.height;
      vy = 0;
    }
    if (next.mode === "kicked") {
      // A sliding shell turns back off the side of a block.
      const wall = course.blocks.find(
        (b) =>
          x + next.width > b.x &&
          x < b.x + BLOCK_SIZE &&
          y + next.height > b.y + 1 &&
          y < b.y + BLOCK_SIZE
      );
      if (wall) {
        vx = -vx;
        x = vx > 0 ? wall.x + BLOCK_SIZE : wall.x - next.width;
      }
    }
    if (next.kind === "box" && grounded) {
      vx = 0;
      timerMs -= deltaMs;
      if (timerMs <= 0) {
        vy = HOP_VY;
        vx = runnerX < x + next.width / 2 ? -HOP_VX : HOP_VX;
        timerMs = HOP_MS;
      }
    }
    if (next.kind === "repmax") {
      if (grounded) vx = 0;
      timerMs -= deltaMs;
      if (grounded && timerMs <= 0) {
        vy = HOP_VY;
        timerMs = REPMAX_HOP_MS;
      }
      if (onFace(next)) {
        throwMs = (throwMs ?? REPMAX_THROW_MS) - deltaMs;
        if (throwMs <= 0) {
          throwMs = REPMAX_THROW_MS;
          const dir = runnerX < x + next.width / 2 ? -1 : 1;
          nextShots.push({
            id: shotId++,
            kind: "dumbbell",
            x: x + next.width / 2 - FOE_SHOT_SIZE / 2,
            y,
            vx: dir * DUMBBELL_VX,
            vy: DUMBBELL_VY,
          });
        }
      }
    }
    if (next.kind === "lap") {
      if (onFace(next)) {
        timerMs -= deltaMs;
        if (timerMs <= 0) {
          const dir = runnerX < x + next.width / 2 ? -1 : 1;
          nextShots.push({
            id: shotId++,
            kind: "ping",
            x: x + next.width / 2 - FOE_SHOT_SIZE / 2,
            y: y + 4,
            vx: dir * PING_SHOT_SPEED,
            vy: 0,
          });
          timerMs = LAP_MS;
        }
      }
    }
    nextFoes.push(
      throwMs === undefined
        ? { ...next, x, y, vx, vy, timerMs }
        : { ...next, x, y, vx, vy, timerMs, throwMs }
    );
  }

  for (const s of shots) {
    const vy =
      s.kind === "dumbbell"
        ? Math.min(MAX_FALL, s.vy + DUMBBELL_GRAVITY * dt)
        : s.vy;
    const x = s.x + s.vx * dt;
    const y = s.y + vy * dt;
    if (
      y > canvasSize ||
      x + FOE_SHOT_SIZE < cameraX - 20 ||
      x > cameraX + canvasSize + 40
    ) {
      continue;
    }
    nextShots.push({ ...s, x, y, vy });
  }
  return { foes: nextFoes, shots: nextShots, nextShotId: shotId };
}

/** A box in world pixels. */
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A foe's hit box, inset a little like the runner's. */
export function foeBox(foe: Foe): Box {
  return {
    left: foe.x + 2,
    right: foe.x + foe.width - 2,
    top: foe.y + 2,
    bottom: foe.y + foe.height - 2,
  };
}

/** Whether two boxes overlap. */
export function overlaps(a: Box, b: Box): boolean {
  return (
    a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
  );
}

/** What touching a foe does to the runner. */
export type FoeContact = "none" | "stomp" | "kick" | "hurt";

/**
 * Sorts out the runner touching a foe. Landing on any foe from above is a
 * stomp; walking into a resting shell kicks it; anything else that can hurt
 * does. `prevBottom` is the runner's feet a tick ago and `vy` its fall speed.
 */
export function runnerContact(
  foe: Foe,
  runner: Box,
  prevBottom: number,
  vy: number
): FoeContact {
  if (!overlaps(runner, foeBox(foe))) return "none";
  if (vy > 0 && foe.mode !== "drift" && prevBottom <= foe.y + STOMP_WINDOW) {
    return "stomp";
  }
  if (foe.mode === "shell") return "kick";
  return isHarmful(foe) ? "hurt" : "none";
}

/** The result of hitting a foe: what is left of it (null if defeated) and the points. */
export interface FoeHit {
  foe: Foe | null;
  score: number;
}

/**
 * A stomp. A walking Kettlebell tips onto its side, a resting shell is
 * kicked away from `runnerX`, and a sliding one stops; a flying Move Alert
 * drops to walking; the Rep Max loses two hit points; anything else is
 * defeated.
 */
export function stompFoe(foe: Foe, runnerX: number): FoeHit {
  // A Jellyfish can't be stomped: landing on it is a hurt, not a stomp.
  if (foe.mode === "drift") return { foe, score: 0 };
  if (foe.kind === "kettlebell") {
    if (foe.mode === "walk" || foe.mode === "kicked") {
      return {
        foe: {
          ...foe,
          mode: "shell",
          vx: 0,
          y: foe.y + foe.height - SHELL_HEIGHT,
          height: SHELL_HEIGHT,
          graceMs: 0,
        },
        score: FOE_STOMP_SCORE,
      };
    }
    return { foe: kickShell(foe, runnerX), score: FOE_STOMP_SCORE };
  }
  if (foe.kind === "alert" && foe.mode === "fly") {
    return {
      foe: { ...foe, mode: "walk", vx: -WALK_SPEED, vy: 0 },
      score: FOE_STOMP_SCORE,
    };
  }
  if (foe.kind === "repmax" || foe.kind === "wall") return damageFoe(foe, 2);
  return { foe: null, score: FOE_STOMP_SCORE };
}

/** Sends a shell sliding away from `runnerX`. */
export function kickShell(foe: Foe, runnerX: number): Foe {
  const dir = runnerX < foe.x + foe.width / 2 ? 1 : -1;
  return {
    ...foe,
    mode: "kicked",
    vx: dir * SHELL_SPEED,
    graceMs: KICK_GRACE_MS,
  };
}

/**
 * A hit from a heat bolt, a cape spin, a sliding shell or a Runner's High.
 * Ordinary foes are defeated; the Rep Max loses `amount` hit points and The
 * Wall one (#1994), and until it runs out each has a short grace before the
 * next hit counts.
 */
export function damageFoe(foe: Foe, amount: number): FoeHit {
  const wall = foe.kind === "wall";
  if (!wall && foe.kind !== "repmax") {
    return { foe: null, score: FOE_DEFEAT_SCORE };
  }
  if (foe.graceMs > 0) return { foe, score: 0 };
  const hp = foe.hp - (wall ? 1 : Math.max(1, amount));
  if (hp <= 0) return { foe: null, score: REPMAX_SCORE };
  return {
    foe: { ...foe, hp, graceMs: REPMAX_GRACE_MS },
    score: FOE_STOMP_SCORE,
  };
}

/**
 * Sliding shells flatten every other foe they touch (a Rep Max takes
 * two hit points). Returns the foes left and each hit with its points.
 */
export function shellSweep(foes: readonly Foe[]): {
  foes: Foe[];
  hits: { foe: Foe; score: number }[];
} {
  const shells = foes.filter((f) => f.mode === "kicked");
  if (shells.length === 0) return { foes: foes.slice(), hits: [] };
  const hits: { foe: Foe; score: number }[] = [];
  const kept: Foe[] = [];
  for (const f of foes) {
    const shell = shells.find(
      (s) => s.id !== f.id && overlaps(foeBox(s), foeBox(f))
    );
    if (!shell) {
      kept.push(f);
      continue;
    }
    const hit = damageFoe(f, 2);
    hits.push({ foe: f, score: hit.score });
    if (hit.foe) kept.push(hit.foe);
  }
  return { foes: kept, hits };
}

/** A foe shot's box in world pixels. */
export function shotBox(shot: FoeShot): Box {
  return {
    left: shot.x,
    right: shot.x + FOE_SHOT_SIZE,
    top: shot.y,
    bottom: shot.y + FOE_SHOT_SIZE,
  };
}
