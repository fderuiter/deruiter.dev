/**
 * The Monkey C Mayhem course (#1950): the run is a 5K of five 1 km stages,
 * each a seeded layout of track gaps, one-way ledges, Sync Blocks, Kudos and
 * a finish pole. Positions are world pixels along the track; the camera sits
 * at ten pixels per metre run, so a feature is on screen at
 * `x - distanceMeters * 10`.
 *
 * This module only lays the course out and answers geometry questions about
 * it. The engine in `lib/garmin-engine.ts` moves the runner through it.
 */
import { clamp } from "./game-utils";

/** World pixels per metre of run, matching the engine's lane markers. */
export const PX_PER_METER = 10;
/** Length of one stage in metres. */
export const STAGE_LENGTH_METERS = 1000;
/** Stages in the full course; clearing the last one completes the run. */
export const STAGE_COUNT = 5;
/** Edge length of a Sync Block or brick, in pixels. */
export const BLOCK_SIZE = 14;
/** Thickness of a one-way ledge, in pixels. */
export const LEDGE_THICKNESS = 5;
/** Radius of a Kudos coin, in pixels. */
export const KUDOS_RADIUS = 5;
/** Height of the finish pole above the lane, in pixels. */
export const POLE_HEIGHT = 110;

/** A missing stretch of track; the runner falls through it. */
export interface CourseGap {
  x: number;
  width: number;
}

/** A one-way ledge: the runner lands on it from above and jumps up through it. */
export interface CourseLedge {
  x: number;
  /** Top surface. */
  y: number;
  width: number;
}

/**
 * A block floating over the lane. Bumping a Sync Block from below pops its
 * contents once: Kudos, a power-up (a Protein Shake for a Base runner, then
 * a Heat Map from a power block or a Compression Cape from a cape block), or
 * a Runner's High. A brick is plain solid footing.
 */
export interface CourseBlock {
  id: number;
  x: number;
  /** Top surface. */
  y: number;
  kind: "sync" | "brick";
  contents: "kudos" | "power" | "cape" | "high";
  used: boolean;
  /** A Kudos turned into a brick by a Rest Day (#1992); it turns back after. */
  fromKudos?: boolean;
}

/** A Kudos coin. */
export interface CourseKudos {
  id: number;
  /** Centre. */
  x: number;
  y: number;
  /** A brick turned into a Kudos by a Rest Day (#1992); it turns back after. */
  fromBrick?: boolean;
}

/** The finish pole that ends a stage. */
export interface CoursePole {
  x: number;
  stage: number;
  /** Height on the pole the runner grabbed, 0 (bottom) to 1 (top), once touched. */
  grabbed?: number;
}

/** Every live feature of the course, across the current and previous stage. */
export interface CourseLayout {
  gaps: CourseGap[];
  ledges: CourseLedge[];
  blocks: CourseBlock[];
  kudos: CourseKudos[];
  poles: CoursePole[];
}

/** An empty course, for idle watches and states built before #1950. */
export const EMPTY_COURSE: CourseLayout = {
  gaps: [],
  ledges: [],
  blocks: [],
  kudos: [],
  poles: [],
};

/**
 * A small deterministic random source (mulberry32), so a seed always lays out
 * the same course.
 */
export function courseRandom(seed: number): () => number {
  let a = Math.floor(Number.isFinite(seed) ? seed : 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** World x where `stage` (1-based) starts. */
export function stageStartX(stage: number): number {
  return (Math.max(1, stage) - 1) * STAGE_LENGTH_METERS * PX_PER_METER;
}

/** World x of `stage`'s finish pole. */
export function stagePoleX(stage: number): number {
  return stageStartX(stage + 1) - 60;
}

/**
 * Lays out one stage. Layouts get harder by stage: wider gaps, more of them,
 * fewer gentle stretches. `groundY` is the lane's top edge.
 */
export function generateStage(
  stage: number,
  seed: number,
  groundY: number
): CourseLayout {
  const rand = courseRandom(seed * 31 + stage * 7919);
  const s = clamp(
    Math.floor(Number.isFinite(stage) ? stage : 1),
    1,
    STAGE_COUNT
  );
  const hard = (s - 1) / (STAGE_COUNT - 1);
  const start = stageStartX(s);
  const pole = stagePoleX(s);
  const layout: CourseLayout = {
    gaps: [],
    ledges: [],
    blocks: [],
    kudos: [],
    poles: [{ x: pole, stage: s }],
  };
  let nextId = s * 10000;
  const blockTop = groundY - 72;
  const addKudos = (x: number, y: number) =>
    layout.kudos.push({ id: nextId++, x, y });

  // The opening 450 px of every stage is flat track, so a stage never opens
  // under the runner's feet, and the last 360 px run clear to the pole.
  let x = start + 450;
  // Up to two power blocks a stage, the second holding a cape, and on some
  // stages one Runner's High.
  let powerLeft = 2;
  let highLeft = rand() < 0.35 ? 1 : 0;
  const end = pole - 360;
  while (x < end) {
    const roll = rand();
    if (roll < 0.28 + 0.12 * hard) {
      // A gap: a short hop at first, up to a full sprint jump on stage 5.
      const width = Math.round(30 + rand() * (18 + 26 * hard));
      layout.gaps.push({ x, width });
      addKudos(x + width / 2, groundY - 58);
      x += width;
    } else if (roll < 0.46 + 0.1 * hard) {
      // A wide gap with a ledge to stop on halfway.
      const width = Math.round(96 + rand() * 24);
      layout.gaps.push({ x, width });
      const ledgeW = 34;
      const ledgeX = x + (width - ledgeW) / 2;
      layout.ledges.push({ x: ledgeX, y: groundY - 40, width: ledgeW });
      addKudos(ledgeX + ledgeW / 2, groundY - 58);
      x += width;
    } else if (roll < 0.7) {
      // A row of blocks; the middle one is a Sync Block.
      const count = 3;
      for (let i = 0; i < count; i++) {
        const isSync = i === 1;
        let contents: CourseBlock["contents"] = "kudos";
        if (isSync && highLeft > 0 && rand() < 0.3) {
          contents = "high";
          highLeft--;
        } else if (isSync && powerLeft > 0 && rand() < 0.55) {
          contents = powerLeft === 2 ? "power" : "cape";
          powerLeft--;
        }
        layout.blocks.push({
          id: nextId++,
          x: x + i * BLOCK_SIZE,
          y: blockTop,
          kind: isSync ? "sync" : "brick",
          contents,
          used: false,
        });
      }
      addKudos(x + BLOCK_SIZE * 1.5, blockTop - 14);
      x += count * BLOCK_SIZE;
    } else if (roll < 0.85) {
      // Two ledges stepping up, with Kudos on top.
      layout.ledges.push({ x, y: groundY - 34, width: 36 });
      layout.ledges.push({ x: x + 50, y: groundY - 66, width: 36 });
      addKudos(x + 68, groundY - 80);
      addKudos(x + 18, groundY - 48);
      x += 86;
    } else {
      // A Kudos arc over open track.
      for (let i = 0; i < 5; i++) {
        const lift = Math.sin((i / 4) * Math.PI) * 30;
        addKudos(x + i * 14, groundY - 30 - lift);
      }
      x += 70;
    }
    // Breathing room between features, tighter on later stages.
    x += Math.round(200 - 70 * hard + rand() * 120);
  }
  return layout;
}

/** True when world x lies over a gap in the track. */
export function isOverGap(course: CourseLayout, worldX: number): boolean {
  return course.gaps.some((g) => worldX > g.x && worldX < g.x + g.width);
}

/**
 * True when the runner's feet, spanning `left` to `right` in world x, have
 * no track under them at all. A foot still on the edge keeps them up.
 */
export function isFootingOverGap(
  course: CourseLayout,
  left: number,
  right: number
): boolean {
  return course.gaps.some((g) => left >= g.x && right <= g.x + g.width);
}

/** Drops every feature that has scrolled fully behind `cameraX`. */
export function pruneCourse(
  course: CourseLayout,
  cameraX: number
): CourseLayout {
  const behind = cameraX - 40;
  const gaps = course.gaps.filter((g) => g.x + g.width > behind);
  const ledges = course.ledges.filter((l) => l.x + l.width > behind);
  const blocks = course.blocks.filter((b) => b.x + BLOCK_SIZE > behind);
  const kudos = course.kudos.filter((k) => k.x + KUDOS_RADIUS > behind);
  const poles = course.poles.filter((p) => p.x + 20 > behind);
  if (
    gaps.length === course.gaps.length &&
    ledges.length === course.ledges.length &&
    blocks.length === course.blocks.length &&
    kudos.length === course.kudos.length &&
    poles.length === course.poles.length
  ) {
    return course;
  }
  return { gaps, ledges, blocks, kudos, poles };
}

/** Adds `next` onto `course`, keeping what is still live. */
export function appendCourse(
  course: CourseLayout,
  next: CourseLayout
): CourseLayout {
  return {
    gaps: [...course.gaps, ...next.gaps],
    ledges: [...course.ledges, ...next.ledges],
    blocks: [...course.blocks, ...next.blocks],
    kudos: [...course.kudos, ...next.kudos],
    poles: [...course.poles, ...next.poles],
  };
}

/**
 * Bonus for grabbing the finish pole at `height` (0 bottom to 1 top): 100 at
 * the foot, 2000 near the top, in five steps. A full jump timed to peak at
 * the pole reaches the top step.
 */
export function poleBonus(height: number): number {
  const h = Number.isFinite(height) ? clamp(height, 0, 1) : 0;
  if (h >= 0.9) return 2000;
  if (h >= 0.65) return 1000;
  if (h >= 0.4) return 500;
  if (h >= 0.2) return 200;
  return 100;
}
